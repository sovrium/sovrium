/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect, describe } from 'bun:test'
import { Effect, Layer } from 'effect'
import { INITIAL_STATE } from '../types'
import {
  PriorityCalculator,
  PriorityCalculatorLive,
  SpecSelector,
  SpecSelectorLive,
} from './spec-selector'
import type { TDDState, SpecQueueItem } from '../types'

// Merge layers for single provide call in tests
const TestLayer = Layer.mergeAll(SpecSelectorLive, PriorityCalculatorLive)

// Helper function to create mock spec item
const createMockSpec = (overrides: Partial<SpecQueueItem>): SpecQueueItem => ({
  id: 'TEST-SPEC-001',
  specId: 'TEST-SPEC-001',
  filePath: 'specs/api/test.spec.ts',
  testName: 'should test default behavior',
  priority: 50,
  status: 'pending',
  attempts: 0,
  errors: [],
  queuedAt: new Date().toISOString(),
  ...overrides,
})

describe('PriorityCalculator', () => {
  test('calculates base score of 50 for default spec', async () => {
    const program = Effect.gen(function* () {
      const calculator = yield* PriorityCalculator

      const spec = createMockSpec({
        priority: 50, // Default priority (no bonus/penalty)
        attempts: 0,
        filePath: 'specs/api/users/profile.spec.ts', // Depth 4 (no bonus/penalty)
      })

      const priority = calculator.calculate(spec)

      // Base 50 + 0 (depth 4) + 0 (priority 50) + 20 (0 attempts) = 70
      expect(priority).toBe(70)
    }).pipe(Effect.provide(PriorityCalculatorLive))

    await Effect.runPromise(program)
  })

  test('uses pre-calculated spec priority from extractor', async () => {
    const program = Effect.gen(function* () {
      const calculator = yield* PriorityCalculator

      const spec1 = createMockSpec({ priority: 70, attempts: 0 }) // Higher priority
      const spec2 = createMockSpec({ priority: 50, attempts: 0 }) // Medium priority
      const spec3 = createMockSpec({ priority: 30, attempts: 0 }) // Lower priority

      const priority1 = calculator.calculate(spec1)
      const priority2 = calculator.calculate(spec2)
      const priority3 = calculator.calculate(spec3)

      // spec1: Base 50 + 15 (depth 3) + 10 (priority 70-50*0.5) + 20 (0 attempts) = 95
      // spec2: Base 50 + 15 (depth 3) + 0 (priority 50-50*0.5) + 20 (0 attempts) = 85
      // spec3: Base 50 + 15 (depth 3) - 10 (priority 30-50*0.5) + 20 (0 attempts) = 75

      expect(priority1).toBe(95)
      expect(priority2).toBe(85)
      expect(priority3).toBe(75)
      expect(priority1).toBeGreaterThan(priority2)
      expect(priority2).toBeGreaterThan(priority3)
    }).pipe(Effect.provide(PriorityCalculatorLive))

    await Effect.runPromise(program)
  })

  test('prioritizes specs with fewer failure attempts', async () => {
    const program = Effect.gen(function* () {
      const calculator = yield* PriorityCalculator

      const spec1 = createMockSpec({ attempts: 0, priority: 50 })
      const spec2 = createMockSpec({ attempts: 1, priority: 50 })
      const spec3 = createMockSpec({ attempts: 2, priority: 50 })

      const priority1 = calculator.calculate(spec1)
      const priority2 = calculator.calculate(spec2)
      const priority3 = calculator.calculate(spec3)

      // spec1: Base 50 + 15 (depth 3) + 0 (priority 50) + 20 (0 attempts) = 85
      // spec2: Base 50 + 15 (depth 3) + 0 (priority 50) + 10 (1 attempt) = 75
      // spec3: Base 50 + 15 (depth 3) + 0 (priority 50) - 10 (2 attempts) = 55

      expect(priority1).toBe(85)
      expect(priority2).toBe(75)
      expect(priority3).toBe(55)
      expect(priority1).toBeGreaterThan(priority2)
      expect(priority2).toBeGreaterThan(priority3)
    }).pipe(Effect.provide(PriorityCalculatorLive))

    await Effect.runPromise(program)
  })

  test('prioritizes shallower paths (foundational files)', async () => {
    const program = Effect.gen(function* () {
      const calculator = yield* PriorityCalculator

      const spec1 = createMockSpec({
        filePath: 'specs/api/users.spec.ts', // Depth 3
        priority: 50,
        attempts: 0,
      })

      const spec2 = createMockSpec({
        filePath: 'specs/api/users/profile.spec.ts', // Depth 4
        priority: 50,
        attempts: 0,
      })

      const spec3 = createMockSpec({
        filePath: 'specs/api/users/profile/settings.spec.ts', // Depth 5
        priority: 50,
        attempts: 0,
      })

      const priority1 = calculator.calculate(spec1)
      const priority2 = calculator.calculate(spec2)
      const priority3 = calculator.calculate(spec3)

      // spec1: Base 50 + 15 (depth 3) + 0 (priority 50) + 20 (0 attempts) = 85
      // spec2: Base 50 + 0 (depth 4) + 0 (priority 50) + 20 (0 attempts) = 70
      // spec3: Base 50 - 15 (depth 5) + 0 (priority 50) + 20 (0 attempts) = 55

      expect(priority1).toBe(85)
      expect(priority2).toBe(70)
      expect(priority3).toBe(55)
      expect(priority1).toBeGreaterThan(priority2)
      expect(priority2).toBeGreaterThan(priority3)
    }).pipe(Effect.provide(PriorityCalculatorLive))

    await Effect.runPromise(program)
  })

  test('deprioritizes specs with infrastructure errors', async () => {
    const program = Effect.gen(function* () {
      const calculator = yield* PriorityCalculator

      const spec1 = createMockSpec({
        attempts: 1,
        priority: 50,
        errors: [
          {
            timestamp: new Date().toISOString(),
            type: 'infrastructure',
            message: 'GitHub API timeout',
          },
        ],
      })

      const spec2 = createMockSpec({
        attempts: 1,
        priority: 50,
        errors: [
          {
            timestamp: new Date().toISOString(),
            type: 'regression',
            message: 'Caused other tests to fail',
          },
        ],
      })

      const spec3 = createMockSpec({
        attempts: 1,
        priority: 50,
        errors: [
          {
            timestamp: new Date().toISOString(),
            type: 'spec-failure',
            message: 'Test failed',
          },
        ],
      })

      const priority1 = calculator.calculate(spec1)
      const priority2 = calculator.calculate(spec2)
      const priority3 = calculator.calculate(spec3)

      // spec1: Base 50 + 15 (depth 3) + 0 (priority 50) + 10 (1 attempt) - 25 (infrastructure) = 50
      // spec2: Base 50 + 15 (depth 3) + 0 (priority 50) + 10 (1 attempt) - 15 (regression) = 60
      // spec3: Base 50 + 15 (depth 3) + 0 (priority 50) + 10 (1 attempt) + 0 (spec failure) = 75

      expect(priority1).toBe(50)
      expect(priority2).toBe(60)
      expect(priority3).toBe(75)
      expect(priority3).toBeGreaterThan(priority2)
      expect(priority2).toBeGreaterThan(priority1)
    }).pipe(Effect.provide(PriorityCalculatorLive))

    await Effect.runPromise(program)
  })

  test('clamps priority score to 0-100 range', async () => {
    const program = Effect.gen(function* () {
      const calculator = yield* PriorityCalculator

      // Extreme high score
      const specHigh = createMockSpec({
        priority: 70,
        attempts: 0,
        filePath: 'specs/api/test.spec.ts', // depth 3
      })

      // Extreme low score
      const specLow = createMockSpec({
        priority: 50,
        attempts: 2,
        filePath: 'specs/api/a/b/c/d/e.spec.ts', // depth 6
        errors: [
          {
            timestamp: new Date().toISOString(),
            type: 'infrastructure',
            message: 'Error',
          },
        ],
      })

      const priorityHigh = calculator.calculate(specHigh)
      const priorityLow = calculator.calculate(specLow)

      // High: Base 50 + 15 (depth 3) + 10 (priority 70) + 20 (0 attempts) = 95 (within range)
      // Low: Base 50 - 15 (depth 6) + 0 (priority 50) - 10 (2 attempts) - 25 (infrastructure) = 0 (clamped)

      expect(priorityHigh).toBeGreaterThanOrEqual(0)
      expect(priorityHigh).toBeLessThanOrEqual(100)
      expect(priorityLow).toBeGreaterThanOrEqual(0)
      expect(priorityLow).toBeLessThanOrEqual(100)
    }).pipe(Effect.provide(PriorityCalculatorLive))

    await Effect.runPromise(program)
  })
})

