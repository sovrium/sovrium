/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Check Credits CLI Entry Point
 *
 * CLI script called by claude-code.yml workflow to check credit limits
 * before running Claude Code.
 *
 * Uses environment variables for configuration:
 *   TDD_DAILY_LIMIT - Daily limit in dollars (default: 100)
 *   TDD_WEEKLY_LIMIT - Weekly limit in dollars (default: 500)
 *   PROBE_EXHAUSTED - Whether credit probe detected exhaustion
 *   PROBE_FAILED - Whether credit probe failed
 *
 * Output (JSON):
 *   {
 *     "creditsOk": true,
 *     "dailySpend": 45.50,
 *     "weeklySpend": 123.75,
 *     "dailyLimit": 200,
 *     "weeklyLimit": 1000,
 *     "dailyRemaining": 154.50,
 *     "weeklyRemaining": 876.25,
 *     "dailyPercent": 23,
 *     "weeklyPercent": 12,
 *     "hoursUntilDailyReset": 8,
 *     "daysUntilWeeklyReset": 3,
 *     "warnings": []
 *   }
 *
 * Or on limit exceeded:
 *   {
 *     "creditsOk": false,
 *     "limitType": "daily",
 *     ...
 *   }
 */

import { Console, Effect, Layer, pipe } from 'effect'
import { TDD_CONFIG } from '../../core/config'
import { checkCreditLimits } from '../../programs/check-credit-limits'
import { CostTrackerLive } from '../../services/cost-tracker'
import { GitHubApiLive } from '../../services/github-api'
import type { CreditLimitExceeded, CreditsExhausted } from '../../core/errors'
import type { CreditCheckResult } from '../../programs/check-credit-limits'

/**
 * Extended result for workflow output
 */
interface CreditCheckOutput {
  readonly creditsOk: boolean
  readonly limitType: 'daily' | 'weekly' | 'exhausted' | 'none'
  readonly dailySpend: number
  readonly weeklySpend: number
  readonly dailyLimit: number
  readonly weeklyLimit: number
  readonly dailyRemaining: number
  readonly weeklyRemaining: number
  readonly dailyPercent: number
  readonly weeklyPercent: number
  readonly hoursUntilDailyReset: number
  readonly daysUntilWeeklyReset: number
  readonly dailyRuns?: number
  readonly weeklyRuns?: number
  readonly warnings: readonly string[]
  readonly error?: string
}

/**
 * Calculate time until daily reset (midnight UTC)
 */
function getHoursUntilDailyReset(): number {
  const now = new Date()
  return 24 - now.getUTCHours()
}

/**
 * Calculate days until weekly reset (Sunday UTC)
 */
function getDaysUntilWeeklyReset(): number {
  const now = new Date()
  const dayOfWeek = now.getUTCDay() // 0 = Sunday
  return dayOfWeek === 0 ? 7 : 7 - dayOfWeek
}

/**
 * Build output from credit check result
 */
function buildOutput(result: CreditCheckResult): CreditCheckOutput {
  const dailyLimit = TDD_CONFIG.DAILY_LIMIT
  const weeklyLimit = TDD_CONFIG.WEEKLY_LIMIT

  const dailyRemaining = Math.max(0, dailyLimit - result.dailySpend)
  const weeklyRemaining = Math.max(0, weeklyLimit - result.weeklySpend)
  const dailyPercent = Math.round((result.dailySpend / dailyLimit) * 100)
  const weeklyPercent = Math.round((result.weeklySpend / weeklyLimit) * 100)

  return {
    creditsOk: result.canProceed,
    limitType: 'none',
    dailySpend: Math.round(result.dailySpend * 100) / 100,
    weeklySpend: Math.round(result.weeklySpend * 100) / 100,
    dailyLimit,
    weeklyLimit,
    dailyRemaining: Math.round(dailyRemaining * 100) / 100,
    weeklyRemaining: Math.round(weeklyRemaining * 100) / 100,
    dailyPercent,
    weeklyPercent,
    hoursUntilDailyReset: getHoursUntilDailyReset(),
    daysUntilWeeklyReset: getDaysUntilWeeklyReset(),
    warnings: result.warnings,
  }
}

/**
 * Build output from limit exceeded error
 */
