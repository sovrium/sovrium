/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, it } from 'bun:test'
import { Effect, Layer } from 'effect'
import { CommandService } from '../../lib/effect/CommandService'
import { GitHubAPIClient } from './github-api-client'
import { LabelStateMachineLive } from './label-state-machine'
import {
  RetryManager,
  RetryManagerLive,
  // Pure helpers
  calculateExponentialBackoff,
  addRandomJitter,
  getRetryCategoryFromError,
  isRetryAllowed,
  buildRetryDecision,
  calculateRemainingCooldown,
  // Constants
  DEFAULT_BACKOFF_CONFIG,
  COOLDOWN_PERIODS,
  // Types
  type RetryContext,
  type BackoffConfig,
} from './retry-manager'
import { TimeUtilsLive } from './time-utils'
import type { ErrorClassification } from './error-classifier'

// =============================================================================
// Mock Helpers
// =============================================================================

const createMockErrorClassification = (
  overrides: Partial<ErrorClassification> = {}
): ErrorClassification => ({
  errorType: 'code_error',
  category: 'code',
  isInfrastructure: false,
  isRetryable: true,
  sdkCrashAfterSuccess: false,
  shouldPauseQueue: false,
  message: 'Test error',
  ...overrides,
})

/**
 * Creates a mock CommandService layer for testing
 */
const createMockCommandService = (): Layer.Layer<CommandService, never, never> => {
  return Layer.succeed(
    CommandService,
    CommandService.of({
      exec: () => Effect.succeed(''),
      spawn: () => Effect.succeed({ exitCode: 0, stdout: '', stderr: '', duration: 0 }),
      parallel: (commands) => Effect.all(commands),
      withGitHubOutput: () => Effect.succeed({ exitCode: 0, stdout: '', stderr: '', duration: 0 }),
    })
  )
}

interface MockIssueState {
  labels: string[]
}

const createMockGitHubClient = (
  issueState: MockIssueState
): Layer.Layer<GitHubAPIClient, never, never> => {
  return Layer.succeed(
    GitHubAPIClient,
    GitHubAPIClient.of({
      getIssue: (issueNumber: number) =>
        Effect.succeed({
          number: issueNumber,
          title: `Test Issue #${issueNumber}`,
          body: 'Test body',
          state: 'open',
          labels: issueState.labels.map((name) => ({ name })),
          createdAt: '2025-01-25T10:00:00Z',
          updatedAt: '2025-01-25T10:00:00Z',
          url: `https://github.com/owner/repo/issues/${issueNumber}`,
        }),

      addLabels: (issueNumber: number, labels: ReadonlyArray<string>) => {
        for (const label of labels) {
          if (!issueState.labels.includes(label)) {
            issueState.labels.push(label)
          }
        }
        return Effect.succeed(undefined)
      },

      removeLabels: (issueNumber: number, labels: ReadonlyArray<string>) => {
        for (const label of labels) {
          const index = issueState.labels.indexOf(label)
          if (index > -1) {
            issueState.labels.splice(index, 1)
          }
        }
        return Effect.succeed(undefined)
      },

      // Required interface methods
      checkRateLimit: () =>
        Effect.succeed({
          remaining: 5000,
          limit: 5000,
          resetTimestamp: Date.now() + 3_600_000,
          resetDate: new Date(Date.now() + 3_600_000),
        }),
      ensureRateLimit: () => Effect.succeed(true),
      listIssues: () => Effect.succeed([]),
      getIssueBody: () => Effect.succeed(''),
      closeIssue: () => Effect.succeed(undefined),
      listPRs: () => Effect.succeed([]),
      hasPRForBranch: () => Effect.succeed(false),
      branchExists: () => Effect.succeed({ exists: false, name: '' }),
      listWorkflowRuns: () => Effect.succeed([]),
      getWorkflowRunLogs: () => Effect.succeed(''),
      addComment: () => Effect.succeed(undefined),
    })
  )
}

// =============================================================================
// Pure Function Tests
// =============================================================================

describe('calculateExponentialBackoff', () => {
  it('should return base delay for first retry', () => {
    expect(calculateExponentialBackoff(1, 60, 300)).toBe(60)
  })

  it('should double delay for each retry', () => {
    expect(calculateExponentialBackoff(2, 60, 300)).toBe(120)
    expect(calculateExponentialBackoff(3, 60, 300)).toBe(240)
  })

  it('should cap delay at max', () => {
    expect(calculateExponentialBackoff(4, 60, 300)).toBe(300) // 480 capped to 300
    expect(calculateExponentialBackoff(5, 60, 300)).toBe(300)
  })

  it('should return base delay for zero or negative count', () => {
    expect(calculateExponentialBackoff(0, 60, 300)).toBe(60)
    expect(calculateExponentialBackoff(-1, 60, 300)).toBe(60)
  })

  it('should work with different base delays', () => {
    expect(calculateExponentialBackoff(1, 30, 120)).toBe(30)
    expect(calculateExponentialBackoff(2, 30, 120)).toBe(60)
    expect(calculateExponentialBackoff(3, 30, 120)).toBe(120)
  })
})

