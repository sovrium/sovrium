/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Context, Layer, Data } from 'effect'
import type { TDDState, SpecQueueItem, SpecStatus, SpecError, RequeueOptions } from '../types'

/**
 * Tagged error types for state manager operations
 */
class CommandExecutionError extends Data.TaggedError('CommandExecutionError')<{
  readonly command: string
  readonly exitCode?: number
  readonly stderr?: string
  readonly cause: unknown
}> {}

class StateFileReadError extends Data.TaggedError('StateFileReadError')<{
  readonly path: string
  readonly cause: unknown
}> {}

class StateFileWriteError extends Data.TaggedError('StateFileWriteError')<{
  readonly path: string
  readonly cause: unknown
}> {}

class MaxRetriesExceededError extends Data.TaggedError('MaxRetriesExceededError')<{
  readonly maxRetries: number
}> {}

class SpecNotFoundInQueueError extends Data.TaggedError('SpecNotFoundInQueueError')<{
  readonly specId: string
  readonly queueName: string
}> {}

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
    /**
     * Lock and activate multiple specs in a single atomic operation.
     * This prevents race conditions by batching all lock operations into one git commit.
     */
    readonly lockAndActivateSpecs: (
      specs: Array<{ specId: string; filePath: string }>
    ) => Effect.Effect<void, Error>
  }
>() {}

const STATE_FILE_PATH = '.github/tdd-state.json'
const MAX_RETRIES = 5
const RETRY_DELAY_MS = 1000

/**
 * Helper: Execute shell command
 */
const exec = (command: string): Effect.Effect<string, CommandExecutionError> =>
  Effect.tryPromise({
    try: async () => {
      const proc = Bun.spawn(['sh', '-c', command], {
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const text = await new Response(proc.stdout).text()
      const exitCode = await proc.exited
      if (exitCode !== 0) {
        const stderr = await new Response(proc.stderr).text()
        throw new CommandExecutionError({
          command,
          exitCode,
          stderr,
          cause: new Error(`Command failed (${exitCode}): ${stderr}`),
        })
      }
      return text.trim()
    },
    catch: (error) =>
      new CommandExecutionError({
        command,
        cause: error,
      }),
  })

/**
 * Helper: Sleep for specified milliseconds
 */
const sleep = (ms: number): Effect.Effect<void> =>
  Effect.promise(() => new Promise((resolve) => setTimeout(resolve, ms)))

/**
 * Helper: Read state file from disk
 */
const readStateFile = (): Effect.Effect<TDDState, StateFileReadError> =>
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
    catch: (error) => new StateFileReadError({ path: STATE_FILE_PATH, cause: error }),
  })

/**
 * Helper: Write state file to disk
 */
const writeStateFile = (state: TDDState): Effect.Effect<void, StateFileWriteError> =>
  Effect.tryPromise({
    try: async () => {
      const updatedState: TDDState = {
        ...state,
        lastUpdated: new Date().toISOString(),
      }
      await Bun.write(STATE_FILE_PATH, JSON.stringify(updatedState, null, 2))
    },
    catch: (error) => new StateFileWriteError({ path: STATE_FILE_PATH, cause: error }),
  })

/**
 * Helper: Atomic state update with git retry
 *
 * Uses git fetch → reset → modify → commit → push cycle with retry on conflict.
 * This ensures atomic updates even with concurrent workflow runs.
 *
 * IMPORTANT: We use fetch + reset instead of pull --rebase because:
 * 1. CI environments may have unstaged changes from bun install (bun.lock updates)
 * 2. git pull --rebase fails if there are any unstaged changes in the working directory
 * 3. We only care about the state file, so we can safely reset other changes
 */
const updateStateWithRetry = (
  newState: TDDState,
  retriesLeft: number = MAX_RETRIES
): Effect.Effect<
  void,
  CommandExecutionError | StateFileWriteError | MaxRetriesExceededError | Error
