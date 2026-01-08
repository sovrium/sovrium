/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Claude Code Usage Tracker Service
 *
 * Tracks Claude Code usage via the official Anthropic OAuth usage API to ensure
 * sustainable consumption of the subscription:
 * - Daily limit: Max 15% of weekly subscription per day (spreads usage across week)
 * - Weekly limit: Stop at 90% max before weekly renewal (10% buffer for manual work)
 * - Prevents exhausting subscription mid-week
 *
 * Uses the official Anthropic OAuth usage API:
 * - Endpoint: https://api.anthropic.com/api/oauth/usage
 * - Returns five_hour and seven_day utilization percentages
 *
 * Authentication:
 * - In CI: Uses CLAUDE_CODE_OAUTH_TOKEN environment variable
 * - Locally: Reads from macOS Keychain (Claude Code-credentials)
 */

import * as Effect from 'effect/Effect'
import { CommandService, type LoggerService, logInfo, logWarn, success } from '../../lib/effect'

/**
 * Usage data from Claude Code API
 */
export interface ClaudeCodeUsage {
  /** Five-hour window utilization (0-1 scale, 1 = 100%) */
  fiveHour: {
    utilization: number
    resetsAt: string
  }
  /** Seven-day window utilization (0-1 scale, 1 = 100%) */
  sevenDay: {
    utilization: number
    resetsAt: string
  }
}

/**
 * Usage configuration
 */
export interface UsageConfig {
  /**
   * Maximum daily utilization as percentage of seven-day limit (default: 15%)
   * This helps spread usage across the week evenly
   * 15% daily x 7 days = 105% theoretical max (with buffer for variable usage)
   */
  maxDailyUtilizationPercent: number
  /**
   * Maximum weekly utilization percentage (default: 90%)
   * Leaves 10% buffer for manual/interactive work
   */
  maxWeeklyUtilizationPercent: number
  /**
   * Maximum five-hour window utilization (default: 80%)
   * Prevents burst usage that could hit rate limits
   */
  maxFiveHourUtilizationPercent: number
}

/**
 * Usage check result
 */