function buildExceededOutput(error: CreditLimitExceeded): CreditCheckOutput {
  const dailyLimit = TDD_CONFIG.DAILY_LIMIT
  const weeklyLimit = TDD_CONFIG.WEEKLY_LIMIT

  const dailyRemaining = Math.max(0, dailyLimit - error.dailySpend)
  const weeklyRemaining = Math.max(0, weeklyLimit - error.weeklySpend)
  const dailyPercent = Math.round((error.dailySpend / dailyLimit) * 100)
  const weeklyPercent = Math.round((error.weeklySpend / weeklyLimit) * 100)

  return {
    creditsOk: false,
    limitType: error.limit,
    dailySpend: Math.round(error.dailySpend * 100) / 100,
    weeklySpend: Math.round(error.weeklySpend * 100) / 100,
    dailyLimit,
    weeklyLimit,
    dailyRemaining: Math.round(dailyRemaining * 100) / 100,
    weeklyRemaining: Math.round(weeklyRemaining * 100) / 100,
    dailyPercent,
    weeklyPercent,
    hoursUntilDailyReset: getHoursUntilDailyReset(),
    daysUntilWeeklyReset: getDaysUntilWeeklyReset(),
    warnings: [],
  }
}

/**
 * Build output from credits exhausted error
 */
function buildExhaustedOutput(error: CreditsExhausted): CreditCheckOutput {
  const dailyLimit = TDD_CONFIG.DAILY_LIMIT
  const weeklyLimit = TDD_CONFIG.WEEKLY_LIMIT

  return {
    creditsOk: false,
    limitType: 'exhausted',
    dailySpend: Math.round(error.dailySpend * 100) / 100,
    weeklySpend: Math.round(error.weeklySpend * 100) / 100,
    dailyLimit,
    weeklyLimit,
    dailyRemaining: 0,
    weeklyRemaining: 0,
    dailyPercent: 100,
    weeklyPercent: 100,
    hoursUntilDailyReset: getHoursUntilDailyReset(),
    daysUntilWeeklyReset: getDaysUntilWeeklyReset(),
    warnings: [],
    error: error.probeResult?.errorMessage ?? 'Credits exhausted',
  }
}

/**
 * Main program
 */
const main = Effect.gen(function* () {
  yield* Console.error('💳 Checking Claude Code credit limits...')

  // Run credit check with error handling
  const output = yield* pipe(
    checkCreditLimits,
    Effect.map(buildOutput),
    Effect.catchTag('CreditLimitExceeded', (error) => Effect.succeed(buildExceededOutput(error))),
    Effect.catchTag('CreditsExhausted', (error) => Effect.succeed(buildExhaustedOutput(error))),
    Effect.catchAll((error) => {
      // Fail-open: return OK on unexpected errors
      const errorMsg = error instanceof Error ? error.message : String(error)
      return Effect.succeed({
        creditsOk: true,
        limitType: 'none' as const,
        dailySpend: 0,
        weeklySpend: 0,
        dailyLimit: TDD_CONFIG.DAILY_LIMIT,
        weeklyLimit: TDD_CONFIG.WEEKLY_LIMIT,
        dailyRemaining: TDD_CONFIG.DAILY_LIMIT,
        weeklyRemaining: TDD_CONFIG.WEEKLY_LIMIT,
        dailyPercent: 0,
        weeklyPercent: 0,
        hoursUntilDailyReset: getHoursUntilDailyReset(),
        daysUntilWeeklyReset: getDaysUntilWeeklyReset(),
        warnings: [`Credit check failed (fail-open): ${errorMsg}`],
      } satisfies CreditCheckOutput)
    })
  )

  // Log summary to stderr
  if (output.creditsOk) {
    yield* Console.error(
      `✅ Credits OK - Daily: $${output.dailySpend}/$${output.dailyLimit} (${output.dailyPercent}%), Weekly: $${output.weeklySpend}/$${output.weeklyLimit} (${output.weeklyPercent}%)`
    )
  } else {
    yield* Console.error(
      `⛔ Credit limit ${output.limitType} - Daily: $${output.dailySpend}/$${output.dailyLimit}, Weekly: $${output.weeklySpend}/$${output.weeklyLimit}`
    )
  }

  if (output.warnings.length > 0) {
    for (const warning of output.warnings) {
      yield* Console.error(`⚠️ ${warning}`)
    }
  }

  // Output JSON for workflow parsing
  // @effect-diagnostics effect/preferSchemaOverJson:off
  yield* Console.log(JSON.stringify(output))
})

// Provide layers and run
// CostTrackerLive depends on GitHubApi, so we need to provide GitHubApiLive to it
const CostTrackerWithDeps = Layer.provide(CostTrackerLive, GitHubApiLive)
const AppLayer = Layer.mergeAll(GitHubApiLive, CostTrackerWithDeps)

Effect.runPromise(Effect.provide(main, AppLayer))
