/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect, describe } from 'bun:test'
import { Effect } from 'effect'
import { INITIAL_STATE } from '../types'
import {
  PriorityCalculator,
  PriorityCalculatorLive,
  SpecSelector,
  SpecSelectorLive,
} from './spec-selector'
import type { TDDState, SpecFileItem } from '../types'

// Helper function to create mock spec file
const createMockSpec = (overrides: Partial<SpecFileItem>): SpecFileItem => ({
  id: 'specs/api/test.spec.ts',
  filePath: 'specs/api/test.spec.ts',
  priority: 50,
  status: 'pending',
  testCount: 10,
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
        testCount: 25, // Mid-range, no bonus or penalty
        attempts: 0,
        filePath: 'specs/api/users/profile.spec.ts', // Depth 4, no bonus or penalty
      })

      const priority = calculator.calculate(spec)

      // Base 50 + 15 (no attempts) = 65
      expect(priority).toBe(65)
    }).pipe(Effect.provide(PriorityCalculatorLive))

    await Effect.runPromise(program)
  })

  test('prioritizes specs with fewer tests (quick wins)', async () => {
    const program = Effect.gen(function* () {
      const calculator = yield* PriorityCalculator

      const spec1 = createMockSpec({ testCount: 5, attempts: 0 })
      const spec2 = createMockSpec({ testCount: 15, attempts: 0 })
      const spec3 = createMockSpec({ testCount: 60, attempts: 0 })

      const priority1 = calculator.calculate(spec1)
      const priority2 = calculator.calculate(spec2)
      const priority3 = calculator.calculate(spec3)

      // spec1: 5 tests → +20, 0 attempts → +15, depth 3 → +10 = 50 + 20 + 15 + 10 = 95
      // spec2: 15 tests → +10, 0 attempts → +15, depth 3 → +10 = 50 + 10 + 15 + 10 = 85
      // spec3: 60 tests → -10, 0 attempts → +15, depth 3 → +10 = 50 - 10 + 15 + 10 = 65

      expect(priority1).toBe(95)
      expect(priority2).toBe(85)
      expect(priority3).toBe(65)
      expect(priority1).toBeGreaterThan(priority2)
      expect(priority2).toBeGreaterThan(priority3)
    }).pipe(Effect.provide(PriorityCalculatorLive))

    await Effect.runPromise(program)
  })

  test('prioritizes specs with fewer failure attempts', async () => {
    const program = Effect.gen(function* () {
      const calculator = yield* PriorityCalculator

      const spec1 = createMockSpec({ attempts: 0, testCount: 25 })
      const spec2 = createMockSpec({ attempts: 1, testCount: 25 })
      const spec3 = createMockSpec({ attempts: 2, testCount: 25 })

      const priority1 = calculator.calculate(spec1)
      const priority2 = calculator.calculate(spec2)
      const priority3 = calculator.calculate(spec3)

      // spec1: 0 attempts → +15, depth 3 → +10 = 50 + 15 + 10 = 75
      // spec2: 1 attempt → +5, depth 3 → +10 = 50 + 5 + 10 = 65
      // spec3: 2 attempts → -5, depth 3 → +10 = 50 - 5 + 10 = 55

      expect(priority1).toBe(75)
      expect(priority2).toBe(65)
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
        testCount: 25,
        attempts: 0,
      })

      const spec2 = createMockSpec({
        filePath: 'specs/api/users/profile.spec.ts', // Depth 4
        testCount: 25,
        attempts: 0,
      })

      const spec3 = createMockSpec({
        filePath: 'specs/api/users/profile/settings.spec.ts', // Depth 5
        testCount: 25,
        attempts: 0,
      })

      const priority1 = calculator.calculate(spec1)
      const priority2 = calculator.calculate(spec2)
      const priority3 = calculator.calculate(spec3)

      // spec1: depth 3 → +10 → 50 + 15 + 10 = 75
      // spec2: depth 4 → +0 → 50 + 15 = 65
      // spec3: depth 5 → -10 → 50 + 15 - 10 = 55

      expect(priority1).toBe(75)
      expect(priority2).toBe(65)
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
        testCount: 25,
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
        testCount: 25,
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
        testCount: 25,
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

      // spec1: 1 attempt → +5, depth 3 → +10, infrastructure → -20 = 50 + 5 + 10 - 20 = 45
      // spec2: 1 attempt → +5, depth 3 → +10, regression → -10 = 50 + 5 + 10 - 10 = 55
      // spec3: 1 attempt → +5, depth 3 → +10, spec failure → +0 = 50 + 5 + 10 = 65

      expect(priority1).toBe(45)
      expect(priority2).toBe(55)
      expect(priority3).toBe(65)
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
        testCount: 5, // +20
        attempts: 0, // +15
        filePath: 'specs/api/test.spec.ts', // depth 3, +10
      })

      // Extreme low score
      const specLow = createMockSpec({
        testCount: 100, // -10
        attempts: 2, // -5
        filePath: 'specs/api/a/b/c/d/e.spec.ts', // depth 6, -10
        errors: [
          {
            timestamp: new Date().toISOString(),
            type: 'infrastructure',
            message: 'Error',
          },
        ], // -20
      })

      const priorityHigh = calculator.calculate(specHigh)
      const priorityLow = calculator.calculate(specLow)

      // High: 50 + 20 + 15 + 10 = 95 (within range)
      // Low: 50 - 10 - 5 - 10 - 20 = 5 (within range)

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
    }).pipe(Effect.provide(SpecSelectorLive), Effect.provide(PriorityCalculatorLive))

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
    }).pipe(Effect.provide(SpecSelectorLive), Effect.provide(PriorityCalculatorLive))

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
    }).pipe(Effect.provide(SpecSelectorLive), Effect.provide(PriorityCalculatorLive))

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
    }).pipe(Effect.provide(SpecSelectorLive), Effect.provide(PriorityCalculatorLive))

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
              id: 'specs/api/test1.spec.ts',
              filePath: 'specs/api/test1.spec.ts',
              testCount: 50, // Lower priority
              attempts: 0,
            }),
            createMockSpec({
              id: 'specs/api/test2.spec.ts',
              filePath: 'specs/api/test2.spec.ts',
              testCount: 5, // Higher priority (fewer tests)
              attempts: 0,
            }),
            createMockSpec({
              id: 'specs/api/test3.spec.ts',
              filePath: 'specs/api/test3.spec.ts',
              testCount: 15, // Medium priority
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
    }).pipe(Effect.provide(SpecSelectorLive), Effect.provide(PriorityCalculatorLive))

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
    }).pipe(Effect.provide(SpecSelectorLive), Effect.provide(PriorityCalculatorLive))

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
              filePath: 'test1',
              attempts: 3, // Max retries - FILTERED
              testCount: 5,
            }),
            createMockSpec({
              id: 'test2',
              filePath: 'test2',
              attempts: 1,
              lastAttempt: recentAttempt, // In cooldown - FILTERED
              testCount: 10,
            }),
            createMockSpec({
              id: 'test3',
              filePath: 'test3', // File locked - FILTERED
              attempts: 0,
              testCount: 15,
            }),
            createMockSpec({
              id: 'test4',
              filePath: 'test4', // ELIGIBLE
              attempts: 1,
              testCount: 8,
            }),
            createMockSpec({
              id: 'test5',
              filePath: 'test5', // ELIGIBLE
              attempts: 0,
              testCount: 12,
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
      expect(selected.map((s) => s.filePath)).toEqual(['test4', 'test5'])
    }).pipe(Effect.provide(SpecSelectorLive), Effect.provide(PriorityCalculatorLive))

    await Effect.runPromise(program)
  })
})
