/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Command } from '@effect/cli'
import { BunContext, BunRuntime } from '@effect/platform-bun'
import { Effect, Console, Layer } from 'effect'
import { StateManager, StateManagerLive } from '../core/state-manager'
import { extractAllSpecs } from './spec-extractor'
import type { SpecQueueItem } from '../types'

const QueueInitializerCommand = Command.make('queue-initializer', {}, () =>
  Effect.gen(function* () {
    const stateManager = yield* StateManager

    // Extract all spec IDs from spec files
    const allSpecs = yield* extractAllSpecs()

    if (allSpecs.length === 0) {
      yield* Console.log(`\n✅ No specs with .fixme() found. Queue is already empty!`)
      return
    }

    // Load current state
    const state = yield* stateManager.load()

    // Add new specs to pending queue (avoid duplicates by spec ID)
    const existingSpecIds = new Set([
      ...state.queue.pending.map((s) => s.specId),
      ...state.queue.active.map((s) => s.specId),
      ...state.queue.completed.map((s) => s.specId),
      ...state.queue.failed.map((s) => s.specId),
    ])

    const newSpecs = allSpecs.filter((spec) => !existingSpecIds.has(spec.specId))

    if (newSpecs.length === 0) {
      yield* Console.log(`\n✅ All specs already in queue. Nothing to add.`)
      yield* Console.log(`\n📋 Queue status:`)
      yield* Console.log(`  Pending: ${state.queue.pending.length}`)
      yield* Console.log(`  Active: ${state.queue.active.length}`)
      yield* Console.log(`  Completed: ${state.queue.completed.length}`)
      yield* Console.log(`  Failed: ${state.queue.failed.length}`)
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

const cli = Command.run(QueueInitializerCommand, {
  name: 'queue-initializer',
  version: '1.0.0',
})

const AppLayer = Layer.mergeAll(BunContext.layer, StateManagerLive)

cli(process.argv).pipe(Effect.provide(AppLayer), BunRuntime.runMain)
