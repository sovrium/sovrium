/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Check Credit Limits Integration Tests
 *
 * Tests for check-credit-limits program with probe integration.
 */

import { test, expect } from 'bun:test'
import { Effect, Layer } from 'effect'
import { checkCreditLimits } from './check-credit-limits'
import { GitHubApiLive } from '../services/github-api'
import { CostTracker } from '../services/cost-tracker'
import {
  ClaudeCodeProbe,
  ClaudeCodeProbeTest,
  ClaudeCodeProbeError,
} from '../services/claude-code-probe'

/**
 * Test layer for CostTracker that returns fixed cost
 */
const CostTrackerTest = (costPerRun: number) =>
  Layer.succeed(CostTracker, {
    parseCostFromLogs: () => Effect.succeed(costPerRun),
  })

test('check-credit-limits - credits exhausted', async () => {
  const TestLayer = Layer.mergeAll(
    GitHubApiLive,
    CostTrackerTest(10), // Under limit
    ClaudeCodeProbeTest(true) // Exhausted
  )

  const program = checkCreditLimits.pipe(Effect.provide(TestLayer), Effect.either)
  const result = await Effect.runPromise(program)

  expect(result._tag).toBe('Left')
  if (result._tag === 'Left') {
    expect(result.left._tag).toBe('CreditsExhausted')
    if (result.left._tag === 'CreditsExhausted') {
      expect(result.left.dailySpend).toBeGreaterThanOrEqual(0)
      expect(result.left.weeklySpend).toBeGreaterThanOrEqual(0)
      expect(result.left.probeResult.rawJson).toContain('is_error')
    }
  }
})

test('check-credit-limits - probe failure (graceful)', async () => {
  const ProbeFailureLayer = Layer.succeed(ClaudeCodeProbe, {
    probe: () =>
      Effect.fail(new ClaudeCodeProbeError({ operation: 'execute', cause: 'mock error' })),
  })

  const TestLayer = Layer.mergeAll(GitHubApiLive, CostTrackerTest(10), ProbeFailureLayer)
  const program = checkCreditLimits.pipe(Effect.provide(TestLayer), Effect.either)
  const result = await Effect.runPromise(program)

  expect(result._tag).toBe('Right')
  if (result._tag === 'Right') {
    expect(result.right.canProceed).toBe(true)
    expect(result.right.warnings.length).toBeGreaterThan(0)
    expect(result.right.warnings.some((w) => w.includes('probe failed'))).toBe(true)
  }
})

test('check-credit-limits - under limits and credits available', async () => {
  const TestLayer = Layer.mergeAll(
    GitHubApiLive,
    CostTrackerTest(10), // Under limit
    ClaudeCodeProbeTest(false) // Not exhausted
  )

  const program = checkCreditLimits.pipe(Effect.provide(TestLayer), Effect.either)
  const result = await Effect.runPromise(program)

  expect(result._tag).toBe('Right')
  if (result._tag === 'Right') {
    expect(result.right.canProceed).toBe(true)
    expect(result.right.dailySpend).toBeGreaterThanOrEqual(0)
    expect(result.right.weeklySpend).toBeGreaterThanOrEqual(0)
  }
})
