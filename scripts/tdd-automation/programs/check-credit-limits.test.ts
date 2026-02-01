/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Check Credit Limits Unit Tests
 *
 * Tests for check-credit-limits program with mocked GitHub API.
 * Uses mock layers to control test data without making real API calls.
 */

import { test, expect } from 'bun:test'
import { Effect, Layer } from 'effect'
import { CostTracker } from '../services/cost-tracker'
import { GitHubApi } from '../services/github-api'
import { checkCreditLimits } from './check-credit-limits'

/**
 * Mock GitHubApi layer that returns controlled test data
 * Returns empty workflow runs to simulate $0 spend
 */
const GitHubApiMock = (workflowRuns: readonly { id: string; logs: string }[] = []) =>
  Layer.succeed(GitHubApi, {
    listTDDPRs: () => Effect.succeed([]),
    getPR: () =>
      Effect.succeed({
        number: 1,
        title: 'Test PR',
        branch: 'test-branch',
        state: 'open' as const,
        labels: [],
      }),
    getWorkflowRuns: () =>
      Effect.succeed(
        workflowRuns.map((run) => ({
          id: run.id,
          name: 'claude-code.yml',
          conclusion: 'success' as const,
          createdAt: new Date(),
          updatedAt: new Date(),
          htmlUrl: `https://github.com/test/test/actions/runs/${run.id}`,
        }))
      ),
    getRunLogs: (runId) => {
      const run = workflowRuns.find((r) => r.id === runId)
      return Effect.succeed(run?.logs ?? '')
    },
    createPR: () => Effect.succeed({ number: 1, url: 'https://github.com/test/test/pull/1' }),
    updatePRTitle: () => Effect.void,
    addLabel: () => Effect.void,
    postComment: () => Effect.void,
    enableAutoMerge: () => Effect.void,
  })

/**
 * Test layer for CostTracker that returns fixed cost
 */
const CostTrackerTest = (costPerRun: number) =>
  Layer.succeed(CostTracker, {
    parseCostFromLogs: () => Effect.succeed(costPerRun),
  })

test('check-credit-limits - credits exhausted', async () => {
  // Set environment variables to simulate exhausted probe result
  process.env['PROBE_EXHAUSTED'] = 'true'
  process.env['PROBE_FAILED'] = 'false'

  const TestLayer = Layer.mergeAll(
    GitHubApiMock(), // Use mock with no workflow runs ($0 spend)
    CostTrackerTest(10) // Under limit, but probe shows exhaustion
  )

  const program = checkCreditLimits.pipe(Effect.provide(TestLayer), Effect.either)
  const result = await Effect.runPromise(program)

  expect(result._tag).toBe('Left')
  if (result._tag === 'Left') {
    expect(result.left._tag).toBe('CreditsExhausted')
    if (result.left._tag === 'CreditsExhausted') {
      expect(result.left.dailySpend).toBeGreaterThanOrEqual(0)
      expect(result.left.weeklySpend).toBeGreaterThanOrEqual(0)
      expect(result.left.probeResult.errorMessage).toContain('exhausted')
    }
  }

  // Cleanup
  delete process.env['PROBE_EXHAUSTED']
  delete process.env['PROBE_FAILED']
})

test('check-credit-limits - probe failure (graceful)', async () => {
  // Set environment variables to simulate probe failure
  process.env['PROBE_EXHAUSTED'] = 'false'
  process.env['PROBE_FAILED'] = 'true'

  const TestLayer = Layer.mergeAll(GitHubApiMock(), CostTrackerTest(10))
  const program = checkCreditLimits.pipe(Effect.provide(TestLayer), Effect.either)
  const result = await Effect.runPromise(program)

  expect(result._tag).toBe('Right')
  if (result._tag === 'Right') {
    expect(result.right.canProceed).toBe(true)
    expect(result.right.warnings.length).toBeGreaterThan(0)
    expect(result.right.warnings.some((w) => w.includes('probe failed'))).toBe(true)
  }

  // Cleanup
  delete process.env['PROBE_EXHAUSTED']
  delete process.env['PROBE_FAILED']
})

test('check-credit-limits - under limits and credits available', async () => {
  // Set environment variables to simulate available credits
  process.env['PROBE_EXHAUSTED'] = 'false'
  process.env['PROBE_FAILED'] = 'false'

  const TestLayer = Layer.mergeAll(
    GitHubApiMock(), // Use mock with no workflow runs ($0 spend)
    CostTrackerTest(10) // Under limit
  )

  const program = checkCreditLimits.pipe(Effect.provide(TestLayer), Effect.either)
  const result = await Effect.runPromise(program)

  expect(result._tag).toBe('Right')
  if (result._tag === 'Right') {
    expect(result.right.canProceed).toBe(true)
    expect(result.right.dailySpend).toBeGreaterThanOrEqual(0)
    expect(result.right.weeklySpend).toBeGreaterThanOrEqual(0)
  }

  // Cleanup
  delete process.env['PROBE_EXHAUSTED']
  delete process.env['PROBE_FAILED']
})
