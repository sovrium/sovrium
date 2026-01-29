/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Credit Comment Generator Service
 *
 * Generates markdown comments for TDD PR credit usage display.
 * Replaces complex bash logic in claude-code.yml with type-safe TypeScript.
 */

import { Data, Effect } from 'effect'

/**
 * Error thrown when parsing credit metrics fails
 */
export class ParseMetricsError extends Data.TaggedError('ParseMetricsError')<{
  readonly cause: unknown
}> {}

/**
 * Credit metrics for comment generation
 */
export interface CreditMetrics {
  readonly creditsOk: boolean
  readonly exhausted?: boolean
  readonly limitType: 'daily' | 'weekly' | 'none'
  readonly dailyRuns: number
  readonly weeklyRuns: number
  readonly actualDaily: number
  readonly actualWeekly: number
  readonly dailyLimit: number
  readonly weeklyLimit: number
  readonly dailyRemaining: number
  readonly weeklyRemaining: number
  readonly dailyPercent: number
  readonly weeklyPercent: number
  readonly hoursUntilDailyReset: number
  readonly daysUntilWeeklyReset: number
}

/**
 * Generate header section based on credit status
 */
function generateHeader(metrics: CreditMetrics): string {
  const lines: string[] = []

  if (metrics.exhausted) {
    lines.push('## 🚫 Claude Code API Credits Exhausted')
    lines.push('')
    lines.push('Claude Code API has confirmed that credits are exhausted.')
    lines.push('TDD automation is blocked until credits are replenished.')
    lines.push('')
    lines.push('**Action Required**: Contact Anthropic support or wait for credit reset.')
    return lines.join('\n')
  }

  if (!metrics.creditsOk) {
    // Limit exceeded
    if (metrics.limitType === 'daily') {
      lines.push('## ⏸️ Daily Credit Limit Reached')
      lines.push('')
      lines.push(
        `TDD automation paused until daily limit resets in **${metrics.hoursUntilDailyReset} hours**.`
      )
    } else {
      lines.push('## ⏸️ Weekly Credit Limit Reached')
      lines.push('')
      lines.push(
        `TDD automation paused until weekly limit resets in **${metrics.daysUntilWeeklyReset} days**.`
      )
    }
  } else if (metrics.dailyPercent >= 80 || metrics.weeklyPercent >= 80) {
    // Warning: approaching limit
    lines.push('## ⚠️ Warning: Approaching Credit Limit')
    lines.push('')
    if (metrics.dailyPercent >= 80) {
      lines.push(
        `Daily usage is at **${metrics.dailyPercent}%** of limit. Execution will continue but monitor usage closely.`
      )
    } else {
      lines.push(
        `Weekly usage is at **${metrics.weeklyPercent}%** of limit. Execution will continue but monitor usage closely.`
      )
    }
  } else {
    // Under limits
    lines.push('## ✅ Credits Available')
    lines.push('')
    lines.push('Claude Code execution proceeding. Current usage is below warning thresholds.')
  }

  return lines.join('\n')
}

/**
 * Generate usage table section
 */
function generateUsageTable(metrics: CreditMetrics): string {
  const lines: string[] = []

  lines.push('### 📊 Current Usage (Actual Costs)')
  lines.push('')
  lines.push('| Period | Usage | Limit | Remaining | % Used | Runs | Reset In |')
  lines.push('|--------|-------|-------|-----------|--------|------|----------|')
  lines.push(
    `| **Daily** | $${metrics.actualDaily.toFixed(2)} | $${metrics.dailyLimit.toFixed(2)} | $${metrics.dailyRemaining.toFixed(2)} | ${metrics.dailyPercent}% | ${metrics.dailyRuns} | ${metrics.hoursUntilDailyReset}h |`
  )
  lines.push(
    `| **Weekly** | $${metrics.actualWeekly.toFixed(2)} | $${metrics.weeklyLimit.toFixed(2)} | $${metrics.weeklyRemaining.toFixed(2)} | ${metrics.weeklyPercent}% | ${metrics.weeklyRuns} | ${metrics.daysUntilWeeklyReset}d |`
  )

  return lines.join('\n')
}

/**
 * Generate complete credit usage comment
 *
 * Creates markdown comment with:
 * - Status header (⏸️, ⚠️, or ✅)
 * - Current usage table
 * - Reset timers
 *
 * @param metrics - Credit usage metrics
 * @returns Markdown comment string
 */
export function generateCreditComment(metrics: CreditMetrics): Effect.Effect<string> {
  return Effect.sync(() => {
    const header = generateHeader(metrics)
    const table = generateUsageTable(metrics)

    return `${header}\n\n${table}`
  })
}

/**
 * Parse credit metrics from environment variables or GitHub Actions outputs
 *
 * Helper function to extract metrics from string values (as provided by GitHub Actions).
 *
 * @param env - Environment variable object or GitHub Actions outputs
 * @returns Parsed credit metrics
 */
export function parseCreditMetrics(
  env: Record<string, string>
): Effect.Effect<CreditMetrics, ParseMetricsError> {
  return Effect.try({
    try: () => ({
      creditsOk: env['credits-ok'] === 'true' || env['creditsOk'] === 'true',
      exhausted: env['exhausted'] === 'true',
      limitType: (env['limit-type'] || env['limitType'] || 'none') as 'daily' | 'weekly' | 'none',
      dailyRuns: parseInt(env['daily-runs'] || env['dailyRuns'] || '0', 10),
      weeklyRuns: parseInt(env['weekly-runs'] || env['weeklyRuns'] || '0', 10),
      actualDaily: parseFloat(env['actual-daily'] || env['actualDaily'] || '0'),
      actualWeekly: parseFloat(env['actual-weekly'] || env['actualWeekly'] || '0'),
      dailyLimit: parseFloat(env['daily-limit'] || env['dailyLimit'] || '100'),
      weeklyLimit: parseFloat(env['weekly-limit'] || env['weeklyLimit'] || '500'),
      dailyRemaining: parseFloat(env['daily-remaining'] || env['dailyRemaining'] || '100'),
      weeklyRemaining: parseFloat(env['weekly-remaining'] || env['weeklyRemaining'] || '500'),
      dailyPercent: parseInt(env['daily-percent'] || env['dailyPercent'] || '0', 10),
      weeklyPercent: parseInt(env['weekly-percent'] || env['weeklyPercent'] || '0', 10),
      hoursUntilDailyReset: parseInt(
        env['hours-until-daily-reset'] || env['hoursUntilDailyReset'] || '24',
        10
      ),
      daysUntilWeeklyReset: parseInt(
        env['days-until-weekly-reset'] || env['daysUntilWeeklyReset'] || '7',
        10
      ),
    }),
    catch: (cause) => new ParseMetricsError({ cause }),
  })
}
