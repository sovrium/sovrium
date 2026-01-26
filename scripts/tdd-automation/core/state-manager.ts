/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Context, Layer } from 'effect'
import type { TDDState, SpecQueueItem, SpecStatus, SpecError, RequeueOptions } from '../types'

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
      specId: string,
      from: SpecStatus,
      to: SpecStatus
    ) => Effect.Effect<void, Error>
    readonly addActiveFile: (filePath: string) => Effect.Effect<void, Error>
    readonly removeActiveFile: (filePath: string) => Effect.Effect<void, Error>
    readonly addActiveSpec: (specId: string) => Effect.Effect<void, Error>
    readonly removeActiveSpec: (specId: string) => Effect.Effect<void, Error>
    readonly isFileLocked: (filePath: string) => Effect.Effect<boolean, Error>
    readonly recordFailureAndRequeue: (
      specId: string,
      error: SpecError
    ) => Effect.Effect<void, Error>
    readonly moveToManualIntervention: (
      specId: string,
      details: {
        errors: SpecError[]
        failureReason: string
        requiresAction: string
      }
    ) => Effect.Effect<void, Error>
    readonly requeueFromFailed: (
      specId: string,
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

    return yield* Effect.gen(function* () {
      // 1. Pull latest from main
      yield* exec('git pull origin main --rebase')

      // 2. Write new state
      yield* writeStateFile(newState)

      // 3. Commit changes
      yield* exec('git add .github/tdd-state.json')
      yield* exec('git commit -m "chore(tdd): update state [skip ci]"')

      // 4. Push (may fail due to concurrent update)
      yield* exec('git push origin main')
    }).pipe(
      Effect.catchAll((error) => {
        const errorMessage = String(error)

        // Check if error is due to concurrent update
        if (
          errorMessage.includes('rejected') ||
          errorMessage.includes('conflict') ||
          errorMessage.includes('non-fast-forward')
        ) {
          // Retry after delay
          return Effect.gen(function* () {
            yield* Effect.log(
              `State update conflict, retrying (${retriesLeft - 1} attempts remaining)...`
            )
            yield* sleep(RETRY_DELAY_MS)
            return yield* updateStateWithRetry(newState, retriesLeft - 1)
          })
        }

        // Other error - fail immediately
        return Effect.fail(error as Error)
      })
    )
  })

/**
 * Helper: Transform state atomically
 * Note: Uses direct file operations to avoid circular dependency with StateManager
 */
const updateState = (fn: (state: TDDState) => TDDState): Effect.Effect<void, Error> =>
  Effect.gen(function* () {
    const currentState = yield* readStateFile()
    const newState = fn(currentState)
    yield* updateStateWithRetry(newState)
  })

/**
 * State Manager Live Implementation
 */
