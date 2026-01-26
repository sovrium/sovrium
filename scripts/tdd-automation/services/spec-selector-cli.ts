#!/usr/bin/env bun

/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Logger, LogLevel, Layer } from 'effect'
import { StateManager, StateManagerLive } from '../core/state-manager'
import { SpecSelector, SpecSelectorLive, PriorityCalculatorLive } from './spec-selector'

// Merge all layers for single provide call
const AppLayer = Layer.mergeAll(StateManagerLive, PriorityCalculatorLive, SpecSelectorLive)

const program = Effect.gen(function* () {
  // Parse count from command line args (default: 3)
  const countArg = process.argv.find((arg) => arg.startsWith('--count='))
  const count = countArg ? parseInt(countArg.split('=')[1] ?? '3', 10) : 3

  // Log to stderr so it doesn't interfere with JSON output on stdout
  console.error(`📋 Selecting up to ${count} spec(s) to process...`)

  const stateManager = yield* StateManager
  const specSelector = yield* SpecSelector

  // Load current state
  const state = yield* stateManager.load()

  // Calculate available slots
  const activeCount = state.queue.active.length
  const maxConcurrent = state.config.maxConcurrentPRs
  const availableSlots = Math.min(count, maxConcurrent - activeCount)

  if (availableSlots <= 0) {
    console.error(`⚠️  No available slots (active: ${activeCount}/${maxConcurrent})`)
    // Output empty array for GitHub Actions
    console.log('[]')
    return []
  }

  console.error(`✅ Available slots: ${availableSlots}`)

  // Select next specs using priority queue
  const selectedSpecs = yield* specSelector.selectNext(availableSlots, state)

  if (selectedSpecs.length === 0) {
    console.error(`📊 No eligible specs to process`)
    console.log('[]')
    return []
  }

  console.error(`📊 Selected ${selectedSpecs.length} spec(s):`)

  for (const spec of selectedSpecs) {
    console.error(
      `  - ${spec.specId}: ${spec.testName} (priority: ${spec.priority}, attempts: ${spec.attempts})`
    )
  }

  // CRITICAL: Lock all specs and files in a SINGLE atomic operation
  // This prevents race conditions by batching all state changes into one git commit
  // Before this fix, we were making 9 separate git commits for 3 specs (3 x 3 operations)
  // Now we make just 1 commit for all locks and transitions
  console.error(`🔒 Locking selected specs and files (single atomic operation)...`)

  yield* stateManager.lockAndActivateSpecs(
    selectedSpecs.map((spec) => ({
      specId: spec.specId,
      filePath: spec.filePath,
    }))
  )

  for (const spec of selectedSpecs) {
    console.error(`  ✅ Locked and activated: ${spec.specId} (${spec.filePath})`)
  }

  console.error(`🔒 All ${selectedSpecs.length} spec(s) locked and transitioned to active`)

  // Output JSON for GitHub Actions (stdout only)
  // NOTE: JSON.stringify appropriate for CLI output to GitHub Actions (Effect Schema not needed)
  console.log(JSON.stringify(selectedSpecs, null, 2))

  return selectedSpecs
}).pipe(Effect.provide(AppLayer))

// Run the program with Effect logging disabled (to keep stdout clean for JSON output)
Effect.runPromise(program.pipe(Logger.withMinimumLogLevel(LogLevel.None))).catch((error) => {
  console.error('Spec selector failed:', error)
  process.exit(1)
})
