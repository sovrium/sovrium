#!/usr/bin/env bun

/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Initialize TDD Queue V2
 *
 * This script initializes the TDD automation queue by:
 * 1. Creating initial state file if it doesn't exist
 * 2. Scanning codebase for specs with .fixme() tests
 * 3. Adding specs to pending queue
 *
 * Usage:
 *   bun run scripts/tdd-automation-v2/initialize-queue.ts
 *   bun run scripts/tdd-automation-v2/initialize-queue.ts --reset  # Reset state file
 */

import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { Effect, Console } from 'effect'
import { glob } from 'glob'
import type { TDDState, SpecFileItem } from './types'

const STATE_FILE = '.github/tdd-state.json'

const program = Effect.gen(function* () {
  const reset = process.argv.includes('--reset')

  yield* Console.log('')
  yield* Console.log('═══════════════════════════════════════════════')
  yield* Console.log('  TDD Queue V2 - Initialization Tool')
  yield* Console.log('═══════════════════════════════════════════════')
  yield* Console.log('')

  yield* Console.log('🚀 Initializing TDD Queue V2...')

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

  // Scan for spec files
  yield* Console.log('🔍 Scanning for spec files with .fixme() tests...')

  const specFiles = yield* Effect.tryPromise({
    try: () => glob('specs/**/*.spec.ts'),
    catch: (error) => new Error(`Failed to scan spec files: ${error}`),
  })

  yield* Console.log(`📁 Found ${specFiles.length} spec file(s)`)

  // Scan each file for .fixme() tests
  const specsWithFixme: SpecFileItem[] = []

  for (const filePath of specFiles) {
    const content = yield* Effect.tryPromise({
      try: () => readFile(filePath, 'utf-8'),
      catch: (error) => new Error(`Failed to read ${filePath}: ${error}`),
    })

    // Count .fixme( occurrences (not .fixme() to match actual usage)
    const fixmeMatches = content.match(/\.fixme\(/g)
    const fixmeCount = fixmeMatches ? fixmeMatches.length : 0

    if (fixmeCount > 0) {
      // Calculate path depth for priority
      const pathDepth = filePath.split('/').length

      const specItem: SpecFileItem = {
        id: filePath,
        filePath,
        priority: 50, // Base priority, will be calculated by selector
        status: 'pending',
        testCount: fixmeCount,
        attempts: 0,
        errors: [],
        queuedAt: new Date().toISOString(),
      }

      specsWithFixme.push(specItem)

      yield* Console.log(
        `  ✓ ${filePath}: ${fixmeCount} test(s) with .fixme() (depth: ${pathDepth})`
      )
    }
  }

  // Add specs to initial state
  initialState.queue.pending = specsWithFixme

  // Write state file
  yield* Console.log(`\n📊 Summary:`)
  yield* Console.log(`  Total spec files scanned: ${specFiles.length}`)
  yield* Console.log(`  Specs with .fixme() tests: ${specsWithFixme.length}`)
  yield* Console.log(
    `  Total .fixme() tests: ${specsWithFixme.reduce((sum, spec) => sum + spec.testCount, 0)}`
  )

  yield* Console.log(`\n💾 Writing state file to ${STATE_FILE}...`)

  yield* Effect.tryPromise({
    try: async () => {
      await Bun.write(STATE_FILE, JSON.stringify(initialState, null, 2))
    },
    catch: (error) => new Error(`Failed to write state file: ${error}`),
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
  yield* Console.log(`     gh workflow run tdd-orchestrator-v2.yml`)
  yield* Console.log(`  3. Or wait for the next test.yml completion to auto-trigger`)
})

// Run the program
Effect.runPromise(program).catch((error) => {
  console.error('Initialization failed:', error)
  process.exit(1)
})
