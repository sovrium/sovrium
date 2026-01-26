/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Context, Layer } from 'effect'
import type {
  TDDState,
  SpecFileItem,
  SpecStatus,
  SpecError,
  RequeueOptions,
  INITIAL_STATE,
} from '../types'

/**
 * State Manager Service
 *
 * Handles all state file operations with file-level locking and atomic updates.
 * Uses git-based commits to ensure atomic state transitions.
 */
export class StateManager extends Context.Tag('StateManager')<
  StateManager,
  {
    readonly load: () => Effect.Effect<TDDState, Error>
    readonly save: (state: TDDState) => Effect.Effect<void, Error>
    readonly transition: (
      fileId: string,
      from: SpecStatus,
      to: SpecStatus
    ) => Effect.Effect<void, Error>
    readonly addActiveFile: (filePath: string) => Effect.Effect<void, Error>
    readonly removeActiveFile: (filePath: string) => Effect.Effect<void, Error>
    readonly isFileLocked: (filePath: string) => Effect.Effect<boolean, never, StateManager>
    readonly recordFailureAndRequeue: (
      filePath: string,
      error: SpecError
    ) => Effect.Effect<void, Error>
    readonly moveToManualIntervention: (
      filePath: string,
      details: {
        errors: SpecError[]
        failureReason: string
        requiresAction: string
      }
    ) => Effect.Effect<void, Error>
    readonly requeueFromFailed: (
      filePath: string,
      options: RequeueOptions
    ) => Effect.Effect<void, Error>
  }
>() {}

const STATE_FILE_PATH = '.github/tdd-state.json'
const MAX_RETRIES = 5
const RETRY_DELAY_MS = 1000

/**
 * Helper: Execute shell command
 */