export const StateManagerLive = Layer.succeed(StateManager, {
  load: () => readStateFile(),

  save: (state) => updateStateWithRetry(state),

  transition: (specId, from, to) =>
    Effect.gen(function* () {
      yield* Effect.log(`Transitioning ${specId}: ${from} → ${to}`)

      yield* updateState((state) => {
        // Find spec in source queue
        const sourceQueue = state.queue[from]
        const spec = sourceQueue.find((s) => s.specId === specId)

        if (!spec) {
          throw new Error(`Spec ${specId} not found in ${from} queue`)
        }

        // Remove from source queue
        const newSourceQueue = sourceQueue.filter((s) => s.specId !== specId)

        // Update spec status and timestamp
        const updatedSpec: SpecQueueItem = {
          id: spec.id,
          specId: spec.specId,
          filePath: spec.filePath,
          testName: spec.testName,
          priority: spec.priority,
          status: to,
          attempts: spec.attempts,
          errors: spec.errors,
          queuedAt: spec.queuedAt,
          prNumber: spec.prNumber,
          prUrl: spec.prUrl,
          branch: spec.branch,
          lastAttempt: spec.lastAttempt,
          startedAt: to === 'active' ? new Date().toISOString() : spec.startedAt,
          completedAt: to === 'completed' ? new Date().toISOString() : spec.completedAt,
          failureReason: spec.failureReason,
          requiresAction: spec.requiresAction,
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
      const state = yield* readStateFile()
      return state.activeFiles.includes(filePath)
    }),

  addActiveSpec: (specId) =>
    Effect.gen(function* () {
      yield* Effect.log(`🔒 Locking spec: ${specId}`)

      yield* updateState((state) => {
        // Idempotent: don't add if already present
        if (state.activeSpecs.includes(specId)) {
          return state
        }

        return {
          ...state,
          activeSpecs: [...state.activeSpecs, specId],
        }
      })
    }),

  removeActiveSpec: (specId) =>
    Effect.gen(function* () {
      yield* Effect.log(`🔓 Unlocking spec: ${specId}`)

      yield* updateState((state) => ({
        ...state,
        activeSpecs: state.activeSpecs.filter((id) => id !== specId),
      }))
    }),

  recordFailureAndRequeue: (specId, error) =>
    Effect.gen(function* () {
      yield* Effect.log(`Recording failure for ${specId}: ${error.type}`)

      yield* updateState((state) => {
        // Find spec in active queue
        const spec = state.queue.active.find((s) => s.specId === specId)

        if (!spec) {
          throw new Error(`Spec ${specId} not found in active queue`)
        }

        // Update spec with error and increment attempts
        const updatedSpec: SpecQueueItem = {
          id: spec.id,
          specId: spec.specId,
          filePath: spec.filePath,
          testName: spec.testName,
          priority: spec.priority,
          status: 'pending',
          attempts: spec.attempts + 1,
          errors: [...spec.errors, error],
          queuedAt: spec.queuedAt,
          prNumber: spec.prNumber,
          prUrl: spec.prUrl,
          branch: spec.branch,
          lastAttempt: new Date().toISOString(),
          startedAt: spec.startedAt,
          completedAt: spec.completedAt,
          failureReason: spec.failureReason,
          requiresAction: spec.requiresAction,
        }

        // Remove from active, add to pending
        const newActive = state.queue.active.filter((s) => s.specId !== specId)

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

  moveToManualIntervention: (specId, details) =>
    Effect.gen(function* () {
      yield* Effect.log(`Moving ${specId} to manual intervention: ${details.failureReason}`)

      yield* updateState((state) => {
        // Find spec in active queue
        const spec = state.queue.active.find((s) => s.specId === specId)

        if (!spec) {
          throw new Error(`Spec ${specId} not found in active queue`)
        }

        // Update spec with failure details
        const failedSpec: SpecQueueItem = {
          id: spec.id,
          specId: spec.specId,
          filePath: spec.filePath,
          testName: spec.testName,
          priority: spec.priority,
          status: 'failed',
          attempts: spec.attempts,
          errors: details.errors,
          queuedAt: spec.queuedAt,
          prNumber: spec.prNumber,
          prUrl: spec.prUrl,
          branch: spec.branch,
          lastAttempt: spec.lastAttempt,
          startedAt: spec.startedAt,
          completedAt: spec.completedAt,
          failureReason: details.failureReason,
          requiresAction: details.requiresAction,
        }

        // Remove from active, add to failed
        const newActive = state.queue.active.filter((s) => s.specId !== specId)

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

  requeueFromFailed: (specId, options) =>
    Effect.gen(function* () {
      yield* Effect.log(`Re-queuing ${specId} from failed status`)

      yield* updateState((state) => {
        // Find spec in failed queue
        const spec = state.queue.failed.find((s) => s.specId === specId)

        if (!spec) {
          throw new Error(`Spec ${specId} not found in failed queue`)
        }

        // Reset spec
        const requeuedSpec: SpecQueueItem = {
          id: spec.id,
          specId: spec.specId,
          filePath: spec.filePath,
          testName: spec.testName,
          priority: spec.priority,
          status: 'pending',
          attempts: options.resetRetries ? 0 : spec.attempts,
          errors: options.clearErrors ? [] : spec.errors,
          queuedAt: spec.queuedAt,
          prNumber: spec.prNumber,
          prUrl: spec.prUrl,
          branch: spec.branch,
          lastAttempt: undefined,
          startedAt: spec.startedAt,
          completedAt: spec.completedAt,
          failureReason: undefined,
          requiresAction: undefined,
        }

        // Remove from failed, add to pending
        const newFailed = state.queue.failed.filter((s) => s.specId !== specId)

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