export interface UsageCheckResult {
  /** Whether usage is within limits */
  canProceed: boolean
  /** Reason for blocking (if canProceed is false) */
  reason?: string
  /** Current five-hour utilization percentage */
  fiveHourPercent: number
  /** Current seven-day utilization percentage */
  sevenDayPercent: number
  /** Estimated daily usage (based on seven-day / 7) */
  estimatedDailyPercent: number
  /** Time until five-hour window resets */
  fiveHourResetsAt: string
  /** Time until seven-day window resets */
  sevenDayResetsAt: string
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: UsageConfig = {
  maxDailyUtilizationPercent: 15, // Max 15% of weekly per day
  maxWeeklyUtilizationPercent: 90, // Max 90% of weekly total (10% buffer)
  maxFiveHourUtilizationPercent: 80, // Max 80% of five-hour window
}

/**
 * Claude Code API endpoint for usage data
 */
const USAGE_API_URL = 'https://api.anthropic.com/api/oauth/usage'

/**
 * Tagged error for usage check failures
 */
class UsageCheckError {
  readonly _tag = 'UsageCheckError'
  constructor(readonly message: string) {}
}

/**
 * Get OAuth token from environment or Keychain
 */
export const getOAuthToken = Effect.gen(function* () {
  const cmd = yield* CommandService

  // First, try environment variable (for CI/CD)
  const envToken = process.env.CLAUDE_CODE_OAUTH_TOKEN
  if (envToken && envToken.trim().length > 0) {
    yield* logInfo('Using CLAUDE_CODE_OAUTH_TOKEN from environment', '🔑')
    return envToken.trim()
  }

  // For local development, try macOS Keychain
  yield* logInfo('Attempting to read token from macOS Keychain...', '🔐')

  const keychainOutput = yield* cmd
    .exec('security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null', {
      throwOnError: false,
    })
    .pipe(Effect.catchAll(() => Effect.succeed('')))

  if (!keychainOutput || keychainOutput.trim().length === 0) {
    yield* logWarn('No OAuth token found in Keychain or environment')
    return null
  }

  // Parse the keychain credentials (JSON format)
  const parseResult = yield* Effect.try(() => {
    const credentials = JSON.parse(keychainOutput.trim())
    // The token is stored in access_token field
    return credentials.access_token as string | undefined
  }).pipe(Effect.orElseSucceed(() => undefined))

  if (!parseResult) {
    yield* logWarn('Failed to parse Keychain credentials')
    return null
  }

  yield* logInfo('Retrieved OAuth token from Keychain', '✅')
  return parseResult
})

/**
 * Fetch usage data from Claude Code API
 */
export const fetchClaudeCodeUsage = Effect.gen(function* () {
  const cmd = yield* CommandService

  yield* logInfo('Fetching Claude Code usage from API...', '📊')

  // Get OAuth token
  const token = yield* getOAuthToken

  if (!token) {
    return yield* Effect.fail(
      new UsageCheckError(
        'No OAuth token available. Set CLAUDE_CODE_OAUTH_TOKEN environment variable.'
      )
    )
  }

  // Make API request using curl (more portable than fetch in Bun scripts)
  const curlOutput = yield* cmd
    .exec(
      `curl -s -X GET "${USAGE_API_URL}" ` +
        `-H "Authorization: Bearer ${token}" ` +
        `-H "anthropic-beta: oauth-2025-04-20" ` +
        `-H "Content-Type: application/json" ` +
        `-H "Accept: application/json"`,
      { throwOnError: false }
    )
    .pipe(
      Effect.catchAll((error) => Effect.fail(new UsageCheckError(`API request failed: ${error}`)))
    )

  if (!curlOutput || curlOutput.trim().length === 0) {
    return yield* Effect.fail(new UsageCheckError('Empty response from usage API'))
  }

  // Parse response
  const parseResult = yield* Effect.try({
    try: (): ClaudeCodeUsage => {
      const data = JSON.parse(curlOutput) as {
        five_hour?: { utilization: number; resets_at: string }
        seven_day?: { utilization: number; resets_at: string }
        error?: { message: string }
      }

      if (data.error) {
        throw new Error(data.error.message)
      }

      if (!data.five_hour || !data.seven_day) {
        throw new Error('Invalid response structure')
      }

      return {
        fiveHour: {
          utilization: data.five_hour.utilization,
          resetsAt: data.five_hour.resets_at,
        },
        sevenDay: {
          utilization: data.seven_day.utilization,
          resetsAt: data.seven_day.resets_at,
        },
      }
    },
    catch: (error): UsageCheckError => new UsageCheckError(`Failed to parse usage data: ${error}`),
  })

  return parseResult
})

/**
 * Check if usage is within configured limits
 */
export const checkUsageLimits = (
  config: UsageConfig = DEFAULT_CONFIG
): Effect.Effect<UsageCheckResult, UsageCheckError, CommandService | LoggerService> =>
  Effect.gen(function* () {
    yield* logInfo('Checking Claude Code usage limits...', '🔍')

    // Fetch current usage from API
    const usage = yield* fetchClaudeCodeUsage

    // Convert to percentages
    const fiveHourPercent = usage.fiveHour.utilization * 100
    const sevenDayPercent = usage.sevenDay.utilization * 100

    // Estimate daily usage (assuming even distribution over 7 days)
    // This is approximate since we don't have per-day breakdown
    const estimatedDailyPercent = sevenDayPercent / 7

    yield* logInfo(`Five-hour usage: ${fiveHourPercent.toFixed(1)}%`)
    yield* logInfo(`Seven-day usage: ${sevenDayPercent.toFixed(1)}%`)
    yield* logInfo(`Estimated daily usage: ${estimatedDailyPercent.toFixed(1)}%`)

    // Check limits
    let canProceed = true
    let reason: string | undefined

    // Check seven-day (weekly) limit first - most important
    if (sevenDayPercent >= config.maxWeeklyUtilizationPercent) {
      canProceed = false
      reason =
        `Weekly limit reached: ${sevenDayPercent.toFixed(1)}% >= ${config.maxWeeklyUtilizationPercent}% max. ` +
        `Resets at ${usage.sevenDay.resetsAt}. ` +
        `${(100 - sevenDayPercent).toFixed(1)}% remaining is reserved for manual work.`
      yield* logWarn(`⛔ ${reason}`)
    }
    // Check five-hour window to prevent burst usage
    else if (fiveHourPercent >= config.maxFiveHourUtilizationPercent) {
      canProceed = false
      reason =
        `Five-hour rate limit: ${fiveHourPercent.toFixed(1)}% >= ${config.maxFiveHourUtilizationPercent}% max. ` +
        `Resets at ${usage.fiveHour.resetsAt}. Wait for rate limit to reset.`
      yield* logWarn(`⏳ ${reason}`)
    }
    // Check daily estimate to spread usage evenly
    else if (estimatedDailyPercent >= config.maxDailyUtilizationPercent * 7) {
      // Note: This is a soft limit based on weekly / 7
      // Actual daily tracking would require persisting state
      canProceed = false
      reason =
        `Daily estimate high: ~${estimatedDailyPercent.toFixed(1)}% today. ` +
        `Consider spreading usage more evenly across the week.`
      yield* logWarn(`📊 ${reason}`)
    }

    if (canProceed) {
      const weeklyRemaining = config.maxWeeklyUtilizationPercent - sevenDayPercent
      yield* success(
        `Usage within limits: ${weeklyRemaining.toFixed(1)}% weekly capacity remaining`
      )
    }

    return {
      canProceed,
      reason,
      fiveHourPercent,
      sevenDayPercent,
      estimatedDailyPercent,
      fiveHourResetsAt: usage.fiveHour.resetsAt,
      sevenDayResetsAt: usage.sevenDay.resetsAt,
    }
  })

/**
 * Get formatted usage status for display
 */
export const getUsageStatus = (
  config: UsageConfig = DEFAULT_CONFIG
): Effect.Effect<string, UsageCheckError, CommandService | LoggerService> =>
  Effect.gen(function* () {
    const result = yield* checkUsageLimits(config)

    const weeklyRemaining = config.maxWeeklyUtilizationPercent - result.sevenDayPercent
    const fiveHourRemaining = config.maxFiveHourUtilizationPercent - result.fiveHourPercent

    return `
╔══════════════════════════════════════════════════════════════╗
║                   Claude Code Usage Status                   ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  Five-Hour Window:  ${result.fiveHourPercent.toFixed(1).padStart(5)}% used (${fiveHourRemaining.toFixed(1).padStart(5)}% remaining)  ║
║  Seven-Day Window:  ${result.sevenDayPercent.toFixed(1).padStart(5)}% used (${weeklyRemaining.toFixed(1).padStart(5)}% remaining)  ║
║                                                              ║
║  ─────────────────────────────────────────────────────────── ║
║                                                              ║
║  Limits:                                                     ║
║    • Five-hour max:  ${config.maxFiveHourUtilizationPercent.toString().padStart(3)}%                                  ║
║    • Weekly max:     ${config.maxWeeklyUtilizationPercent.toString().padStart(3)}% (leaves ${100 - config.maxWeeklyUtilizationPercent}% for manual work)      ║
║    • Daily target:   ~${config.maxDailyUtilizationPercent}% per day (spread evenly)            ║
║                                                              ║
║  ─────────────────────────────────────────────────────────── ║
║                                                              ║
║  Status: ${result.canProceed ? '✅ CAN PROCEED' : '⛔ BLOCKED    '}                                  ║
${result.reason ? `║  Reason: ${result.reason.slice(0, 50).padEnd(51)}║\n` : ''}║                                                              ║
║  Resets:                                                     ║
║    • Five-hour: ${result.fiveHourResetsAt.padEnd(42)}║
║    • Seven-day: ${result.sevenDayResetsAt.padEnd(42)}║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`
  })

/**
 * Quick check if we can proceed (returns boolean, swallows errors)
 * Use this in workflows for simple go/no-go decisions
 */
export const canProceedWithUsage = (
  config: UsageConfig = DEFAULT_CONFIG
): Effect.Effect<boolean, never, CommandService | LoggerService> =>
  checkUsageLimits(config).pipe(
    Effect.map((result) => result.canProceed),
    Effect.catchAll((error) => {
      // Log error but allow proceeding if API is unavailable
      console.error(`Usage check failed: ${error.message}`)
      console.log('⚠️ Allowing proceed due to API error (fail-open)')
      return Effect.succeed(true)
    })
  )
