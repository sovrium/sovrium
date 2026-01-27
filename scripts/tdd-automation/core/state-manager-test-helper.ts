/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer, Data } from 'effect'
import { StateManager } from './state-manager'
import type { TDDState, SpecQueueItem } from '../types'

/**
 * Tagged error types for state manager test operations
 */
class StateFileReadError extends Data.TaggedError('StateFileReadError')<{
  readonly path: string
  readonly cause: unknown
}> {}

class StateFileWriteError extends Data.TaggedError('StateFileWriteError')<{
  readonly path: string
  readonly cause: unknown
}> {}

class SpecNotFoundInQueueError extends Data.TaggedError('SpecNotFoundInQueueError')<{
  readonly specId: string
  readonly queueName: string
}> {}

/**
 * Create a test-specific StateManager that uses a temporary file
 * and doesn't require Git operations
 */
export function createTestStateManager(testFilePath: string) {
  /**
   * Helper: Read state file from disk
   */
  const readStateFile = (): Effect.Effect<TDDState, StateFileReadError> =>
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
      catch: (error) => new StateFileReadError({ path: testFilePath, cause: error }),
    })

  /**
   * Helper: Write state file to disk (without Git operations)
   */
  const writeStateFile = (state: TDDState): Effect.Effect<void, StateFileWriteError> =>
    Effect.tryPromise({
      try: async () => {
        const updatedState: TDDState = {
          ...state,
          lastUpdated: new Date().toISOString(),
        }
        await Bun.write(testFilePath, JSON.stringify(updatedState, null, 2))
      },
      catch: (error) => new StateFileWriteError({ path: testFilePath, cause: error }),
    })

  /**
   * Helper: Transform state (simplified for tests - no Git operations)
   */
  const updateState = (
    fn: (state: TDDState) => TDDState
  ): Effect.Effect<void, StateFileReadError | StateFileWriteError> =>
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
            throw new SpecNotFoundInQueueError({ specId: fileId, queueName: from })
          }

          // Remove from source queue
          const newSourceQueue = sourceQueue.filter((s) => s.id !== fileId)

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

    recordFailureAndRequeue: (filePath, error) =>
      Effect.gen(function* () {
        yield* Effect.log(`Recording failure for ${filePath}: ${error.type}`)

        yield* updateState((state) => {
          // Find spec in active queue
          const spec = state.queue.active.find((s) => s.filePath === filePath)

          if (!spec) {
            throw new SpecNotFoundInQueueError({ specId: filePath, queueName: 'active' })
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

    requeueWithoutPenalty: (specId, error) =>
      Effect.gen(function* () {
        yield* Effect.log(
          `Re-queuing ${specId} without penalty (infrastructure failure): ${error.type}`
        )

        yield* updateState((state) => {
          // Find spec in active queue by specId
          const spec = state.queue.active.find((s) => s.specId === specId)

          if (!spec) {
            throw new SpecNotFoundInQueueError({ specId, queueName: 'active' })
          }

          // Update spec with error but DO NOT increment attempts (no penalty for infra failures)
          const updatedSpec: SpecQueueItem = {
            id: spec.id,
            specId: spec.specId,
            filePath: spec.filePath,
            testName: spec.testName,
            priority: spec.priority,
            status: 'pending',
            attempts: spec.attempts, // NO INCREMENT for infrastructure failures
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

    moveToManualIntervention: (filePath, details) =>
      Effect.gen(function* () {
        yield* Effect.log(`Moving ${filePath} to manual intervention: ${details.failureReason}`)

        yield* updateState((state) => {
          // Find spec in active queue
          const spec = state.queue.active.find((s) => s.filePath === filePath)

          if (!spec) {
            throw new SpecNotFoundInQueueError({ specId: filePath, queueName: 'active' })
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
            throw new SpecNotFoundInQueueError({ specId: filePath, queueName: 'failed' })
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

    updateActivePR: (specId, prInfo) =>
      Effect.gen(function* () {
        yield* Effect.log(
          `📝 Updating PR info for ${specId}: PR #${prInfo.prNumber} (${prInfo.branch})`
        )

        yield* updateState((state) => {
          // Find spec in active queue
          const specIndex = state.queue.active.findIndex((s) => s.specId === specId)

          if (specIndex === -1) {
            console.error(`Warning: Spec ${specId} not found in active queue, skipping PR update`)
            return state
          }

          const spec = state.queue.active[specIndex]
          if (!spec) {
            // Extra safety check (should never happen since we checked index above)
            return state
          }

          // Update spec with PR info
          const updatedSpec: SpecQueueItem = {
            id: spec.id,
            specId: spec.specId,
            filePath: spec.filePath,
            testName: spec.testName,
            priority: spec.priority,
            status: spec.status,
            attempts: spec.attempts,
            errors: spec.errors,
            queuedAt: spec.queuedAt,
            prNumber: prInfo.prNumber,
            prUrl: prInfo.prUrl,
            branch: prInfo.branch,
            lastAttempt: spec.lastAttempt,
            startedAt: spec.startedAt,
            completedAt: spec.completedAt,
            failureReason: spec.failureReason,
            requiresAction: spec.requiresAction,
          }

          // Replace spec in active queue
          const newActiveQueue = [...state.queue.active]
          newActiveQueue[specIndex] = updatedSpec

          return {
            ...state,
            queue: {
              ...state.queue,
              active: newActiveQueue,
            },
          }
        })
      }),
  })
}
