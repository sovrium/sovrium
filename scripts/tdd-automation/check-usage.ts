#!/usr/bin/env bun
/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Claude Code Usage Checker CLI
 *
 * Checks current Claude Code usage against configured limits and outputs
 * results for use in GitHub Actions workflows.
 *
 * Usage:
 *   bun run scripts/tdd-automation/check-usage.ts [command]
 *
 * Commands:
 *   status   - Show detailed usage status (default)
 *   check    - Quick check if we can proceed (for CI)
 *   json     - Output usage data as JSON
 *
 * Environment Variables:
 *   CLAUDE_CODE_OAUTH_TOKEN - OAuth token for API access
 *   GITHUB_OUTPUT           - GitHub Actions output file
 *
 * Exit Codes:
 *   0 - Can proceed (usage within limits)
 *   1 - Cannot proceed (usage exceeds limits)
 *   2 - Error (API failure, token missing, etc.)
 */

import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { CommandServiceLive, LoggerServicePretty, logInfo, logError, success } from '../lib/effect'
import {
  checkUsageLimits,
  getUsageStatus,
  canProceedWithUsage,
  fetchClaudeCodeUsage,
  DEFAULT_CONFIG,
  type UsageConfig,
} from './services/usage-tracker'

/**
 * Parse custom config from environment variables
 */
const getConfigFromEnv = (): UsageConfig => {
  const config = { ...DEFAULT_CONFIG }

  if (process.env.TDD_MAX_DAILY_PERCENT) {
    config.maxDailyUtilizationPercent = parseInt(process.env.TDD_MAX_DAILY_PERCENT, 10)
  }

  if (process.env.TDD_MAX_WEEKLY_PERCENT) {
    config.maxWeeklyUtilizationPercent = parseInt(process.env.TDD_MAX_WEEKLY_PERCENT, 10)
  }

  if (process.env.TDD_MAX_FIVE_HOUR_PERCENT) {
    config.maxFiveHourUtilizationPercent = parseInt(process.env.TDD_MAX_FIVE_HOUR_PERCENT, 10)
  }

  return config
}

/**
 * Write output for GitHub Actions
 */
const writeGitHubOutput = (outputs: Record<string, string | number | boolean>) => {
  if (process.env.GITHUB_OUTPUT) {
    const outputLines = Object.entries(outputs)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n')

    Bun.write(process.env.GITHUB_OUTPUT, outputLines + '\n')
  }
}

/**
 * Command: status - Show detailed usage status
 */
const commandStatus = Effect.gen(function* () {
  const config = getConfigFromEnv()

  yield* logInfo('Claude Code Usage Status', '📊')
  yield* logInfo('═'.repeat(50))

  const statusOutput = yield* getUsageStatus(config).pipe(
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        yield* logError(`Failed to get usage status: ${error.message}`)
        return `Error: ${error.message}`
      })
    )
  )

  console.log(statusOutput)

  // Also output check result for CI
  const result = yield* checkUsageLimits(config).pipe(
    Effect.catchAll(() => Effect.succeed({ canProceed: true }))
  )

  writeGitHubOutput({
    can_proceed: result.canProceed,
  })

  return result.canProceed
})

/**
 * Command: check - Quick check for CI (outputs can_proceed)
 */
const commandCheck = Effect.gen(function* () {
  const config = getConfigFromEnv()

  yield* logInfo('Checking Claude Code usage limits...', '🔍')

  const result = yield* checkUsageLimits(config).pipe(
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        yield* logError(`Usage check failed: ${error.message}`)
        // Fail-open: allow proceeding if API is unavailable
        yield* logInfo('⚠️ Allowing proceed due to API error (fail-open)')
        return {
          canProceed: true,
          reason: `API error: ${error.message}`,
          fiveHourPercent: 0,
          sevenDayPercent: 0,
          estimatedDailyPercent: 0,
          fiveHourResetsAt: 'unknown',
          sevenDayResetsAt: 'unknown',
        }
      })
    )
  )

  if (result.canProceed) {
    yield* success('✅ Usage within limits - can proceed')
  } else {
    yield* logError(`⛔ Usage limit exceeded: ${result.reason}`)
  }

  writeGitHubOutput({
    can_proceed: result.canProceed,
    five_hour_percent: result.fiveHourPercent,
    seven_day_percent: result.sevenDayPercent,
    reason: result.reason || '',
  })

  return result.canProceed
})

