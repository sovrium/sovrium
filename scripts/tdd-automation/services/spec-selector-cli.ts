#!/usr/bin/env bun

/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Logger, LogLevel } from 'effect'
import { StateManager, StateManagerLive } from '../core/state-manager'
import { SpecSelector, SpecSelectorLive, PriorityCalculatorLive } from './spec-selector'

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

  // CRITICAL: Transition specs to active AND lock files BEFORE returning
  // This prevents race conditions where another orchestrator run could select the same spec
  // before the worker has a chance to lock it
  console.error(`🔒 Locking selected specs and files...`)

  for (const spec of selectedSpecs) {
    // Lock the file first (primary exclusivity mechanism)
    yield* stateManager.addActiveFile(spec.filePath)
    console.error(`  ✅ Locked file: ${spec.filePath}`)

    // Lock the spec (redundant safety net)
    yield* stateManager.addActiveSpec(spec.specId)
    console.error(`  ✅ Locked spec: ${spec.specId}`)

    // Transition spec from pending to active
    yield* stateManager.transition(spec.specId, 'pending', 'active')
    console.error(`  ✅ Transitioned ${spec.specId}: pending → active`)
  }

  console.error(`🔒 All ${selectedSpecs.length} spec(s) locked and transitioned to active`)

  // Output JSON for GitHub Actions (stdout only)
  console.log(JSON.stringify(selectedSpecs, null, 2))

  return selectedSpecs
}).pipe(
  Effect.provide(StateManagerLive),
  Effect.provide(PriorityCalculatorLive),
  Effect.provide(SpecSelectorLive)
)

// Run the program with Effect logging disabled (to keep stdout clean for JSON output)
Effect.runPromise(program.pipe(Logger.withMinimumLogLevel(LogLevel.None))).catch((error) => {
  console.error('Spec selector failed:', error)
  process.exit(1)
})
