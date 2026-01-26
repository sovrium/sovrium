#!/usr/bin/env bun

/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Initialize TDD Queue
 *
 * This script initializes the TDD automation queue by:
 * 1. Creating initial state file if it doesn't exist
 * 2. Scanning codebase for specs with .fixme() tests
 * 3. Adding specs to pending queue
 *
 * Usage:
 *   bun run scripts/tdd-automation/initialize-queue.ts
 *   bun run scripts/tdd-automation/initialize-queue.ts --reset  # Reset state file
 */

import { existsSync } from 'node:fs'
import { Effect, Console, Data } from 'effect'
import { extractAllSpecs } from './services/spec-extractor'
import type { TDDState } from './types'

/**
 * Tagged error types for queue initialization
 */
class StateFileWriteError extends Data.TaggedError('StateFileWriteError')<{
  readonly path: string
  readonly cause: unknown
}> {}

const STATE_FILE = '.github/tdd-state.json'

const program = Effect.gen(function* () {
  const reset = process.argv.includes('--reset')

  yield* Console.log('')
  yield* Console.log('═══════════════════════════════════════════════')
  yield* Console.log('  TDD Queue - Initialization Tool')
  yield* Console.log('═══════════════════════════════════════════════')
  yield* Console.log('')

  yield* Console.log('🚀 Initializing TDD Queue...')

  // Check if state file exists
  const stateExists = existsSync(STATE_FILE)

  if (stateExists && !reset) {
    yield* Console.log(`⚠️  State file already exists at ${STATE_FILE}`)
    yield* Console.log('Use --reset to overwrite')
    return
  }

  if (reset && stateExists) {
    yield* Console.log(`🔄 Resetting state file...`)
  }

  // Create initial state
  const initialState: TDDState = {
    version: '2.0.0',
    lastUpdated: new Date().toISOString(),
    queue: {
      pending: [],
      active: [],
      completed: [],
      failed: [],
    },
    activeFiles: [],
    activeSpecs: [],
    config: {
      maxConcurrentPRs: 3,
      maxRetries: 3,
      retryDelayMinutes: 5,
      autoMergeEnabled: true,
    },
    metrics: {
      totalProcessed: 0,
      successRate: 0,
      averageProcessingTime: 0,
      claudeInvocations: 0,
      costSavingsFromSkips: 0,
      manualInterventionCount: 0,
    },
  }

  // Extract all specs with spec IDs from spec files
  const allSpecs = yield* extractAllSpecs()

  // Add specs to initial state
  initialState.queue.pending = allSpecs

  // Write state file
  yield* Console.log(`\n📊 Summary:`)
  const uniqueFiles = new Set(allSpecs.map((s) => s.filePath))
  yield* Console.log(`  Total spec files with .fixme() tests: ${uniqueFiles.size}`)
  yield* Console.log(`  Total individual spec IDs: ${allSpecs.length}`)
  yield* Console.log(`  Spec ID format example: ${allSpecs[0]?.specId ?? 'N/A'}`)
  if (allSpecs.length > 0) {
    yield* Console.log(`\n📝 Sample specs queued:`)
    for (const spec of allSpecs.slice(0, 3)) {
      yield* Console.log(`  • ${spec.specId} (${spec.filePath})`)
      yield* Console.log(`    "${spec.testName}"`)
    }
  }

  yield* Console.log(`\n💾 Writing state file to ${STATE_FILE}...`)

  yield* Effect.tryPromise({
    try: async () => {
      await Bun.write(STATE_FILE, JSON.stringify(initialState, null, 2))
    },
    catch: (error) => new StateFileWriteError({ path: STATE_FILE, cause: error }),
  })

  yield* Console.log(`✅ Queue initialized successfully!`)

  yield* Console.log(`\n📋 Queue status:`)
  yield* Console.log(`  Pending: ${initialState.queue.pending.length}`)
  yield* Console.log(`  Active: ${initialState.queue.active.length}`)
  yield* Console.log(`  Completed: ${initialState.queue.completed.length}`)
  yield* Console.log(`  Failed: ${initialState.queue.failed.length}`)

  yield* Console.log(`\n🎯 Next steps:`)
  yield* Console.log(`  1. Review the queue in ${STATE_FILE}`)
  yield* Console.log(`  2. Trigger the orchestrator workflow manually:`)
  yield* Console.log(`     gh workflow run tdd-orchestrator.yml`)
  yield* Console.log(`  3. Or wait for the next test.yml completion to auto-trigger`)
})

// Run the program
Effect.runPromise(program).catch((error) => {
  console.error('Initialization failed:', error)
  process.exit(1)
})
