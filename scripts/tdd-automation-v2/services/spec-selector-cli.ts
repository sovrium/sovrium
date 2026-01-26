#!/usr/bin/env bun

/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Console } from 'effect'
import { StateManager, StateManagerLive } from '../core/state-manager'
import { SpecSelector, SpecSelectorLive, PriorityCalculatorLive } from './spec-selector'

const program = Effect.gen(function* () {
  // Parse count from command line args (default: 3)
  const countArg = process.argv.find((arg) => arg.startsWith('--count='))
  const count = countArg ? parseInt(countArg.split('=')[1], 10) : 3

  yield* Console.log(`📋 Selecting up to ${count} spec(s) to process...`)

  const stateManager = yield* StateManager
  const specSelector = yield* SpecSelector

  // Load current state
  const state = yield* stateManager.load()

  // Calculate available slots
  const activeCount = state.queue.active.length
  const maxConcurrent = state.config.maxConcurrentPRs
  const availableSlots = Math.min(count, maxConcurrent - activeCount)

  if (availableSlots <= 0) {
    yield* Console.log(`⚠️  No available slots (active: ${activeCount}/${maxConcurrent})`)
    // Output empty array for GitHub Actions
    console.log('[]')
    return []
  }

  yield* Console.log(`✅ Available slots: ${availableSlots}`)

  // Select next specs using priority queue
  const selectedSpecs = yield* specSelector.selectNext(availableSlots, state)

  yield* Console.log(`📊 Selected ${selectedSpecs.length} spec(s):`)

  for (const spec of selectedSpecs) {
    yield* Console.log(
      `  - ${spec.filePath} (priority: ${spec.priority}, tests: ${spec.testCount}, attempts: ${spec.attempts})`
    )
  }

  // Output JSON for GitHub Actions
  console.log(JSON.stringify(selectedSpecs, null, 2))

  return selectedSpecs
}).pipe(
  Effect.provide(StateManagerLive),
  Effect.provide(PriorityCalculatorLive),
  Effect.provide(SpecSelectorLive)
)

// Run the program
Effect.runPromise(program).catch((error) => {
  console.error('Spec selector failed:', error)
  process.exit(1)
})