describe('addRandomJitter', () => {
  it('should add jitter within expected range', () => {
    const baseDelay = 100
    const jitterFraction = 0.25 // Up to 25% additional

    // Run multiple times to verify range
    for (let i = 0; i < 10; i++) {
      const result = addRandomJitter(baseDelay, jitterFraction)
      expect(result).toBeGreaterThanOrEqual(baseDelay)
      expect(result).toBeLessThanOrEqual(baseDelay + baseDelay * jitterFraction + 1) // +1 for rounding
    }
  })

  it('should return at least base delay', () => {
    const result = addRandomJitter(50, 0) // 0% jitter
    expect(result).toBe(50)
  })

  it('should round to integer', () => {
    const result = addRandomJitter(100, 0.5)
    expect(Number.isInteger(result)).toBe(true)
  })
})

describe('getRetryCategoryFromError', () => {
  it('should return infra for infrastructure errors', () => {
    const error = createMockErrorClassification({ isInfrastructure: true })
    expect(getRetryCategoryFromError(error)).toBe('infra')
  })

  it('should return spec for non-infrastructure errors', () => {
    const error = createMockErrorClassification({ isInfrastructure: false })
    expect(getRetryCategoryFromError(error)).toBe('spec')
  })
})

describe('isRetryAllowed', () => {
  it('should allow retry when count is below max', () => {
    expect(isRetryAllowed(0)).toBe(true)
    expect(isRetryAllowed(1)).toBe(true)
    expect(isRetryAllowed(2)).toBe(true)
  })

  it('should not allow retry when count is at or above max', () => {
    expect(isRetryAllowed(3)).toBe(false)
    expect(isRetryAllowed(4)).toBe(false)
  })
})

describe('buildRetryDecision', () => {
  it('should build retry decision correctly', () => {
    const decision = buildRetryDecision(true, 'spec', 2, 120, 'Test reason')

    expect(decision.shouldRetry).toBe(true)
    expect(decision.category).toBe('spec')
    expect(decision.newRetryCount).toBe(2)
    expect(decision.delaySeconds).toBe(120)
    expect(decision.reason).toBe('Test reason')
    expect(decision.maxRetriesReached).toBe(false)
  })

  it('should set maxRetriesReached when at max', () => {
    const decision = buildRetryDecision(false, 'spec', 3, 0, 'Max reached')
    expect(decision.maxRetriesReached).toBe(true)
  })
})

describe('calculateRemainingCooldown', () => {
  it('should return positive remaining minutes when in cooldown', () => {
    expect(calculateRemainingCooldown(10, 30)).toBe(20)
    expect(calculateRemainingCooldown(25, 30)).toBe(5)
  })

  it('should return 0 when cooldown expired', () => {
    expect(calculateRemainingCooldown(30, 30)).toBe(0)
    expect(calculateRemainingCooldown(45, 30)).toBe(0)
  })

  it('should ceil fractional minutes', () => {
    expect(calculateRemainingCooldown(10.5, 30)).toBe(20) // 19.5 -> 20
  })
})

// =============================================================================
// Constants Tests
// =============================================================================

describe('Constants', () => {
  describe('DEFAULT_BACKOFF_CONFIG', () => {
    it('should have expected default values', () => {
      expect(DEFAULT_BACKOFF_CONFIG.baseDelaySeconds).toBe(60)
      expect(DEFAULT_BACKOFF_CONFIG.maxDelaySeconds).toBe(300)
      expect(DEFAULT_BACKOFF_CONFIG.useJitter).toBe(true)
      expect(DEFAULT_BACKOFF_CONFIG.jitterFraction).toBe(0.25)
    })
  })

  describe('COOLDOWN_PERIODS', () => {
    it('should have expected cooldown values', () => {
      expect(COOLDOWN_PERIODS.standard).toBe(30)
      expect(COOLDOWN_PERIODS.failedPR).toBe(90)
      expect(COOLDOWN_PERIODS.infraError).toBe(10)
      expect(COOLDOWN_PERIODS.stuckEscalation).toBe(15)
    })
  })
})

// =============================================================================
// Service Tests
// =============================================================================

