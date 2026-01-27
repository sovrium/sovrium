/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Mark Spec Complete
 *
 * Marks a spec as completed in the TDD state file.
 * Used when a spec is already passing and doesn't need implementation work.
 */

import { Effect, Layer, Logger, LogLevel } from 'effect'
import { StateManager, StateManagerLive } from './state-manager'

// Helper to get argument value from command line
const getArgValue = (argName: string): string | undefined => {
  const withEquals = process.argv.find((arg) => arg.startsWith(`--${argName}=`))
  if (withEquals) return withEquals.split('=')[1]

  const index = process.argv.indexOf(`--${argName}`)
  if (index !== -1 && process.argv[index + 1]) return process.argv[index + 1]

  return undefined
}

const program = Effect.gen(function* () {
  const specId = getArgValue('spec-id')
  const reason = getArgValue('reason') ?? 'Marked complete by automation'

  if (!specId) {
    console.error('Error: --spec-id argument is required')
    process.exit(1)
  }

  console.error(`✅ Marking spec ${specId} as complete...`)
  console.error(`📝 Reason: ${reason}`)

  const stateManager = yield* StateManager
  const state = yield* stateManager.load()

  // Find the spec in pending or active queue
  let spec = state.queue.pending.find((s) => s.specId === specId)
  let wasInPending = true

  if (!spec) {
    spec = state.queue.active.find((s) => s.specId === specId)
    wasInPending = false
  }

  if (!spec) {
    console.error(`⚠️ Spec ${specId} not found in pending or active queue`)
    console.error('It may have already been processed or removed')
    return
  }

  // Build new state with spec moved to completed
  const newState = {
    ...state,
    queue: {
      ...state.queue,
      pending: wasInPending ? state.queue.pending.filter((s) => s.specId !== specId) : state.queue.pending,
      active: wasInPending ? state.queue.active : state.queue.active.filter((s) => s.specId !== specId),
      completed: [
        ...state.queue.completed,
        {
          ...spec,
          status: 'completed' as const,
          completedAt: new Date().toISOString(),
          completionReason: reason,
        },
      ].slice(-100), // Keep only last 100 completed
    },
    // Release file and spec locks if they were held
    activeFiles: state.activeFiles.filter((f) => f !== spec!.filePath),
    activeSpecs: state.activeSpecs.filter((s) => s !== specId),
    // Update metrics
    metrics: {
      ...state.metrics,
      totalProcessed: state.metrics.totalProcessed + 1,
      costSavingsFromSkips: state.metrics.costSavingsFromSkips + 1.5, // Estimated savings
    },
  }

  yield* stateManager.save(newState)

  console.error(`✅ Spec ${specId} marked as complete`)
  console.error(`📊 Total processed: ${newState.metrics.totalProcessed}`)
  console.error(`💰 Cost savings from skips: $${newState.metrics.costSavingsFromSkips.toFixed(2)}`)
})

Effect.runPromise(
  program.pipe(
    Effect.provide(Layer.mergeAll(StateManagerLive)),
    Logger.withMinimumLogLevel(LogLevel.Warning)
  )
).catch((error) => {
  console.error('Failed to mark spec as complete:', error)
  process.exit(1)
})