> =>
  Effect.gen(function* () {
    if (retriesLeft <= 0) {
      return yield* new MaxRetriesExceededError({ maxRetries: MAX_RETRIES })
    }

    return yield* Effect.gen(function* () {
      // 1. Fetch latest from remote (doesn't modify working directory)
      yield* exec('git fetch origin main')

      // 2. Stash any uncommitted changes (including bun.lock from bun install)
      // Use --include-untracked to also handle new files
      // The || true ensures this doesn't fail if there's nothing to stash
      yield* exec('git stash --include-untracked || true')

      // 3. Reset to origin/main to get latest state
      yield* exec('git reset --hard origin/main')

      // 4. Write new state (this creates the only change we want to commit)
      yield* writeStateFile(newState)

      // 5. Commit changes
      yield* exec('git add .github/tdd-state.json')
      yield* exec('git commit -m "chore(tdd): update state [skip ci]"')

      // 6. Push (may fail due to concurrent update)
      yield* exec('git push origin main')

      // 7. Pop stash to restore working directory state (if anything was stashed)
      // This ensures bun install changes are preserved for subsequent steps
      yield* exec('git stash pop || true')
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
const updateState = (
  fn: (state: TDDState) => TDDState
): Effect.Effect<
  void,
  StateFileReadError | CommandExecutionError | StateFileWriteError | MaxRetriesExceededError | Error
> =>
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
          throw new SpecNotFoundInQueueError({ specId, queueName: from })
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
          throw new SpecNotFoundInQueueError({ specId, queueName: 'active' })
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
          throw new SpecNotFoundInQueueError({ specId, queueName: 'active' })
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
          throw new SpecNotFoundInQueueError({ specId, queueName: 'failed' })
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

  lockAndActivateSpecs: (specs) =>
    Effect.gen(function* () {
      if (specs.length === 0) {
        return
      }

      yield* Effect.log(
        `🔒 Locking and activating ${specs.length} spec(s) in single atomic operation...`
      )

      yield* updateState((state) => {
        // Collect all file paths and spec IDs to lock
        const filePaths = specs.map((s) => s.filePath)
        const specIds = specs.map((s) => s.specId)

        // Add files to activeFiles (idempotent - don't add duplicates)
        const newActiveFiles = [...state.activeFiles]
        for (const filePath of filePaths) {
          if (!newActiveFiles.includes(filePath)) {
            newActiveFiles.push(filePath)
          }
        }

        // Add specs to activeSpecs (idempotent - don't add duplicates)
        const newActiveSpecs = [...state.activeSpecs]
        for (const specId of specIds) {
          if (!newActiveSpecs.includes(specId)) {
            newActiveSpecs.push(specId)
          }
        }

        // Transition all specs from pending to active
        let newPendingQueue = [...state.queue.pending]
        const newActiveQueue = [...state.queue.active]

        for (const { specId } of specs) {
          const spec = newPendingQueue.find((s) => s.specId === specId)
          if (!spec) {
            throw new SpecNotFoundInQueueError({ specId, queueName: 'pending' })
          }

          // Remove from pending
          newPendingQueue = newPendingQueue.filter((s) => s.specId !== specId)

          // Update spec status and add to active
          const updatedSpec: SpecQueueItem = {
            id: spec.id,
            specId: spec.specId,
            filePath: spec.filePath,
            testName: spec.testName,
            priority: spec.priority,
            status: 'active',
            attempts: spec.attempts,
            errors: spec.errors,
            queuedAt: spec.queuedAt,
            prNumber: spec.prNumber,
            prUrl: spec.prUrl,
            branch: spec.branch,
            lastAttempt: spec.lastAttempt,
            startedAt: new Date().toISOString(),
            completedAt: spec.completedAt,
            failureReason: spec.failureReason,
            requiresAction: spec.requiresAction,
          }
          newActiveQueue.push(updatedSpec)
        }

        return {
          ...state,
          activeFiles: newActiveFiles,
          activeSpecs: newActiveSpecs,
          queue: {
            ...state.queue,
            pending: newPendingQueue,
            active: newActiveQueue,
          },
        }
      })

      yield* Effect.log(`✅ Successfully locked and activated ${specs.length} spec(s)`)
    }),
})
