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
import type { SpecQueueItem } from './types'

const TEST_SPEC_FILE = 'specs/test-integration/sample.spec.ts'
const TEST_STATE_FILE = `.github/tdd-state-test-worker-integration-${process.pid}-${Date.now()}-${Math.random().toString(36).substring(2)}.json`

let TestStateManagerLayer: ReturnType<typeof createTestStateManager>

beforeAll(async () => {
  // Create test StateManager layer
  TestStateManagerLayer = createTestStateManager(TEST_STATE_FILE)

  // Create test directories
  await $`mkdir -p specs/test-integration`.nothrow()
  await $`mkdir -p .github`.nothrow()

  // Create mock spec file with .fixme() tests
  const mockSpecContent = `/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from 'bun:test'

test.fixme('sample test that passes', () => {
  expect(1 + 1).toBe(2)
})

test.fixme('another passing test', () => {
  expect('hello').toBe('hello')
})
`

  await Bun.write(TEST_SPEC_FILE, mockSpecContent)

  // Initialize test state file
  const initialState = {
    version: '2.0.0',
    lastUpdated: new Date().toISOString(),
    queue: {
      pending: [
        {
          id: 'TEST-WORKER-001',
          specId: 'TEST-WORKER-001',
          filePath: TEST_SPEC_FILE,
          testName: 'should handle worker integration test',
          priority: 50,
          status: 'pending',
          attempts: 0,
          errors: [],
          queuedAt: new Date().toISOString(),
        },
      ],
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
  await $`rm -rf specs/test-integration`.nothrow()

  // Remove test state file
  await $`rm -f ${TEST_STATE_FILE}`.nothrow()
})

test('Integration: File locking workflow', async () => {
  const program = Effect.gen(function* () {
    const stateManager = yield* StateManager

    // 1. Lock the file (simulates worker start)
    yield* stateManager.addActiveFile(TEST_SPEC_FILE)

    const stateAfterLock = yield* stateManager.load()
    expect(stateAfterLock.activeFiles).toContain(TEST_SPEC_FILE)

    // 2. Verify file is locked (prevents concurrent processing)
    const isLocked = yield* stateManager.isFileLocked(TEST_SPEC_FILE)
    expect(isLocked).toBe(true)

    // 3. Unlock the file (simulates worker completion)
    yield* stateManager.removeActiveFile(TEST_SPEC_FILE)

    const stateAfterUnlock = yield* stateManager.load()
    expect(stateAfterUnlock.activeFiles).not.toContain(TEST_SPEC_FILE)
  }).pipe(Effect.provide(TestStateManagerLayer))

  await Effect.runPromise(program)
})

test('Integration: Pre-validation removes .fixme() and runs tests', async () => {
  // Read original content
  const originalContent = await Bun.file(TEST_SPEC_FILE).text()
  expect(originalContent).toContain('.fixme(')

  // Manually remove .fixme() for this test
  const cleanedContent = originalContent.replace(/\.fixme\(/g, '(')
  await Bun.write(TEST_SPEC_FILE, cleanedContent)

  // Verify .fixme() was removed
  const afterContent = await Bun.file(TEST_SPEC_FILE).text()
  expect(afterContent).not.toContain('.fixme(')

  // Run tests
  const testResult = await $`bun test ${TEST_SPEC_FILE}`.nothrow()
  expect(testResult.exitCode).toBe(0) // Tests should pass

  // Restore original content
  await Bun.write(TEST_SPEC_FILE, originalContent)
})

test('Integration: State transitions (pending → active → completed)', async () => {
  const program = Effect.gen(function* () {
    const stateManager = yield* StateManager

    // Load initial state
    const initialState = yield* stateManager.load()
    const spec = initialState.queue.pending.find((s) => s.filePath === TEST_SPEC_FILE)
    expect(spec).toBeDefined()
    expect(spec?.status).toBe('pending')

    // Transition to active (simulates worker picking up spec) - use spec ID not file path
    yield* stateManager.transition('TEST-WORKER-001', 'pending', 'active')

    const activeState = yield* stateManager.load()
    const activeSpec = activeState.queue.active.find((s) => s.filePath === TEST_SPEC_FILE)
    expect(activeSpec).toBeDefined()
    expect(activeSpec?.status).toBe('active')

    // Transition to completed (simulates successful PR merge) - use spec ID not file path
    yield* stateManager.transition('TEST-WORKER-001', 'active', 'completed')

    const completedState = yield* stateManager.load()
    const completedSpec = completedState.queue.completed.find((s) => s.filePath === TEST_SPEC_FILE)
    expect(completedSpec).toBeDefined()
    expect(completedSpec?.status).toBe('completed')
  }).pipe(Effect.provide(TestStateManagerLayer))

  await Effect.runPromise(program)
})

test('Integration: 3-strikes rule moves spec to manual intervention', async () => {
  const program = Effect.gen(function* () {
    const stateManager = yield* StateManager

    // Create a spec with 2 previous failures
    const specWith2Failures: SpecQueueItem = {
      id: 'TEST-WORKER-002',
      specId: 'TEST-WORKER-002',
      filePath: TEST_SPEC_FILE,
      testName: 'should test 3-strikes rule',
      priority: 50,
      status: 'active',
      attempts: 2,
      errors: [
        {
          timestamp: new Date().toISOString(),
          type: 'spec-failure',
          message: 'First failure',
        },
        {
          timestamp: new Date().toISOString(),
          type: 'spec-failure',
          message: 'Second failure',
        },
      ],
      queuedAt: new Date().toISOString(),
    }

    // Manually set state for this test
    const state = yield* stateManager.load()
    state.queue.active = [specWith2Failures]
    yield* stateManager.save(state)

    // Record 3rd failure (should move to manual intervention)
    const thirdError = {
      timestamp: new Date().toISOString(),
      type: 'spec-failure' as const,
      message: 'Third failure',
    }

    // This should trigger manual intervention - use file path (method searches by filePath)
    yield* stateManager.moveToManualIntervention(TEST_SPEC_FILE, {
      errors: [...specWith2Failures.errors, thirdError],
      failureReason: 'Failed 3 times due to spec-failure',
      requiresAction: 'Manual review required',
    })

    const finalState = yield* stateManager.load()
    const failedSpec = finalState.queue.failed.find((s) => s.filePath === TEST_SPEC_FILE)

    expect(failedSpec).toBeDefined()
    expect(failedSpec?.status).toBe('failed')
    expect(failedSpec?.attempts).toBe(2) // Still shows 2 attempts before failure
    expect(finalState.metrics.manualInterventionCount).toBe(1)
  }).pipe(Effect.provide(TestStateManagerLayer))

  await Effect.runPromise(program)
})

test('Integration: Fast-path detection (tests already pass)', async () => {
  // Create a spec file with passing tests (no .fixme())
  const passingSpecContent = `/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from 'bun:test'

test('passing test', () => {
  expect(1 + 1).toBe(2)
})
`

  const fastPathFile = 'specs/test-integration/fast-path.spec.ts'
  await Bun.write(fastPathFile, passingSpecContent)

  // Run tests
  const testResult = await $`bun test ${fastPathFile}`.nothrow()

  // Tests should pass (exit code 0)
  expect(testResult.exitCode).toBe(0)

  // In the real workflow, this would trigger the fast-path:
  // - Skip Claude invocation
  // - Create PR with "Fast Path" label
  // - Auto-merge immediately

  // Cleanup
  await $`rm -f ${fastPathFile}`.nothrow()
})
