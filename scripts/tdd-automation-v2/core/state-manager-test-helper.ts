/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import { StateManager } from './state-manager'
import type { TDDState, SpecFileItem } from '../types'

/**
 * Create a test-specific StateManager that uses a temporary file
 * and doesn't require Git operations
 */
export function createTestStateManager(testFilePath: string) {
  /**
   * Helper: Read state file from disk
   */
  const readStateFile = (): Effect.Effect<TDDState, Error> =>
    Effect.tryPromise({
      try: async () => {
        const file = Bun.file(testFilePath)
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
   * Helper: Write state file to disk (without Git operations)
   */
  const writeStateFile = (state: TDDState): Effect.Effect<void, Error> =>
    Effect.tryPromise({
      try: async () => {
        const updatedState: TDDState = {
          ...state,
          lastUpdated: new Date().toISOString(),
        }
        await Bun.write(testFilePath, JSON.stringify(updatedState, null, 2))
      },
      catch: (error) => new Error(`Failed to write state file: ${String(error)}`),
    })

  /**
   * Helper: Transform state (simplified for tests - no Git operations)
   */
  const updateState = (fn: (state: TDDState) => TDDState): Effect.Effect<void, Error> =>
    Effect.gen(function* () {
      const currentState = yield* readStateFile()
      const newState = fn(currentState)
      yield* writeStateFile(newState)
    })

  return Layer.succeed(StateManager, {
    load: () => readStateFile(),

    save: (state) => writeStateFile(state),

    transition: (fileId, from, to) =>
      Effect.gen(function* () {
        yield* Effect.log(`Transitioning ${fileId}: ${from} → ${to}`)

        yield* updateState((state) => {
          // Find spec in source queue
          const sourceQueue = state.queue[from]
          const spec = sourceQueue.find((s) => s.id === fileId)

          if (!spec) {
            throw new Error(`Spec ${fileId} not found in ${from} queue`)
          }

          // Remove from source queue
          const newSourceQueue = sourceQueue.filter((s) => s.id !== fileId)

          // Update spec status and timestamp
          const updatedSpec: SpecFileItem = {
            id: spec.id,
            filePath: spec.filePath,
            priority: spec.priority,
            status: to,
            testCount: spec.testCount,
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

    recordFailureAndRequeue: (filePath, error) =>
      Effect.gen(function* () {
        yield* Effect.log(`Recording failure for ${filePath}: ${error.type}`)

        yield* updateState((state) => {
          // Find spec in active queue
          const spec = state.queue.active.find((s) => s.filePath === filePath)

          if (!spec) {
            throw new Error(`Spec ${filePath} not found in active queue`)
          }

          // Update spec with error and increment attempts
          const updatedSpec: SpecFileItem = {
            id: spec.id,
            filePath: spec.filePath,
            priority: spec.priority,
            status: 'pending',
            testCount: spec.testCount,
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
          const newActive = state.queue.active.filter((s) => s.filePath !== filePath)

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
          const spec = state.queue.active.find((s) => s.filePath === filePath)

          if (!spec) {
            throw new Error(`Spec ${filePath} not found in active queue`)
          }

          // Update spec with failure details
          const failedSpec: SpecFileItem = {
            id: spec.id,
            filePath: spec.filePath,
            priority: spec.priority,
            status: 'failed',
            testCount: spec.testCount,
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
          const newActive = state.queue.active.filter((s) => s.filePath !== filePath)

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
          const spec = state.queue.failed.find((s) => s.filePath === filePath)

          if (!spec) {
            throw new Error(`Spec ${filePath} not found in failed queue`)
          }

          // Reset spec
          const requeuedSpec: SpecFileItem = {
            id: spec.id,
            filePath: spec.filePath,
            priority: spec.priority,
            status: 'pending',
            testCount: spec.testCount,
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
          const newFailed = state.queue.failed.filter((s) => s.filePath !== filePath)

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
}
