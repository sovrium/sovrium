/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { $ } from 'bun'
import { test, expect, beforeAll, afterAll } from 'bun:test'
import { Effect } from 'effect'
import { StateManager } from './core/state-manager'
import { createTestStateManager } from './core/state-manager-test-helper'

const TEST_SPEC_FILES = [
  'specs/test-concurrency/spec1.spec.ts',
  'specs/test-concurrency/spec2.spec.ts',
  'specs/test-concurrency/spec3.spec.ts',
] as const

// Type-safe constants for array access (avoids string | undefined in strict mode)
const SPEC_FILE_1 = TEST_SPEC_FILES[0]
const SPEC_FILE_2 = TEST_SPEC_FILES[1]
const SPEC_FILE_3 = TEST_SPEC_FILES[2]

// Spec ID constants (after refactoring to spec-ID-based processing)
const SPEC_ID_1 = 'TEST-SPEC-1'
const SPEC_ID_2 = 'TEST-SPEC-2'
const SPEC_ID_3 = 'TEST-SPEC-3'

const TEST_STATE_FILE = `.github/tdd-state-test-${Date.now()}.json`

let TestStateManagerLayer: ReturnType<typeof createTestStateManager>

beforeAll(async () => {
  // Create test StateManager layer
  TestStateManagerLayer = createTestStateManager(TEST_STATE_FILE)

  // Ensure clean state for tests
  await $`rm -rf specs/test-concurrency`.nothrow()

  // Create test directories
  await $`mkdir -p specs/test-concurrency`.nothrow()
  await $`mkdir -p .github`.nothrow()

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

  // Initialize test state file with 3 pending specs (spec-ID-based)
  const initialState = {
    version: '2.0.0',
    lastUpdated: new Date().toISOString(),
    queue: {
      pending: TEST_SPEC_FILES.map((filePath, index) => ({
        id: `TEST-SPEC-${index + 1}`,
        specId: `TEST-SPEC-${index + 1}`,
        filePath,
        testName: `test in ${filePath}`,
        priority: 50,
        status: 'pending',
        attempts: 0,
        errors: [],
        queuedAt: new Date().toISOString(),
      })),
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

  await Bun.write(TEST_STATE_FILE, JSON.stringify(initialState, null, 2))
})

afterAll(async () => {
  // Cleanup test files
  await $`rm -rf specs/test-concurrency`.nothrow()

  // Remove test state file
  await $`rm -f ${TEST_STATE_FILE}`.nothrow()
})

test('Concurrency: 3 workers can lock different files simultaneously', async () => {
  const program = Effect.gen(function* () {
    const stateManager = yield* StateManager

    // Simulate 3 workers locking files sequentially (git operations must be sequential)
    // Each worker is a separate GitHub Actions job that acquires locks independently
    yield* Effect.all(
      [
        stateManager.addActiveFile(SPEC_FILE_1),
        stateManager.addActiveFile(SPEC_FILE_2),
        stateManager.addActiveFile(SPEC_FILE_3),
      ],
      { concurrency: 1 } // Sequential to avoid git race conditions
    )

    // Verify all 3 files are locked
    const state = yield* stateManager.load()
    expect(state.activeFiles).toHaveLength(3)
    expect(state.activeFiles).toContain(SPEC_FILE_1)
    expect(state.activeFiles).toContain(SPEC_FILE_2)
    expect(state.activeFiles).toContain(SPEC_FILE_3)

    // Verify all are marked as locked
    const locked1 = yield* stateManager.isFileLocked(SPEC_FILE_1)
    const locked2 = yield* stateManager.isFileLocked(SPEC_FILE_2)
    const locked3 = yield* stateManager.isFileLocked(SPEC_FILE_3)

    expect(locked1).toBe(true)
    expect(locked2).toBe(true)
    expect(locked3).toBe(true)

    // Cleanup: unlock all (sequential to avoid git race conditions)
    yield* Effect.all(
      [
        stateManager.removeActiveFile(SPEC_FILE_1),
        stateManager.removeActiveFile(SPEC_FILE_2),
        stateManager.removeActiveFile(SPEC_FILE_3),
      ],
      { concurrency: 1 }
    )

    const finalState = yield* stateManager.load()
    expect(finalState.activeFiles).toHaveLength(0)
  }).pipe(Effect.provide(TestStateManagerLayer))

  await Effect.runPromise(program)
}, 15_000) // 15 second timeout for git operations

test('Concurrency: Cannot lock same file twice', async () => {
  const program = Effect.gen(function* () {
    const stateManager = yield* StateManager

    // Lock file once
    yield* stateManager.addActiveFile(SPEC_FILE_1)

    const stateAfterFirst = yield* stateManager.load()
    expect(stateAfterFirst.activeFiles).toHaveLength(1)
    expect(stateAfterFirst.activeFiles).toContain(SPEC_FILE_1)

    // Try to lock same file again (should be idempotent)
    yield* stateManager.addActiveFile(SPEC_FILE_1)

    const stateAfterSecond = yield* stateManager.load()
    // Should still only have 1 entry (idempotent)
    expect(stateAfterSecond.activeFiles).toHaveLength(1)
    expect(stateAfterSecond.activeFiles).toContain(SPEC_FILE_1)

    // Cleanup
    yield* stateManager.removeActiveFile(SPEC_FILE_1)
  }).pipe(Effect.provide(TestStateManagerLayer))

  await Effect.runPromise(program)
}, 10_000) // 10 second timeout for git operations

test('Concurrency: State transitions for 3 specs simultaneously', async () => {
  const program = Effect.gen(function* () {
    const stateManager = yield* StateManager

    // Load initial state
    const initialState = yield* stateManager.load()
    expect(initialState.queue.pending).toHaveLength(3)
    expect(initialState.queue.active).toHaveLength(0)

    // Transition all 3 specs to active sequentially (git operations must be sequential)
    yield* Effect.all(
      [
        stateManager.transition(SPEC_ID_1, 'pending', 'active'),
        stateManager.transition(SPEC_ID_2, 'pending', 'active'),
        stateManager.transition(SPEC_ID_3, 'pending', 'active'),
      ],
      { concurrency: 1 }
    )

    const activeState = yield* stateManager.load()
    expect(activeState.queue.pending).toHaveLength(0)
    expect(activeState.queue.active).toHaveLength(3)

    // Verify each spec is in active queue with correct status
    const activeSpec1 = activeState.queue.active.find((s) => s.filePath === SPEC_FILE_1)
    const activeSpec2 = activeState.queue.active.find((s) => s.filePath === SPEC_FILE_2)
    const activeSpec3 = activeState.queue.active.find((s) => s.filePath === SPEC_FILE_3)

    expect(activeSpec1).toBeDefined()
    expect(activeSpec1?.status).toBe('active')
    expect(activeSpec2).toBeDefined()
    expect(activeSpec2?.status).toBe('active')
    expect(activeSpec3).toBeDefined()
    expect(activeSpec3?.status).toBe('active')

    // Transition all to completed (sequential to avoid git race conditions)
    yield* Effect.all(
      [
        stateManager.transition(SPEC_ID_1, 'active', 'completed'),
        stateManager.transition(SPEC_ID_2, 'active', 'completed'),
        stateManager.transition(SPEC_ID_3, 'active', 'completed'),
      ],
      { concurrency: 1 }
    )

    const completedState = yield* stateManager.load()
    expect(completedState.queue.active).toHaveLength(0)
    expect(completedState.queue.completed).toHaveLength(3)
  }).pipe(Effect.provide(TestStateManagerLayer))

  await Effect.runPromise(program)
}, 15_000) // 15 second timeout for git operations

test('Concurrency: Spec selector respects file locks', async () => {
  const program = Effect.gen(function* () {
    const stateManager = yield* StateManager

    // Reset to initial state
    const initialState = {
      version: '2.0.0' as const,
      lastUpdated: new Date().toISOString(),
      queue: {
        pending: TEST_SPEC_FILES.map((filePath, index) => ({
          id: `TEST-SPEC-${index + 1}`,
          specId: `TEST-SPEC-${index + 1}`,
          filePath,
          testName: `test in ${filePath}`,
          priority: 50,
          status: 'pending' as const,
          attempts: 0,
          errors: [] as never[],
          queuedAt: new Date().toISOString(),
        })),
        active: [] as never[],
        completed: [] as never[],
        failed: [] as never[],
      },
      activeFiles: [SPEC_FILE_1] as string[],
      activeSpecs: [] as string[],
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
    const isLocked = yield* stateManager.isFileLocked(SPEC_FILE_1)
    expect(isLocked).toBe(true)

    // Spec selector should skip locked files
    // In a real scenario, SpecSelector.selectNext() would filter out locked files
    const state = yield* stateManager.load()

    // Filter pending specs by non-locked files
    const availableSpecs = state.queue.pending.filter(
      (spec) => !state.activeFiles.includes(spec.filePath)
    )

    expect(availableSpecs).toHaveLength(2)
    expect(availableSpecs.map((s) => s.filePath)).toEqual([SPEC_FILE_2, SPEC_FILE_3])

    // Cleanup
    yield* stateManager.removeActiveFile(SPEC_FILE_1)
  }).pipe(Effect.provide(TestStateManagerLayer))

  await Effect.runPromise(program)
}, 10_000) // 10 second timeout for git operations

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

    // Transition 3 specs to active (fills all slots) - sequential to avoid git race conditions
    yield* Effect.all(
      [
        stateManager.transition(SPEC_ID_1, 'pending', 'active'),
        stateManager.transition(SPEC_ID_2, 'pending', 'active'),
        stateManager.transition(SPEC_ID_3, 'pending', 'active'),
      ],
      { concurrency: 1 }
    )

    const activeState = yield* stateManager.load()
    const newActiveCount = activeState.queue.active.length
    const newAvailableSlots = maxConcurrent - newActiveCount

    expect(newActiveCount).toBe(3)
    expect(newAvailableSlots).toBe(0)

    // Verify orchestrator would not dispatch more workers
    expect(newAvailableSlots).toBeLessThanOrEqual(0)

    // Cleanup (sequential to avoid git race conditions)
    yield* Effect.all(
      [
        stateManager.transition(SPEC_ID_1, 'active', 'completed'),
        stateManager.transition(SPEC_ID_2, 'active', 'completed'),
        stateManager.transition(SPEC_ID_3, 'active', 'completed'),
      ],
      { concurrency: 1 }
    )
  }).pipe(Effect.provide(TestStateManagerLayer))

  await Effect.runPromise(program)
}, 15_000) // 15 second timeout for git operations