/**
 * Command: json - Output raw usage data as JSON
 */
const commandJson = Effect.gen(function* () {
  const config = getConfigFromEnv()

  const usage = yield* fetchClaudeCodeUsage.pipe(
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        const errorJson = JSON.stringify({ error: error.message }, null, 2)
        console.log(errorJson)
        return null
      })
    )
  )

  if (!usage) {
    return false
  }

  const result = yield* checkUsageLimits(config).pipe(
    Effect.catchAll(() =>
      Effect.succeed({
        canProceed: true,
        reason: undefined,
        fiveHourPercent: usage.fiveHour.utilization * 100,
        sevenDayPercent: usage.sevenDay.utilization * 100,
        estimatedDailyPercent: (usage.sevenDay.utilization * 100) / 7,
        fiveHourResetsAt: usage.fiveHour.resetsAt,
        sevenDayResetsAt: usage.sevenDay.resetsAt,
      })
    )
  )

  const output = {
    usage: {
      fiveHour: {
        percent: usage.fiveHour.utilization * 100,
        resetsAt: usage.fiveHour.resetsAt,
      },
      sevenDay: {
        percent: usage.sevenDay.utilization * 100,
        resetsAt: usage.sevenDay.resetsAt,
      },
    },
    limits: {
      maxDailyPercent: config.maxDailyUtilizationPercent,
      maxWeeklyPercent: config.maxWeeklyUtilizationPercent,
      maxFiveHourPercent: config.maxFiveHourUtilizationPercent,
    },
    check: {
      canProceed: result.canProceed,
      reason: result.reason,
    },
  }

  console.log(JSON.stringify(output, null, 2))

  writeGitHubOutput({
    can_proceed: result.canProceed,
    usage_json: JSON.stringify(output),
  })

  return result.canProceed
})

/**
 * Main CLI entry point
 */
const main = Effect.gen(function* () {
  const command = process.argv[2] || 'status'

  let canProceed = true

  switch (command) {
    case 'status':
      canProceed = yield* commandStatus
      break
    case 'check':
      canProceed = yield* commandCheck
      break
    case 'json':
      canProceed = yield* commandJson
      break
    case 'help':
    case '--help':
    case '-h':
      console.log(`
Claude Code Usage Checker

Usage:
  bun run scripts/tdd-automation/check-usage.ts [command]

Commands:
  status   Show detailed usage status (default)
  check    Quick check if we can proceed (for CI)
  json     Output usage data as JSON
  help     Show this help message

Environment Variables:
  CLAUDE_CODE_OAUTH_TOKEN     OAuth token for API access (required in CI)
  TDD_MAX_DAILY_PERCENT       Max daily usage (default: 15)
  TDD_MAX_WEEKLY_PERCENT      Max weekly usage (default: 90)
  TDD_MAX_FIVE_HOUR_PERCENT   Max five-hour window usage (default: 80)

Exit Codes:
  0 - Can proceed (usage within limits)
  1 - Cannot proceed (usage exceeds limits)
  2 - Error (API failure, token missing, etc.)
`)
      break
    default:
      yield* logError(`Unknown command: ${command}`)
      yield* logError('Use --help for usage information')
      process.exit(2)
  }

  // Exit with appropriate code
  if (!canProceed) {
    process.exit(1)
  }
})

// Run with dependencies
const MainLayer = Layer.merge(CommandServiceLive, LoggerServicePretty())

Effect.runPromise(
  main.pipe(
    Effect.provide(MainLayer),
    Effect.catchAll((error) =>
      Effect.sync(() => {
        console.error('Usage check error:', error)
        process.exit(2)
      })
    )
  )
)