describe('RetryManager Service', () => {
  describe('shouldRetry', () => {
    it('should allow retry for retryable spec error', async () => {
      const context: RetryContext = {
        issueNumber: 123,
        errorClassification: createMockErrorClassification({
          isRetryable: true,
          isInfrastructure: false,
          errorType: 'lint_error',
        }),
        specRetryCount: 0,
        infraRetryCount: 0,
      }

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const rm = yield* RetryManager
          return yield* rm.shouldRetry(context)
        }).pipe(Effect.provide(RetryManagerLive))
      )

      expect(result.shouldRetry).toBe(true)
      expect(result.category).toBe('spec')
      expect(result.newRetryCount).toBe(1)
      expect(result.delaySeconds).toBeGreaterThan(0)
    })

    it('should allow retry for retryable infra error', async () => {
      const context: RetryContext = {
        issueNumber: 123,
        errorClassification: createMockErrorClassification({
          isRetryable: true,
          isInfrastructure: true,
          errorType: 'rate_limit_exceeded',
        }),
        specRetryCount: 0,
        infraRetryCount: 1,
      }

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const rm = yield* RetryManager
          return yield* rm.shouldRetry(context)
        }).pipe(Effect.provide(RetryManagerLive))
      )

      expect(result.shouldRetry).toBe(true)
      expect(result.category).toBe('infra')
      expect(result.newRetryCount).toBe(2)
    })

    it('should not retry non-retryable errors', async () => {
      const context: RetryContext = {
        issueNumber: 123,
        errorClassification: createMockErrorClassification({
          isRetryable: false,
          errorType: 'credit_exhausted',
        }),
        specRetryCount: 0,
        infraRetryCount: 0,
      }

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const rm = yield* RetryManager
          return yield* rm.shouldRetry(context)
        }).pipe(Effect.provide(RetryManagerLive))
      )

      expect(result.shouldRetry).toBe(false)
      expect(result.reason).toContain('not retryable')
    })

    it('should not retry when max retries reached', async () => {
      const context: RetryContext = {
        issueNumber: 123,
        errorClassification: createMockErrorClassification({
          isRetryable: true,
          isInfrastructure: false,
        }),
        specRetryCount: 3,
        infraRetryCount: 0,
      }

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const rm = yield* RetryManager
          return yield* rm.shouldRetry(context)
        }).pipe(Effect.provide(RetryManagerLive))
      )

      expect(result.shouldRetry).toBe(false)
      expect(result.maxRetriesReached).toBe(true)
      expect(result.reason).toContain('Max retries reached')
    })
  })

  describe('getRetryCategory', () => {
    it('should return correct category from service', async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const rm = yield* RetryManager
          return {
            spec: rm.getRetryCategory(createMockErrorClassification({ isInfrastructure: false })),
            infra: rm.getRetryCategory(createMockErrorClassification({ isInfrastructure: true })),
          }
        }).pipe(Effect.provide(RetryManagerLive))
      )

      expect(result.spec).toBe('spec')
      expect(result.infra).toBe('infra')
    })
  })

  describe('canRetry', () => {
    it('should return correct retry allowance', async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const rm = yield* RetryManager
          return {
            zero: rm.canRetry('spec', 0),
            two: rm.canRetry('spec', 2),
            three: rm.canRetry('spec', 3),
          }
        }).pipe(Effect.provide(RetryManagerLive))
      )

      expect(result.zero).toBe(true)
      expect(result.two).toBe(true)
      expect(result.three).toBe(false)
    })
  })

  describe('calculateBackoffDelay', () => {
    it('should calculate exponential backoff', async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const rm = yield* RetryManager
          // Use config without jitter for predictable results
          const config: BackoffConfig = {
            baseDelaySeconds: 60,
            maxDelaySeconds: 300,
            useJitter: false,
            jitterFraction: 0,
          }
          return {
            retry1: rm.calculateBackoffDelay(1, config),
            retry2: rm.calculateBackoffDelay(2, config),
            retry3: rm.calculateBackoffDelay(3, config),
          }
        }).pipe(Effect.provide(RetryManagerLive))
      )

      expect(result.retry1).toBe(60)
      expect(result.retry2).toBe(120)
      expect(result.retry3).toBe(240)
    })

    it('should add jitter when configured', async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const rm = yield* RetryManager
          const delay = rm.calculateBackoffDelay(1) // Uses default config with jitter
          return delay
        }).pipe(Effect.provide(RetryManagerLive))
      )

      // With jitter, delay should be between 60 and 75 (60 + 25%)
      expect(result).toBeGreaterThanOrEqual(60)
      expect(result).toBeLessThanOrEqual(76)
    })
  })

  describe('checkCooldown', () => {
    it('should detect active cooldown', async () => {
      // Activity 10 minutes ago
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const rm = yield* RetryManager
          return yield* rm.checkCooldown(tenMinutesAgo, 30)
        }).pipe(Effect.provide(RetryManagerLive), Effect.provide(TimeUtilsLive))
      )

      expect(result.isInCooldown).toBe(true)
      expect(result.remainingMinutes).toBeGreaterThan(0)
      expect(result.remainingMinutes).toBeLessThanOrEqual(20)
      expect(result.expiresAt).not.toBeNull()
    })

    it('should detect expired cooldown', async () => {
      // Activity 45 minutes ago
      const fortyFiveMinutesAgo = new Date(Date.now() - 45 * 60 * 1000).toISOString()

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const rm = yield* RetryManager
          return yield* rm.checkCooldown(fortyFiveMinutesAgo, 30)
        }).pipe(Effect.provide(RetryManagerLive), Effect.provide(TimeUtilsLive))
      )

      expect(result.isInCooldown).toBe(false)
      expect(result.remainingMinutes).toBe(0)
      expect(result.expiresAt).toBeNull()
    })
  })

  describe('isInStandardCooldown', () => {
    it('should use 30 minute cooldown', async () => {
      const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString()

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const rm = yield* RetryManager
          return yield* rm.isInStandardCooldown(twentyMinutesAgo)
        }).pipe(Effect.provide(RetryManagerLive), Effect.provide(TimeUtilsLive))
      )

      expect(result).toBe(true)
    })
  })

  describe('isInFailedPRCooldown', () => {
    it('should use 90 minute cooldown', async () => {
      const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const rm = yield* RetryManager
          return yield* rm.isInFailedPRCooldown(sixtyMinutesAgo)
        }).pipe(Effect.provide(RetryManagerLive), Effect.provide(TimeUtilsLive))
      )

      expect(result).toBe(true) // 60 min < 90 min cooldown
    })

    it('should detect expired 90 minute cooldown', async () => {
      const hundredMinutesAgo = new Date(Date.now() - 100 * 60 * 1000).toISOString()

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const rm = yield* RetryManager
          return yield* rm.isInFailedPRCooldown(hundredMinutesAgo)
        }).pipe(Effect.provide(RetryManagerLive), Effect.provide(TimeUtilsLive))
      )

      expect(result).toBe(false) // 100 min > 90 min cooldown
    })
  })

  describe('executeRetry', () => {
    it('should increment retry count and transition to queued', async () => {
      const issueState = { labels: ['tdd-spec:in-progress'] }

      const newCount = await Effect.runPromise(
        Effect.gen(function* () {
          const rm = yield* RetryManager
          return yield* rm.executeRetry(123, 'spec')
        }).pipe(
          Effect.provide(RetryManagerLive),
          Effect.provide(LabelStateMachineLive),
          Effect.provide(createMockGitHubClient(issueState)),
          Effect.provide(createMockCommandService())
        )
      )

      expect(newCount).toBe(1)
      expect(issueState.labels).toContain('retry:spec:1')
      expect(issueState.labels).toContain('tdd-spec:queued')
      expect(issueState.labels).not.toContain('tdd-spec:in-progress')
    })

    it('should handle infra retries separately', async () => {
      const issueState = { labels: ['tdd-spec:in-progress', 'retry:spec:2'] }

      const newCount = await Effect.runPromise(
        Effect.gen(function* () {
          const rm = yield* RetryManager
          return yield* rm.executeRetry(123, 'infra')
        }).pipe(
          Effect.provide(RetryManagerLive),
          Effect.provide(LabelStateMachineLive),
          Effect.provide(createMockGitHubClient(issueState)),
          Effect.provide(createMockCommandService())
        )
      )

      expect(newCount).toBe(1)
      expect(issueState.labels).toContain('retry:infra:1')
      expect(issueState.labels).toContain('retry:spec:2') // Unchanged
    })
  })

  describe('markAsFailed', () => {
    it('should set failure type and transition to failed', async () => {
      const issueState = { labels: ['tdd-spec:in-progress', 'retry:spec:3'] }

      await Effect.runPromise(
        Effect.gen(function* () {
          const rm = yield* RetryManager
          yield* rm.markAsFailed(123, 'spec')
        }).pipe(
          Effect.provide(RetryManagerLive),
          Effect.provide(LabelStateMachineLive),
          Effect.provide(createMockGitHubClient(issueState)),
          Effect.provide(createMockCommandService())
        )
      )

      expect(issueState.labels).toContain('failure:spec')
      expect(issueState.labels).toContain('tdd-spec:failed')
      expect(issueState.labels).not.toContain('tdd-spec:in-progress')
    })

    it('should handle regression failure type', async () => {
      const issueState = { labels: ['tdd-spec:in-progress'] }

      await Effect.runPromise(
        Effect.gen(function* () {
          const rm = yield* RetryManager
          yield* rm.markAsFailed(123, 'regression')
        }).pipe(
          Effect.provide(RetryManagerLive),
          Effect.provide(LabelStateMachineLive),
          Effect.provide(createMockGitHubClient(issueState)),
          Effect.provide(createMockCommandService())
        )
      )

      expect(issueState.labels).toContain('failure:regression')
      expect(issueState.labels).toContain('tdd-spec:failed')
    })
  })
})