const exec = (command: string): Effect.Effect<string, Error> =>
  Effect.tryPromise({
    try: async () => {
      const proc = Bun.spawn(['sh', '-c', command], {
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const text = await new Response(proc.stdout).text()
      const exitCode = await proc.exited
      if (exitCode !== 0) {
        const error = await new Response(proc.stderr).text()
        throw new Error(`Command failed (${exitCode}): ${error}`)
      }
      return text.trim()
    },
    catch: (error) => new Error(`Exec failed: ${String(error)}`),
  })

/**
 * Helper: Sleep for specified milliseconds
 */
const sleep = (ms: number): Effect.Effect<void> =>
  Effect.promise(() => new Promise((resolve) => setTimeout(resolve, ms)))

/**
 * Helper: Read state file from disk
 */
const readStateFile = (): Effect.Effect<TDDState, Error> =>
  Effect.tryPromise({
    try: async () => {
      const file = Bun.file(STATE_FILE_PATH)
      const exists = await file.exists()

      if (!exists) {
        // Return initial state if file doesn't exist yet
        const { INITIAL_STATE } = await import('../types')
        return INITIAL_STATE
      }

      const content = await file.text()
      return JSON.parse(content) as TDDState
    },
    catch: (error) => new Error(`Failed to read state file: ${String(error)}`),
  })

/**
 * Helper: Write state file to disk
 */
const writeStateFile = (state: TDDState): Effect.Effect<void, Error> =>
  Effect.tryPromise({
    try: async () => {
      const updatedState: TDDState = {
        ...state,
        lastUpdated: new Date().toISOString(),
      }
      await Bun.write(STATE_FILE_PATH, JSON.stringify(updatedState, null, 2))
    },
    catch: (error) => new Error(`Failed to write state file: ${String(error)}`),
  })

/**
 * Helper: Atomic state update with git retry
 *
 * Uses git pull → modify → commit → push cycle with retry on conflict.
 * This ensures atomic updates even with concurrent workflow runs.
 */
const updateStateWithRetry = (
  newState: TDDState,
  retriesLeft: number = MAX_RETRIES
): Effect.Effect<void, Error> =>
  Effect.gen(function* () {
    if (retriesLeft <= 0) {
      return yield* Effect.fail(new Error('Failed to update state after maximum retries'))
    }

    try {
      // 1. Pull latest from main
      yield* exec('git pull origin main --rebase')

      // 2. Write new state
      yield* writeStateFile(newState)

      // 3. Commit changes
      yield* exec('git add .github/tdd-state.json')
      yield* exec('git commit -m "chore(tdd): update state [skip ci]"')

      // 4. Push (may fail due to concurrent update)
      yield* exec('git push origin main')

      // Success!
      return
    } catch (error) {
      const errorMessage = String(error)

      // Check if error is due to concurrent update
      if (
        errorMessage.includes('rejected') ||
        errorMessage.includes('conflict') ||
        errorMessage.includes('non-fast-forward')
      ) {
        // Retry after delay
        yield* Effect.log(
          `State update conflict, retrying (${retriesLeft - 1} attempts remaining)...`
        )
        yield* sleep(RETRY_DELAY_MS)
        return yield* updateStateWithRetry(newState, retriesLeft - 1)
      }

      // Other error - fail immediately
      return yield* Effect.fail(error as Error)
    }
  })

/**
 * Helper: Transform state atomically
 */
const updateState = (fn: (state: TDDState) => TDDState): Effect.Effect<void, Error, StateManager> =>
  Effect.gen(function* () {
    const stateManager = yield* StateManager
    const currentState = yield* stateManager.load()
    const newState = fn(currentState)
    yield* stateManager.save(newState)
  })

/**
 * State Manager Live Implementation
 */
export const StateManagerLive = Layer.succeed(StateManager, {
  load: () => readStateFile(),

  save: (state) => updateStateWithRetry(state),

  transition: (fileId, from, to) =>
    Effect.gen(function* () {
      yield* Effect.log(`Transitioning ${fileId}: ${from} → ${to}`)

      yield* updateState((state) => {
        // Find spec in source queue
        const sourceQueue = state.queue[from]
        const specIndex = sourceQueue.findIndex((s) => s.id === fileId)

        if (specIndex === -1) {
          throw new Error(`Spec ${fileId} not found in ${from} queue`)
        }

        const spec = sourceQueue[specIndex]

        // Remove from source queue
        const newSourceQueue = [
          ...sourceQueue.slice(0, specIndex),
          ...sourceQueue.slice(specIndex + 1),
        ]

        // Update spec status and timestamp
        const updatedSpec: SpecFileItem = {
          ...spec,
          status: to,
          ...(to === 'active' && { startedAt: new Date().toISOString() }),
          ...(to === 'completed' && { completedAt: new Date().toISOString() }),
        }

        // Add to destination queue
        const destQueue = state.queue[to]
        const newDestQueue = [...destQueue, updatedSpec]

        return {
          ...state,
          queue: {
            ...state.queue,
            [from]: newSourceQueue,
            [to]: newDestQueue,
          },
        }
      })
    }),

  addActiveFile: (filePath) =>
    Effect.gen(function* () {
      yield* Effect.log(`🔒 Locking file: ${filePath}`)

      yield* updateState((state) => {
        // Idempotent: don't add if already present
        if (state.activeFiles.includes(filePath)) {
          return state
        }

        return {
          ...state,
          activeFiles: [...state.activeFiles, filePath],
        }
      })
    }),

  removeActiveFile: (filePath) =>
    Effect.gen(function* () {
      yield* Effect.log(`🔓 Unlocking file: ${filePath}`)

      yield* updateState((state) => ({
        ...state,
        activeFiles: state.activeFiles.filter((f) => f !== filePath),
      }))
    }),

  isFileLocked: (filePath) =>
    Effect.gen(function* () {
      const stateManager = yield* StateManager
      const state = yield* stateManager.load()
      return state.activeFiles.includes(filePath)
    }),

  recordFailureAndRequeue: (filePath, error) =>
    Effect.gen(function* () {
      yield* Effect.log(`Recording failure for ${filePath}: ${error.type}`)

      yield* updateState((state) => {
        // Find spec in active queue
        const activeIndex = state.queue.active.findIndex((s) => s.filePath === filePath)

        if (activeIndex === -1) {
          throw new Error(`Spec ${filePath} not found in active queue`)
        }

        const spec = state.queue.active[activeIndex]

        // Update spec with error and increment attempts
        const updatedSpec: SpecFileItem = {
          ...spec,
          status: 'pending',
          attempts: spec.attempts + 1,
          lastAttempt: new Date().toISOString(),
          errors: [...spec.errors, error],
        }

        // Remove from active, add to pending
        const newActive = [
          ...state.queue.active.slice(0, activeIndex),
          ...state.queue.active.slice(activeIndex + 1),
        ]

        return {
          ...state,
          queue: {
            ...state.queue,
            active: newActive,
            pending: [...state.queue.pending, updatedSpec],
          },
        }
      })
    }),

  moveToManualIntervention: (filePath, details) =>
    Effect.gen(function* () {
      yield* Effect.log(`Moving ${filePath} to manual intervention: ${details.failureReason}`)

      yield* updateState((state) => {
        // Find spec in active queue
        const activeIndex = state.queue.active.findIndex((s) => s.filePath === filePath)

        if (activeIndex === -1) {
          throw new Error(`Spec ${filePath} not found in active queue`)
        }

        const spec = state.queue.active[activeIndex]

        // Update spec with failure details
        const failedSpec: SpecFileItem = {
          ...spec,
          status: 'failed',
          errors: details.errors,
          failureReason: details.failureReason,
          requiresAction: details.requiresAction,
        }

        // Remove from active, add to failed
        const newActive = [
          ...state.queue.active.slice(0, activeIndex),
          ...state.queue.active.slice(activeIndex + 1),
        ]

        return {
          ...state,
          queue: {
            ...state.queue,
            active: newActive,
            failed: [...state.queue.failed, failedSpec],
          },
          metrics: {
            ...state.metrics,
            manualInterventionCount: state.metrics.manualInterventionCount + 1,
          },
        }
      })
    }),

  requeueFromFailed: (filePath, options) =>
    Effect.gen(function* () {
      yield* Effect.log(`Re-queuing ${filePath} from failed status`)

      yield* updateState((state) => {
        // Find spec in failed queue
        const failedIndex = state.queue.failed.findIndex((s) => s.filePath === filePath)

        if (failedIndex === -1) {
          throw new Error(`Spec ${filePath} not found in failed queue`)
        }

        const spec = state.queue.failed[failedIndex]

        // Reset spec
        const requeuedSpec: SpecFileItem = {
          ...spec,
          status: 'pending',
          attempts: options.resetRetries ? 0 : spec.attempts,
          errors: options.clearErrors ? [] : spec.errors,
          lastAttempt: undefined,
          failureReason: undefined,
          requiresAction: undefined,
        }

        // Remove from failed, add to pending
        const newFailed = [
          ...state.queue.failed.slice(0, failedIndex),
          ...state.queue.failed.slice(failedIndex + 1),
        ]

        return {
          ...state,
          queue: {
            ...state.queue,
            failed: newFailed,
            pending: [...state.queue.pending, requeuedSpec],
          },
        }
      })
    }),
})