describe('SpecSelector', () => {
  test('returns empty array when queue is empty', async () => {
    const program = Effect.gen(function* () {
      const selector = yield* SpecSelector

      const state: TDDState = {
        ...INITIAL_STATE,
        queue: {
          pending: [],
          active: [],
          completed: [],
          failed: [],
        },
      }

      const selected = yield* selector.selectNext(3, state)

      expect(selected).toEqual([])
    }).pipe(Effect.provide(TestLayer))

    await Effect.runPromise(program)
  })

  test('filters out specs at max retries (3 strikes rule)', async () => {
    const program = Effect.gen(function* () {
      const selector = yield* SpecSelector

      const state: TDDState = {
        ...INITIAL_STATE,
        queue: {
          pending: [
            createMockSpec({
              id: 'specs/api/test1.spec.ts',
              filePath: 'specs/api/test1.spec.ts',
              attempts: 2, // Eligible
            }),
            createMockSpec({
              id: 'specs/api/test2.spec.ts',
              filePath: 'specs/api/test2.spec.ts',
              attempts: 3, // Max retries, should be filtered out
            }),
          ],
          active: [],
          completed: [],
          failed: [],
        },
        config: {
          ...INITIAL_STATE.config,
          maxRetries: 3,
        },
      }

      const selected = yield* selector.selectNext(10, state)

      expect(selected).toHaveLength(1)
      expect(selected[0]?.filePath).toBe('specs/api/test1.spec.ts')
    }).pipe(Effect.provide(TestLayer))

    await Effect.runPromise(program)
  })

  test('filters out specs with locked files', async () => {
    const program = Effect.gen(function* () {
      const selector = yield* SpecSelector

      const state: TDDState = {
        ...INITIAL_STATE,
        queue: {
          pending: [
            createMockSpec({
              id: 'specs/api/test1.spec.ts',
              filePath: 'specs/api/test1.spec.ts',
            }),
            createMockSpec({
              id: 'specs/api/test2.spec.ts',
              filePath: 'specs/api/test2.spec.ts',
            }),
          ],
          active: [],
          completed: [],
          failed: [],
        },
        activeFiles: ['specs/api/test1.spec.ts'], // File is locked
      }

      const selected = yield* selector.selectNext(10, state)

      expect(selected).toHaveLength(1)
      expect(selected[0]?.filePath).toBe('specs/api/test2.spec.ts')
    }).pipe(Effect.provide(TestLayer))

    await Effect.runPromise(program)
  })

  test('filters out specs in cooldown period', async () => {
    const program = Effect.gen(function* () {
      const selector = yield* SpecSelector

      const now = Date.now()
      const recentAttempt = new Date(now - 2 * 60 * 1000).toISOString() // 2 minutes ago
      const oldAttempt = new Date(now - 10 * 60 * 1000).toISOString() // 10 minutes ago

      const state: TDDState = {
        ...INITIAL_STATE,
        queue: {
          pending: [
            createMockSpec({
              id: 'specs/api/test1.spec.ts',
              filePath: 'specs/api/test1.spec.ts',
              attempts: 1,
              lastAttempt: recentAttempt, // Still in cooldown
            }),
            createMockSpec({
              id: 'specs/api/test2.spec.ts',
              filePath: 'specs/api/test2.spec.ts',
              attempts: 1,
              lastAttempt: oldAttempt, // Out of cooldown
            }),
          ],
          active: [],
          completed: [],
          failed: [],
        },
        config: {
          ...INITIAL_STATE.config,
          retryDelayMinutes: 5, // 5 minute cooldown
        },
      }

      const selected = yield* selector.selectNext(10, state)

      expect(selected).toHaveLength(1)
      expect(selected[0]?.filePath).toBe('specs/api/test2.spec.ts')
    }).pipe(Effect.provide(TestLayer))

    await Effect.runPromise(program)
  })

  test('selects specs ordered by priority (highest first)', async () => {
    const program = Effect.gen(function* () {
      const selector = yield* SpecSelector

      const state: TDDState = {
        ...INITIAL_STATE,
        queue: {
          pending: [
            createMockSpec({
              id: 'TEST-SPEC-1',
              specId: 'TEST-SPEC-1',
              filePath: 'specs/api/test1.spec.ts',
              priority: 30, // Lower priority
              attempts: 0,
            }),
            createMockSpec({
              id: 'TEST-SPEC-2',
              specId: 'TEST-SPEC-2',
              filePath: 'specs/api/test2.spec.ts',
              priority: 70, // Higher priority
              attempts: 0,
            }),
            createMockSpec({
              id: 'TEST-SPEC-3',
              specId: 'TEST-SPEC-3',
              filePath: 'specs/api/test3.spec.ts',
              priority: 50, // Medium priority
              attempts: 0,
            }),
          ],
          active: [],
          completed: [],
          failed: [],
        },
      }

      const selected = yield* selector.selectNext(2, state)

      expect(selected).toHaveLength(2)
      expect(selected[0]?.filePath).toBe('specs/api/test2.spec.ts') // Highest priority
      expect(selected[1]?.filePath).toBe('specs/api/test3.spec.ts') // Second highest
    }).pipe(Effect.provide(TestLayer))

    await Effect.runPromise(program)
  })

  test('respects count limit when selecting specs', async () => {
    const program = Effect.gen(function* () {
      const selector = yield* SpecSelector

      const state: TDDState = {
        ...INITIAL_STATE,
        queue: {
          pending: [
            createMockSpec({ id: 'test1', filePath: 'test1' }),
            createMockSpec({ id: 'test2', filePath: 'test2' }),
            createMockSpec({ id: 'test3', filePath: 'test3' }),
            createMockSpec({ id: 'test4', filePath: 'test4' }),
            createMockSpec({ id: 'test5', filePath: 'test5' }),
          ],
          active: [],
          completed: [],
          failed: [],
        },
      }

      const selected = yield* selector.selectNext(3, state)

      expect(selected).toHaveLength(3)
    }).pipe(Effect.provide(TestLayer))

    await Effect.runPromise(program)
  })

  test('handles all eligibility filters together', async () => {
    const program = Effect.gen(function* () {
      const selector = yield* SpecSelector

      const now = Date.now()
      const recentAttempt = new Date(now - 2 * 60 * 1000).toISOString()

      const state: TDDState = {
        ...INITIAL_STATE,
        queue: {
          pending: [
            createMockSpec({
              id: 'test1',
              specId: 'test1',
              filePath: 'test1',
              attempts: 3, // Max retries - FILTERED
              priority: 70,
            }),
            createMockSpec({
              id: 'test2',
              specId: 'test2',
              filePath: 'test2',
              attempts: 1,
              lastAttempt: recentAttempt, // In cooldown - FILTERED
              priority: 60,
            }),
            createMockSpec({
              id: 'test3',
              specId: 'test3',
              filePath: 'test3', // File locked - FILTERED
              attempts: 0,
              priority: 55,
            }),
            createMockSpec({
              id: 'test4',
              specId: 'test4',
              filePath: 'test4', // ELIGIBLE
              attempts: 1,
              priority: 65,
            }),
            createMockSpec({
              id: 'test5',
              specId: 'test5',
              filePath: 'test5', // ELIGIBLE
              attempts: 0,
              priority: 50,
            }),
          ],
          active: [],
          completed: [],
          failed: [],
        },
        activeFiles: ['test3'],
        config: {
          ...INITIAL_STATE.config,
          maxRetries: 3,
          retryDelayMinutes: 5,
        },
      }

      const selected = yield* selector.selectNext(10, state)

      expect(selected).toHaveLength(2)
      // test4 has higher calculated priority than test5 due to priority field
      expect(selected.map((s) => s.filePath)).toContain('test4')
      expect(selected.map((s) => s.filePath)).toContain('test5')
    }).pipe(Effect.provide(TestLayer))

    await Effect.runPromise(program)
  })

  test('STRICT FILE-LEVEL EXCLUSIVITY: selects only ONE spec per file', async () => {
    const program = Effect.gen(function* () {
      const selector = yield* SpecSelector

      // Multiple specs from the SAME file - only ONE should be selected
      const state: TDDState = {
        ...INITIAL_STATE,
        queue: {
          pending: [
            createMockSpec({
              id: 'API-TABLES-001',
              specId: 'API-TABLES-001',
              filePath: 'specs/api/tables.spec.ts', // Same file
              priority: 70,
              attempts: 0,
            }),
            createMockSpec({
              id: 'API-TABLES-002',
              specId: 'API-TABLES-002',
              filePath: 'specs/api/tables.spec.ts', // Same file
              priority: 60,
              attempts: 0,
            }),
            createMockSpec({
              id: 'API-TABLES-003',
              specId: 'API-TABLES-003',
              filePath: 'specs/api/tables.spec.ts', // Same file
              priority: 50,
              attempts: 0,
            }),
          ],
          active: [],
          completed: [],
          failed: [],
        },
      }

      // Request 3 specs - but should only get 1 (all from same file)
      const selected = yield* selector.selectNext(3, state)

      // STRICT FILE-LEVEL EXCLUSIVITY: Only ONE spec from this file
      expect(selected).toHaveLength(1)
      expect(selected[0]?.specId).toBe('API-TABLES-001') // Highest priority
    }).pipe(Effect.provide(TestLayer))

    await Effect.runPromise(program)
  })

  test('STRICT FILE-LEVEL EXCLUSIVITY: selects specs from different files concurrently', async () => {
    const program = Effect.gen(function* () {
      const selector = yield* SpecSelector

      // Specs from DIFFERENT files can be selected concurrently
      const state: TDDState = {
        ...INITIAL_STATE,
        queue: {
          pending: [
            createMockSpec({
              id: 'API-TABLES-001',
              specId: 'API-TABLES-001',
              filePath: 'specs/api/tables.spec.ts', // File A
              priority: 70,
              attempts: 0,
            }),
            createMockSpec({
              id: 'API-TABLES-002',
              specId: 'API-TABLES-002',
              filePath: 'specs/api/tables.spec.ts', // File A (same)
              priority: 60,
              attempts: 0,
            }),
            createMockSpec({
              id: 'API-USERS-001',
              specId: 'API-USERS-001',
              filePath: 'specs/api/users.spec.ts', // File B (different)
              priority: 50,
              attempts: 0,
            }),
            createMockSpec({
              id: 'API-FIELDS-001',
              specId: 'API-FIELDS-001',
              filePath: 'specs/api/fields.spec.ts', // File C (different)
              priority: 40,
              attempts: 0,
            }),
          ],
          active: [],
          completed: [],
          failed: [],
        },
      }

      // Request 3 specs - should get ONE from each of 3 different files
      const selected = yield* selector.selectNext(3, state)

      expect(selected).toHaveLength(3)

      // Verify each spec is from a different file
      const filePaths = selected.map((s) => s.filePath)
      const uniqueFilePaths = new Set(filePaths)
      expect(uniqueFilePaths.size).toBe(3)

      // Verify the highest priority spec from each file is selected
      expect(selected.map((s) => s.specId)).toContain('API-TABLES-001') // Highest from tables.spec.ts
      expect(selected.map((s) => s.specId)).toContain('API-USERS-001') // Only from users.spec.ts
      expect(selected.map((s) => s.specId)).toContain('API-FIELDS-001') // Only from fields.spec.ts
    }).pipe(Effect.provide(TestLayer))

    await Effect.runPromise(program)
  })

  test('STRICT FILE-LEVEL EXCLUSIVITY: locked file blocks ALL specs from that file', async () => {
    const program = Effect.gen(function* () {
      const selector = yield* SpecSelector

      const state: TDDState = {
        ...INITIAL_STATE,
        queue: {
          pending: [
            createMockSpec({
              id: 'API-TABLES-001',
              specId: 'API-TABLES-001',
              filePath: 'specs/api/tables.spec.ts', // File is locked
              priority: 90,
              attempts: 0,
            }),
            createMockSpec({
              id: 'API-TABLES-002',
              specId: 'API-TABLES-002',
              filePath: 'specs/api/tables.spec.ts', // File is locked
              priority: 80,
              attempts: 0,
            }),
            createMockSpec({
              id: 'API-USERS-001',
              specId: 'API-USERS-001',
              filePath: 'specs/api/users.spec.ts', // Different file, NOT locked
              priority: 50,
              attempts: 0,
            }),
          ],
          active: [],
          completed: [],
          failed: [],
        },
        activeFiles: ['specs/api/tables.spec.ts'], // File is locked
      }

      const selected = yield* selector.selectNext(3, state)

      // Only the spec from unlocked file should be selected
      expect(selected).toHaveLength(1)
      expect(selected[0]?.specId).toBe('API-USERS-001')
      expect(selected[0]?.filePath).toBe('specs/api/users.spec.ts')
    }).pipe(Effect.provide(TestLayer))

    await Effect.runPromise(program)
  })
})
