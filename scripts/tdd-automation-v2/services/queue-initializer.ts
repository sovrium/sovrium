/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Console } from 'effect'
import { Command } from '@effect/cli'
import { StateManager, StateManagerLive } from '../core/state-manager'
import type { SpecFileItem } from '../types'
import { glob } from 'glob'
import { readFile } from 'node:fs/promises'

const QueueInitializerCommand = Command.make('queue-initializer', {}, () =>
  Effect.gen(function* () {
    yield* Console.log('🔍 Scanning for spec files with .fixme() tests...')

    const stateManager = yield* StateManager

    // Find all .spec.ts files
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

      // Count .fixme() occurrences
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

    yield* Console.log(`\n📊 Summary:`)
    yield* Console.log(`  Total spec files scanned: ${specFiles.length}`)
    yield* Console.log(`  Specs with .fixme() tests: ${specsWithFixme.length}`)
    yield* Console.log(
      `  Total .fixme() tests: ${specsWithFixme.reduce((sum, spec) => sum + spec.testCount, 0)}`
    )

    if (specsWithFixme.length === 0) {
      yield* Console.log(`\n✅ No specs with .fixme() found. Queue is already empty!`)
      return
    }

    // Load current state
    const state = yield* stateManager.load()

    // Add new specs to pending queue (avoid duplicates)
    const existingPaths = new Set([
      ...state.queue.pending.map((s) => s.filePath),
      ...state.queue.active.map((s) => s.filePath),
      ...state.queue.completed.map((s) => s.filePath),
      ...state.queue.failed.map((s) => s.filePath),
    ])

    const newSpecs = specsWithFixme.filter((spec) => !existingPaths.has(spec.filePath))

    if (newSpecs.length === 0) {
      yield* Console.log(`\n✅ All specs already in queue. Nothing to add.`)
      return
    }

    yield* Console.log(`\n📥 Adding ${newSpecs.length} new spec(s) to queue...`)

    // Update state with new specs
    state.queue.pending.push(...newSpecs)
    yield* stateManager.save(state)

    yield* Console.log(`✅ Queue initialized successfully!`)
    yield* Console.log(`\n📋 Queue status:`)
    yield* Console.log(`  Pending: ${state.queue.pending.length}`)
    yield* Console.log(`  Active: ${state.queue.active.length}`)
    yield* Console.log(`  Completed: ${state.queue.completed.length}`)
    yield* Console.log(`  Failed: ${state.queue.failed.length}`)
  })
)

const program = QueueInitializerCommand.pipe(Effect.provide(StateManagerLive))

Effect.runPromise(program).catch((error) => {
  console.error('Queue initializer failed:', error)
  process.exit(1)
})
