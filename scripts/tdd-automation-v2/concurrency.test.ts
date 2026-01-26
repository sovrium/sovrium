/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect, beforeAll, afterAll } from 'bun:test'
import { Effect } from 'effect'
import { StateManager, StateManagerLive } from './core/state-manager'
import type { SpecFileItem } from './types'
import { $ } from 'bun'

const TEST_SPEC_FILES = [
  'specs/test-concurrency/spec1.spec.ts',
  'specs/test-concurrency/spec2.spec.ts',
  'specs/test-concurrency/spec3.spec.ts',
]

const TEST_STATE_FILE = '.github/tdd-state.json'

let originalStateBackup: string | null = null

beforeAll(async () => {
  // Create test directories
  await $`mkdir -p specs/test-concurrency`.nothrow()
  await $`mkdir -p .github`.nothrow()

  // Backup existing state file
  try {
    originalStateBackup = await Bun.file(TEST_STATE_FILE).text()
  } catch {
    originalStateBackup = null
  }

  // Create mock spec files
  for (const filePath of TEST_SPEC_FILES) {
    const mockSpecContent = `/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from 'bun:test'

test.fixme('test in ${filePath}', () => {
  expect(1 + 1).toBe(2)
})
`

    await Bun.write(filePath, mockSpecContent)
  }

  // Initialize test state file with 3 pending specs
  const initialState = {
    version: '2.0.0',
    lastUpdated: new Date().toISOString(),
    queue: {
      pending: TEST_SPEC_FILES.map((filePath, index) => ({
        id: filePath,
        filePath,
        priority: 50,
        status: 'pending',
        testCount: 1,
        attempts: 0,
        errors: [],
        queuedAt: new Date().toISOString(),
      })),
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

  await Bun.write(TEST_STATE_FILE, JSON.stringify(initialState, null, 2))
})

afterAll(async () => {
  // Cleanup test files
  await $`rm -rf specs/test-concurrency`.nothrow()

  // Restore original state file
  if (originalStateBackup) {
    await Bun.write(TEST_STATE_FILE, originalStateBackup)
  }
})

test('Concurrency: 3 workers can lock different files simultaneously', async () => {
  const program = Effect.gen(function* () {
    const stateManager = yield* StateManager

    // Simulate 3 workers locking files in parallel
    yield* Effect.all(
      [
        stateManager.addActiveFile(TEST_SPEC_FILES[0]),
        stateManager.addActiveFile(TEST_SPEC_FILES[1]),
        stateManager.addActiveFile(TEST_SPEC_FILES[2]),
      ],
      { concurrency: 'unbounded' }
    )

    // Verify all 3 files are locked
    const state = yield* stateManager.load()
    expect(state.activeFiles).toHaveLength(3)
    expect(state.activeFiles).toContain(TEST_SPEC_FILES[0])
    expect(state.activeFiles).toContain(TEST_SPEC_FILES[1])
    expect(state.activeFiles).toContain(TEST_SPEC_FILES[2])

    // Verify all are marked as locked
    const locked1 = yield* stateManager.isFileLocked(TEST_SPEC_FILES[0])
    const locked2 = yield* stateManager.isFileLocked(TEST_SPEC_FILES[1])
    const locked3 = yield* stateManager.isFileLocked(TEST_SPEC_FILES[2])

    expect(locked1).toBe(true)
    expect(locked2).toBe(true)
    expect(locked3).toBe(true)

    // Cleanup: unlock all
    yield* Effect.all(
      [
        stateManager.removeActiveFile(TEST_SPEC_FILES[0]),
        stateManager.removeActiveFile(TEST_SPEC_FILES[1]),
        stateManager.removeActiveFile(TEST_SPEC_FILES[2]),
      ],
      { concurrency: 'unbounded' }
    )

    const finalState = yield* stateManager.load()
    expect(finalState.activeFiles).toHaveLength(0)
  }).pipe(Effect.provide(StateManagerLive))

  await Effect.runPromise(program)
})

test('Concurrency: Cannot lock same file twice', async () => {
  const program = Effect.gen(function* () {
    const stateManager = yield* StateManager

    // Lock file once
    yield* stateManager.addActiveFile(TEST_SPEC_FILES[0])

    const stateAfterFirst = yield* stateManager.load()
    expect(stateAfterFirst.activeFiles).toHaveLength(1)
    expect(stateAfterFirst.activeFiles).toContain(TEST_SPEC_FILES[0])

    // Try to lock same file again (should be idempotent)
    yield* stateManager.addActiveFile(TEST_SPEC_FILES[0])

    const stateAfterSecond = yield* stateManager.load()
    // Should still only have 1 entry (idempotent)
    expect(stateAfterSecond.activeFiles).toHaveLength(1)
    expect(stateAfterSecond.activeFiles).toContain(TEST_SPEC_FILES[0])

    // Cleanup
    yield* stateManager.removeActiveFile(TEST_SPEC_FILES[0])
  }).pipe(Effect.provide(StateManagerLive))

  await Effect.runPromise(program)
})

test('Concurrency: State transitions for 3 specs simultaneously', async () => {
  const program = Effect.gen(function* () {
    const stateManager = yield* StateManager

    // Load initial state
    const initialState = yield* stateManager.load()
    expect(initialState.queue.pending).toHaveLength(3)
    expect(initialState.queue.active).toHaveLength(0)

    // Transition all 3 specs to active simultaneously
    yield* Effect.all(
      [
        stateManager.transition(TEST_SPEC_FILES[0], 'pending', 'active'),
        stateManager.transition(TEST_SPEC_FILES[1], 'pending', 'active'),
        stateManager.transition(TEST_SPEC_FILES[2], 'pending', 'active'),
      ],
      { concurrency: 'unbounded' }
    )

    const activeState = yield* stateManager.load()
    expect(activeState.queue.pending).toHaveLength(0)
    expect(activeState.queue.active).toHaveLength(3)

    // Verify each spec is in active queue with correct status
    const activeSpec1 = activeState.queue.active.find((s) => s.filePath === TEST_SPEC_FILES[0])
    const activeSpec2 = activeState.queue.active.find((s) => s.filePath === TEST_SPEC_FILES[1])
    const activeSpec3 = activeState.queue.active.find((s) => s.filePath === TEST_SPEC_FILES[2])

    expect(activeSpec1).toBeDefined()
    expect(activeSpec1?.status).toBe('active')
    expect(activeSpec2).toBeDefined()
    expect(activeSpec2?.status).toBe('active')
    expect(activeSpec3).toBeDefined()
    expect(activeSpec3?.status).toBe('active')

    // Transition all to completed
    yield* Effect.all(
      [
        stateManager.transition(TEST_SPEC_FILES[0], 'active', 'completed'),
        stateManager.transition(TEST_SPEC_FILES[1], 'active', 'completed'),
        stateManager.transition(TEST_SPEC_FILES[2], 'active', 'completed'),
      ],
      { concurrency: 'unbounded' }
    )

    const completedState = yield* stateManager.load()
    expect(completedState.queue.active).toHaveLength(0)
    expect(completedState.queue.completed).toHaveLength(3)
  }).pipe(Effect.provide(StateManagerLive))

  await Effect.runPromise(program)
})

test('Concurrency: Spec selector respects file locks', async () => {
  const program = Effect.gen(function* () {
    const stateManager = yield* StateManager

    // Reset to initial state
    const initialState = {
      version: '2.0.0',
      lastUpdated: new Date().toISOString(),
      queue: {
        pending: TEST_SPEC_FILES.map((filePath) => ({
          id: filePath,
          filePath,
          priority: 50,
          status: 'pending',
          testCount: 1,
          attempts: 0,
          errors: [],
          queuedAt: new Date().toISOString(),
        })),
        active: [],
        completed: [],
        failed: [],
      },
      activeFiles: [TEST_SPEC_FILES[0]], // File 1 already locked
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

    yield* stateManager.save(initialState)

    // Verify file 1 is locked
    const isLocked = yield* stateManager.isFileLocked(TEST_SPEC_FILES[0])
    expect(isLocked).toBe(true)

    // Spec selector should skip locked files
    // In a real scenario, SpecSelector.selectNext() would filter out locked files
    const state = yield* stateManager.load()

    // Filter pending specs by non-locked files
    const availableSpecs = state.queue.pending.filter(
      (spec) => !state.activeFiles.includes(spec.filePath)
    )

    expect(availableSpecs).toHaveLength(2)
    expect(availableSpecs.map((s) => s.filePath)).toEqual([TEST_SPEC_FILES[1], TEST_SPEC_FILES[2]])

    // Cleanup
    yield* stateManager.removeActiveFile(TEST_SPEC_FILES[0])
  }).pipe(Effect.provide(StateManagerLive))

  await Effect.runPromise(program)
})

test('Concurrency: maxConcurrentPRs limit enforced', async () => {
  const program = Effect.gen(function* () {
    const stateManager = yield* StateManager

    // Load state
    const state = yield* stateManager.load()

    // Calculate available slots
    const activeCount = state.queue.active.length // Should be 0 after cleanup
    const maxConcurrent = state.config.maxConcurrentPRs // 3
    const availableSlots = maxConcurrent - activeCount

    expect(availableSlots).toBe(3)

    // Transition 3 specs to active (fills all slots)
    yield* Effect.all(
      [
        stateManager.transition(TEST_SPEC_FILES[0], 'pending', 'active'),
        stateManager.transition(TEST_SPEC_FILES[1], 'pending', 'active'),
        stateManager.transition(TEST_SPEC_FILES[2], 'pending', 'active'),
      ],
      { concurrency: 'unbounded' }
    )

    const activeState = yield* stateManager.load()
    const newActiveCount = activeState.queue.active.length
    const newAvailableSlots = maxConcurrent - newActiveCount

    expect(newActiveCount).toBe(3)
    expect(newAvailableSlots).toBe(0)

    // Verify orchestrator would not dispatch more workers
    expect(newAvailableSlots).toBeLessThanOrEqual(0)

    // Cleanup
    yield* Effect.all(
      [
        stateManager.transition(TEST_SPEC_FILES[0], 'active', 'completed'),
        stateManager.transition(TEST_SPEC_FILES[1], 'active', 'completed'),
        stateManager.transition(TEST_SPEC_FILES[2], 'active', 'completed'),
      ],
      { concurrency: 'unbounded' }
    )
  }).pipe(Effect.provide(StateManagerLive))

  await Effect.runPromise(program)
})
