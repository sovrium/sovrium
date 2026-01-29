/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Check Credit Limits Program
 *
 * Effect program that calculates daily and weekly Claude Code spending
 * and enforces credit limits for TDD automation.
 */

import { Effect, pipe } from 'effect'
import { CreditLimitExceeded, CreditsExhausted } from '../core/errors'
import { TDD_CONFIG } from '../core/types'
import { CostTracker } from '../services/cost-tracker'
import { GitHubApi } from '../services/github-api'

/**
 * Result of credit limit check
 */
export interface CreditCheckResult {
  readonly canProceed: boolean
  readonly dailySpend: number
  readonly weeklySpend: number
  readonly warnings: readonly string[]
}

/**
 * Check credit limits program
 *
 * 1. Fetches workflow runs from past 24h and 7 days
 * 2. Parses cost from each run's logs
 * 3. Calculates total daily and weekly spend
 * 4. Fails with CreditLimitExceeded if over limits
 * 5. Returns warnings at 80% thresholds
 *
 * @returns CreditCheckResult with spend amounts and warnings
 * @throws CreditLimitExceeded if daily ($100) or weekly ($500) limit exceeded
 */
export const checkCreditLimits = Effect.gen(function* () {
  const github = yield* GitHubApi
  const costTracker = yield* CostTracker

  // Get workflow runs from past 24h and 7d
  const now = new Date()
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const warnings: string[] = []

  // Fetch daily runs with graceful error handling (empty array if API fails)
  const dailyRuns = yield* pipe(
    github.getWorkflowRuns({
      workflow: 'claude-code.yml',
      createdAfter: oneDayAgo,
      status: 'success',
    }),
    Effect.catchTag('GitHubApiError', (error) => {
      warnings.push(`Failed to fetch daily workflow runs (${error.operation}), assuming $0 spent`)
      return Effect.succeed([])
    })
  )

  // Fetch weekly runs with graceful error handling (empty array if API fails)
  const weeklyRuns = yield* pipe(
    github.getWorkflowRuns({
      workflow: 'claude-code.yml',
      createdAfter: oneWeekAgo,
      status: 'success',
    }),
    Effect.catchTag('GitHubApiError', (error) => {
      warnings.push(`Failed to fetch weekly workflow runs (${error.operation}), assuming $0 spent`)
      return Effect.succeed([])
    })
  )

  // Calculate costs with fallback for parsing failures
  const dailyCosts = yield* Effect.forEach(dailyRuns, (run) =>
    pipe(
      costTracker.parseCostFromLogs(run.id),
      Effect.catchTag('CostParsingFailed', () => Effect.succeed(TDD_CONFIG.FALLBACK_COST_PER_RUN))
    )
  )

  const weeklyCosts = yield* Effect.forEach(weeklyRuns, (run) =>
    pipe(
      costTracker.parseCostFromLogs(run.id),
      Effect.catchTag('CostParsingFailed', () => Effect.succeed(TDD_CONFIG.FALLBACK_COST_PER_RUN))
    )
  )

  const dailySpend = dailyCosts.reduce((a, b) => a + b, 0)
  const weeklySpend = weeklyCosts.reduce((a, b) => a + b, 0)

  // Check warning thresholds (80%)
  if (dailySpend >= TDD_CONFIG.DAILY_LIMIT * TDD_CONFIG.WARNING_THRESHOLD) {
    warnings.push(`Daily spend at $${dailySpend}/$${TDD_CONFIG.DAILY_LIMIT} (80%+)`)
  }
  if (weeklySpend >= TDD_CONFIG.WEEKLY_LIMIT * TDD_CONFIG.WARNING_THRESHOLD) {
    warnings.push(`Weekly spend at $${weeklySpend}/$${TDD_CONFIG.WEEKLY_LIMIT} (80%+)`)
  }

  // Check hard limits
  if (dailySpend >= TDD_CONFIG.DAILY_LIMIT) {
    return yield* new CreditLimitExceeded({ dailySpend, weeklySpend, limit: 'daily' })
  }
  if (weeklySpend >= TDD_CONFIG.WEEKLY_LIMIT) {
    return yield* new CreditLimitExceeded({ dailySpend, weeklySpend, limit: 'weekly' })
  }

  // Read probe result from GitHub Actions workflow step output (environment variables)
  const probeExhausted = process.env['PROBE_EXHAUSTED'] === 'true'
  const probeFailed = process.env['PROBE_FAILED'] === 'true'

  // Log probe status
  if (probeFailed) {
    warnings.push('Claude Code API probe failed, continuing with budget check only')
  }

  // Fail immediately if probe detected exhaustion (before budget checks)
  if (probeExhausted) {
    return yield* new CreditsExhausted({
      dailySpend,
      weeklySpend,
      probeResult: {
        rawJson: 'Exhaustion detected via workflow probe',
        errorMessage: 'Credits exhausted (is_error=true AND total_cost_usd=0)',
      },
    })
  }

  return {
    canProceed: true,
    dailySpend,
    weeklySpend,
    warnings,
  } satisfies CreditCheckResult
})
