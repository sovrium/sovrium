#!/usr/bin/env bun
/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Claude Code Usage Tracker
 *
 * Tracks Claude Code usage by parsing GitHub Actions workflow logs.
 * Works with user:inference scope (no OAuth API needed).
 *
 * This script:
 * 1. Fetches recent TDD workflow runs from GitHub
 * 2. Downloads and parses workflow logs
 * 3. Extracts token usage from Claude Code CLI output
 * 4. Calculates costs and checks limits
 * 5. Outputs usage report and warnings
 *
 * Usage:
 *   bun run scripts/tdd-automation/check-claude-code-usage.ts [options]
 *
 * Options:
 *   --check        CI blocking mode - exit 1 if limits exceeded or data unavailable (fail-closed)
 *   --days N       Number of days to analyze (default: 7)
 *   --warn N       Warn if projected usage exceeds N% (default: 80)
 *   --json         Output as JSON
 *   --help, -h     Show this help message
 *
 * Environment Variables:
 *   GH_TOKEN or GITHUB_TOKEN   GitHub Personal Access Token (required)
 *   TDD_DAILY_COST_LIMIT       Daily cost limit in USD (default: 15.00)
 *   TDD_WEEKLY_COST_LIMIT      Weekly cost limit in USD (default: 90.00)
 *   GITHUB_OUTPUT              GitHub Actions output file (auto-set in CI)
 *
 * Examples:
 *   # Check usage for last 7 days (default)
 *   bun run scripts/tdd-automation/check-claude-code-usage.ts
 *
 *   # Check usage for last 30 days
 *   bun run scripts/tdd-automation/check-claude-code-usage.ts --days 30
 *
 *   # CI blocking mode (exits 1 if limits exceeded)
 *   bun run scripts/tdd-automation/check-claude-code-usage.ts --check
 *
 *   # Output as JSON
 *   bun run scripts/tdd-automation/check-claude-code-usage.ts --json
 *
 * Package.json scripts:
 *   bun run tdd:usage       # Last 7 days (default)
 *   bun run tdd:usage:7d    # Last 7 days
 *   bun run tdd:usage:30d   # Last 30 days
 */

import * as fs from 'node:fs'
import { Octokit } from '@octokit/rest'
import { Effect, Console } from 'effect'
import * as JSZip from 'jszip'
import {
  parseUsageFromClaudeOutput,
  calculateCost,
  aggregateUsage,
  checkCostLimits,
  formatCostLimitResult,
  DEFAULT_COST_LIMITS,
  type UsageData,
} from './services/usage-calculator'

interface UsageEntry {
  runId: number
  runNumber: number
  issueNumber: number | null
  createdAt: string
  usage: UsageData
}

interface AnalysisOptions {
  days: number
  warnPercent: number
  outputJson: boolean
  checkMode: boolean
  dailyLimit: number
  weeklyLimit: number
}

/**
 * Tagged error for GitHub API failures
 * Using tagged errors allows Effect to properly track error types
 */
class GitHubApiError extends Error {
  readonly _tag = 'GitHubApiError' as const

  constructor(
    message: string,
    override readonly cause?: unknown
  ) {
    super(message, { cause })
    this.name = 'GitHubApiError'
  }
}

/**
 * Display help message
 */
function showHelp(): void {
  console.log(`
Claude Code Usage Tracker

Track Claude Code usage from TDD automation workflow logs.

USAGE:
  bun run scripts/tdd-automation/check-claude-code-usage.ts [options]

OPTIONS:
  --check        CI blocking mode - exit 1 if limits exceeded or data unavailable
  --days N       Number of days to analyze (default: 7, max: 90)
  --warn N       Warn if projected usage exceeds N% (default: 80)
  --json         Output as JSON (useful for scripting)
  --help, -h     Show this help message

AUTHENTICATION:
  The script supports two authentication methods:

  1. gh CLI (recommended for local development)
     Simply run: gh auth login
     The script will automatically use your gh CLI token.

  2. Environment variables (for CI/CD)
     GH_TOKEN or GITHUB_TOKEN - GitHub Personal Access Token
     Generate at: https://github.com/settings/tokens
     Required scopes: repo (for workflow logs)

  TDD_DAILY_COST_LIMIT       Daily cost limit in USD (default: $15.00)
  TDD_WEEKLY_COST_LIMIT      Weekly cost limit in USD (default: $90.00)

EXAMPLES:
  # Check usage for last 7 days
  bun run tdd:usage

  # Check usage for last 30 days
  bun run tdd:usage:30d

  # CI blocking check (for GitHub Actions)
  bun run scripts/tdd-automation/check-claude-code-usage.ts --check

  # Export usage as JSON
  bun run scripts/tdd-automation/check-claude-code-usage.ts --json > usage.json

PACKAGE.JSON SCRIPTS:
  bun run tdd:usage       Analyze last 7 days (default)
  bun run tdd:usage:7d    Analyze last 7 days
  bun run tdd:usage:30d   Analyze last 30 days

For more information, see:
  docs/development/claude-code-usage-tracking.md
`)
}

/**
 * Write GitHub Actions output variables
 * Only writes if GITHUB_OUTPUT environment variable is set (CI environment)
 */
function writeGitHubOutput(outputs: Record<string, string | boolean | number>): void {
  const outputFile = process.env.GITHUB_OUTPUT
  if (!outputFile) {
    // Not in GitHub Actions, skip
    return
  }

  const lines = Object.entries(outputs)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join('\n')

  fs.appendFileSync(outputFile, lines + '\n')
}

/**
 * Get GitHub token from environment or gh CLI
 *
 * Priority:
 * 1. GH_TOKEN environment variable
 * 2. GITHUB_TOKEN environment variable
 * 3. Token from `gh auth token` command (gh CLI authentication)
 *
 * This allows the script to work both in CI (with env vars) and locally
 * (with gh CLI authenticated via `gh auth login`).
 */
function getGitHubToken(): string {
  // Check environment variables first
  const envToken = process.env.GH_TOKEN || process.env.GITHUB_TOKEN
  if (envToken) {
    return envToken
  }

  // Try to get token from gh CLI
  try {
    const result = Bun.spawnSync(['gh', 'auth', 'token'], {
      stdout: 'pipe',
      stderr: 'pipe',
    })

    if (result.exitCode === 0 && result.stdout) {
      const token = result.stdout.toString().trim()
      if (token && token.length > 0) {
        return token
      }
    }
  } catch {
    // gh CLI not available or failed, continue to error
  }

  throw new Error(
    'GitHub authentication required.\n\n' +
      'Option 1: Use gh CLI (recommended for local development)\n' +
      '  gh auth login\n\n' +
      'Option 2: Set environment variable\n' +
      '  export GH_TOKEN=ghp_your_token_here\n' +
      '  (Generate at: https://github.com/settings/tokens)\n' +
      '  Required scopes: repo (for accessing workflow logs)'
  )
}

/**
 * Create Octokit instance with GitHub token
 * Supports environment variables and gh CLI authentication
 */
const createOctokit = () => {
  const token = getGitHubToken()
  return new Octokit({ auth: token })
}

/**
 * Extract issue number from workflow run name
 * Example: "TDD Execute: Issue #1234" -> 1234
 */
function extractIssueNumber(runName: string): number | null {
  const match = runName.match(/#(\d+)/)
  return match ? parseInt(match[1]!, 10) : null
}

/**
 * Fetch recent workflow runs and extract usage
 */
const fetchUsageFromWorkflows = (options: AnalysisOptions) =>
  Effect.gen(function* () {
    const octokit = createOctokit()

    yield* Console.log(`\n📊 Analyzing Claude Code usage for last ${options.days} days...\n`)

    // Calculate date range
    const since = new Date()
    since.setDate(since.getDate() - options.days)

    // 1. Fetch workflow runs
    yield* Console.log('Fetching workflow runs from GitHub...')

    const { data: workflowRuns } = yield* Effect.tryPromise({
      try: () =>
        octokit.actions.listWorkflowRunsForRepo({
          owner: 'sovrium',
          repo: 'sovrium',
          workflow_id: 'tdd-execute.yml',
          created: `>=${since.toISOString()}`,
          per_page: 100,
        }),
      catch: (error) => new GitHubApiError(`Failed to fetch workflow runs: ${error}`, error),
    })

    yield* Console.log(`Found ${workflowRuns.workflow_runs.length} TDD workflow runs`)

    if (workflowRuns.workflow_runs.length === 0) {
      yield* Console.log('\nNo workflow runs found in the specified period.')
      return []
    }

    // 2. Fetch and parse logs for each run
    yield* Console.log('Downloading workflow logs...')

    const usageEntries: UsageEntry[] = []
    let processedCount = 0

    for (const run of workflowRuns.workflow_runs) {
      processedCount++

      if (processedCount % 10 === 0) {
        yield* Console.log(
          `Processed ${processedCount}/${workflowRuns.workflow_runs.length} runs...`
        )
      }

      const logEntry = yield* Effect.gen(function* () {
        // Download logs (returns ZIP archive)
        const { data: logsData } = yield* Effect.tryPromise({
          try: () =>
            octokit.actions.downloadWorkflowRunLogs({
              owner: 'sovrium',
              repo: 'sovrium',
              run_id: run.id,
            }),
          catch: () => null, // Skip if logs unavailable
        })

        if (!logsData) return null

        // Extract ZIP and find Claude execution logs
        const logContent = yield* Effect.tryPromise({
          try: async () => {
            const zipData =
              logsData instanceof ArrayBuffer ? logsData : Buffer.from(logsData as string)
            const zip = await JSZip.default.loadAsync(zipData)

            // Look for the execute-claude job log file
            // GitHub Actions stores logs as: job_name/step_name.txt
            const allContent: string[] = []

            for (const filename of Object.keys(zip.files)) {
              const file = zip.files[filename]
              if (!file) continue

              // Match execute-claude job logs (where Claude Code actually runs)
              if (
                filename.toLowerCase().includes('execute-claude') ||
                filename.toLowerCase().includes('run claude') ||
                filename.toLowerCase().includes('claude code')
              ) {
                const content = await file.async('string')
                allContent.push(content)
              }
            }

            // If no specific Claude job found, try all log files
            if (allContent.length === 0) {
              for (const filename of Object.keys(zip.files)) {
                const file = zip.files[filename]
                if (!file || file.dir || !filename.endsWith('.txt')) continue

                const content = await file.async('string')
                // Only include if it might contain usage data (text or JSON format)
                if (
                  content.includes('Usage:') ||
                  content.includes('input tokens') ||
                  content.includes('total_cost_usd') // JSON format from Claude Code SDK
                ) {
                  allContent.push(content)
                }
              }
            }

            return allContent.join('\n')
          },
          catch: () => null,
        })

        if (!logContent) return null

        // Parse usage from logs
        const usage = parseUsageFromClaudeOutput(logContent)
        if (!usage) return null

        return {
          runId: run.id,
          runNumber: run.run_number,
          issueNumber: extractIssueNumber(run.name || ''),
          createdAt: run.created_at,
          usage,
        }
      }).pipe(Effect.catchAll(() => Effect.succeed(null)))

      if (logEntry) {
        usageEntries.push(logEntry)
      }
    }

    yield* Console.log(`✅ Processed ${usageEntries.length} runs with usage data\n`)

    return usageEntries
  })

/**
 * Analyze usage and generate report
 */
const analyzeUsage = (entries: UsageEntry[], options: AnalysisOptions) =>
  Effect.gen(function* () {
    if (entries.length === 0) {
      yield* Console.log('No usage data found.')
      return
    }

    // Aggregate usage
    const usageList = entries.map((entry) => entry.usage)
    const totals = aggregateUsage(usageList)

    // Calculate daily and weekly costs
    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const dailyEntries = entries.filter((e) => new Date(e.createdAt) >= oneDayAgo)
    const weeklyEntries = entries.filter((e) => new Date(e.createdAt) >= sevenDaysAgo)

    const dailyCost = dailyEntries.reduce((sum, e) => sum + calculateCost(e.usage), 0)
    const weeklyCost = weeklyEntries.reduce((sum, e) => sum + calculateCost(e.usage), 0)

    // Check limits using checkCostLimits
    const limitCheck = checkCostLimits(
      dailyCost,
      weeklyCost,
      options.dailyLimit,
      options.weeklyLimit
    )

    // Calculate projected monthly cost for display
    const projectedMonthlyCost = (weeklyCost / 7) * 30

    // Generate status and message from checkCostLimits result
    const status: 'ok' | 'warning' | 'critical' = !limitCheck.canProceed
      ? 'critical'
      : limitCheck.dailyPercent >= 80 || limitCheck.weeklyPercent >= 80
        ? 'warning'
        : 'ok'

    const message =
      status === 'critical'
        ? `⛔ CRITICAL: ${limitCheck.reason === 'daily_exceeded' ? 'Daily' : 'Weekly'} usage limit exceeded`
        : status === 'warning'
          ? `⚠️  WARNING: High usage detected (${Math.max(limitCheck.dailyPercent, limitCheck.weeklyPercent).toFixed(1)}% of limit)`
          : `✅ Usage is within limits (${Math.max(limitCheck.dailyPercent, limitCheck.weeklyPercent).toFixed(1)}% of limit)`

    // Output report
    if (options.outputJson) {
      const jsonOutput = {
        period: {
          days: options.days,
          from: new Date(now.getTime() - options.days * 24 * 60 * 60 * 1000).toISOString(),
          to: now.toISOString(),
        },
        totals: {
          runs: totals.runs,
          tokens: totals.totalTokens,
          inputTokens: totals.totalInputTokens,
          outputTokens: totals.totalOutputTokens,
          cost: totals.totalCost,
          avgTokensPerRun: totals.avgTokensPerRun,
          avgCostPerRun: totals.avgCostPerRun,
        },
        daily: {
          runs: dailyEntries.length,
          cost: dailyCost,
          percent: limitCheck.dailyPercent,
        },
        weekly: {
          runs: weeklyEntries.length,
          cost: weeklyCost,
          percent: limitCheck.weeklyPercent,
        },
        projected: {
          monthlyCost: projectedMonthlyCost,
        },
        limits: {
          status,
          message,
        },
        models: totals.modelBreakdown,
        topConsumers: entries
          .sort((a, b) => {
            const aTokens = a.usage.inputTokens + a.usage.outputTokens
            const bTokens = b.usage.inputTokens + b.usage.outputTokens
            return bTokens - aTokens
          })
          .slice(0, 5)
          .map((e) => ({
            issueNumber: e.issueNumber,
            runNumber: e.runNumber,
            tokens: e.usage.inputTokens + e.usage.outputTokens,
            cost: calculateCost(e.usage),
          })),
      }

      console.log(JSON.stringify(jsonOutput, null, 2))
    } else {
      // Display formatted report
      yield* Console.log('═══════════════════════════════════════════════════')
      yield* Console.log('  CLAUDE CODE USAGE REPORT (TDD Automation)')
      yield* Console.log('═══════════════════════════════════════════════════\n')

      yield* Console.log(`📅 Period: Last ${options.days} days`)
      yield* Console.log(`🔄 Total runs: ${totals.runs}`)
      yield* Console.log(`📊 Total tokens: ${totals.totalTokens.toLocaleString()}`)
      yield* Console.log(
        `   ├─ Input:  ${totals.totalInputTokens.toLocaleString()} (${((totals.totalInputTokens / totals.totalTokens) * 100).toFixed(1)}%)`
      )
      yield* Console.log(
        `   └─ Output: ${totals.totalOutputTokens.toLocaleString()} (${((totals.totalOutputTokens / totals.totalTokens) * 100).toFixed(1)}%)`
      )
      yield* Console.log(`💰 Total cost: $${totals.totalCost.toFixed(2)}`)
      yield* Console.log(
        `📈 Average per run: ${totals.avgTokensPerRun.toLocaleString()} tokens ($${totals.avgCostPerRun.toFixed(2)})`
      )

      yield* Console.log('\n📊 USAGE BREAKDOWN')
      yield* Console.log(`   Today (last 24h):`)
      yield* Console.log(`     Runs: ${dailyEntries.length}`)
      yield* Console.log(
        `     Cost: $${dailyCost.toFixed(2)} / $${options.dailyLimit.toFixed(2)} (${limitCheck.dailyPercent.toFixed(1)}% of daily limit)`
      )

      yield* Console.log(`   This week (last 7d):`)
      yield* Console.log(`     Runs: ${weeklyEntries.length}`)
      yield* Console.log(
        `     Cost: $${weeklyCost.toFixed(2)} / $${options.weeklyLimit.toFixed(2)} (${limitCheck.weeklyPercent.toFixed(1)}% of weekly limit)`
      )

      yield* Console.log(`   Monthly projection:`)
      yield* Console.log(`     Cost: $${projectedMonthlyCost.toFixed(2)}`)

      yield* Console.log(`\n${message}`)

      if (status !== 'ok') {
        yield* Console.log('\n💡 RECOMMENDATIONS:')
        yield* Console.log('   - Review failed specs for inefficiencies')
        yield* Console.log('   - Consider reducing --max-budget-usd per spec')
        yield* Console.log('   - Pause TDD automation temporarily if critical')
      }

      // Model breakdown
      yield* Console.log('\n📱 MODEL BREAKDOWN')
      for (const [model, count] of Object.entries(totals.modelBreakdown)) {
        yield* Console.log(`   ${model}: ${count} runs`)
      }

      // Top consumers
      yield* Console.log('\n🔝 TOP 5 RUNS BY TOKEN USAGE')
      const topConsumers = entries
        .sort((a, b) => {
          const aTokens = a.usage.inputTokens + a.usage.outputTokens
          const bTokens = b.usage.inputTokens + b.usage.outputTokens
          return bTokens - aTokens
        })
        .slice(0, 5)

      for (const entry of topConsumers) {
        const tokens = entry.usage.inputTokens + entry.usage.outputTokens
        const cost = calculateCost(entry.usage)
        const issueStr = entry.issueNumber ? `#${entry.issueNumber}` : 'N/A'
        yield* Console.log(
          `   ${issueStr.padEnd(8)} │ Run #${entry.runNumber.toString().padEnd(5)} │ ${tokens.toLocaleString().padStart(8)} tokens │ $${cost.toFixed(2)}`
        )
      }

      yield* Console.log('\n═══════════════════════════════════════════════════\n')
    }

    // Return status code
    return status === 'critical' ? 1 : 0
  })

/**
 * Run blocking check mode for CI workflows
 *
 * Implements fail-closed behavior:
 * - Exit 0: Can proceed (within limits AND data available)
 * - Exit 1: Cannot proceed (limits exceeded OR data unavailable)
 *
 * Outputs GitHub Actions variables:
 * - can_proceed: 'true' or 'false'
 * - daily_cost: Cost in last 24 hours
 * - weekly_cost: Cost in last 7 days
 * - reason: 'within_limits' | 'daily_exceeded' | 'weekly_exceeded' | 'data_unavailable'
 */
const runBlockingCheck = (options: AnalysisOptions) =>
  Effect.gen(function* () {
    yield* Console.log('💰 Running usage check (blocking mode)...')
    yield* Console.log(`   Daily limit:  $${options.dailyLimit.toFixed(2)}`)
    yield* Console.log(`   Weekly limit: $${options.weeklyLimit.toFixed(2)}\n`)

    // Fetch usage data (analyze last 7 days for weekly, but focus on costs)
    const entries = yield* fetchUsageFromWorkflows({ ...options, days: 7 })

    // If no data available, fail closed
    if (entries.length === 0) {
      yield* Console.log('⛔ FAIL-CLOSED: No usage data available')
      yield* Console.log('   Cannot verify usage is within limits.')
      yield* Console.log('   Blocking execution as a safety measure.\n')

      writeGitHubOutput({
        can_proceed: 'false',
        daily_cost: '0.00',
        weekly_cost: '0.00',
        reason: 'data_unavailable',
      })

      return 1 // Exit 1 - cannot proceed
    }

    // Calculate daily and weekly costs
    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const dailyEntries = entries.filter((e) => new Date(e.createdAt) >= oneDayAgo)
    const weeklyEntries = entries.filter((e) => new Date(e.createdAt) >= sevenDaysAgo)

    const dailyCost = dailyEntries.reduce((sum, e) => sum + calculateCost(e.usage), 0)
    const weeklyCost = weeklyEntries.reduce((sum, e) => sum + calculateCost(e.usage), 0)

    // Check against limits
    const result = checkCostLimits(dailyCost, weeklyCost, options.dailyLimit, options.weeklyLimit)

    // Output result
    yield* Console.log(formatCostLimitResult(result))
    yield* Console.log(
      `\n   Runs analyzed: ${entries.length} (${dailyEntries.length} today, ${weeklyEntries.length} this week)`
    )

    // Write GitHub Actions output
    writeGitHubOutput({
      can_proceed: result.canProceed ? 'true' : 'false',
      daily_cost: dailyCost.toFixed(2),
      weekly_cost: weeklyCost.toFixed(2),
      daily_percent: result.dailyPercent.toFixed(1),
      weekly_percent: result.weeklyPercent.toFixed(1),
      reason: result.reason,
    })

    if (result.canProceed) {
      yield* Console.log('\n✅ Usage check PASSED - proceeding with execution\n')
      return 0
    } else {
      yield* Console.log('\n⛔ Usage check FAILED - blocking execution')
      yield* Console.log('   TDD automation will not process new specs until usage is reduced.\n')
      return 1
    }
  })

/**
 * Main program
 */
const main = Effect.gen(function* () {
  const args = process.argv.slice(2)

  // Show help if requested
  if (args.includes('--help') || args.includes('-h')) {
    showHelp()
    return 0
  }

  // Parse environment variables for limits (allows CI configuration)
  const dailyLimitEnv = process.env.TDD_DAILY_COST_LIMIT
  const weeklyLimitEnv = process.env.TDD_WEEKLY_COST_LIMIT

  const options: AnalysisOptions = {
    days: args.includes('--days') ? parseInt(args[args.indexOf('--days') + 1]!, 10) : 7,
    warnPercent: args.includes('--warn') ? parseInt(args[args.indexOf('--warn') + 1]!, 10) : 80,
    outputJson: args.includes('--json'),
    checkMode: args.includes('--check'),
    dailyLimit: dailyLimitEnv ? parseFloat(dailyLimitEnv) : DEFAULT_COST_LIMITS.dailyLimitUsd,
    weeklyLimit: weeklyLimitEnv ? parseFloat(weeklyLimitEnv) : DEFAULT_COST_LIMITS.weeklyLimitUsd,
  }

  // Validate limits
  if (isNaN(options.dailyLimit) || options.dailyLimit <= 0) {
    yield* Console.error('Error: TDD_DAILY_COST_LIMIT must be a positive number')
    return 1
  }

  if (isNaN(options.weeklyLimit) || options.weeklyLimit <= 0) {
    yield* Console.error('Error: TDD_WEEKLY_COST_LIMIT must be a positive number')
    return 1
  }

  // Validate days
  if (isNaN(options.days) || options.days < 1 || options.days > 90) {
    yield* Console.error('Error: --days must be between 1 and 90')
    return 1
  }

  // Run in check mode (blocking for CI) or analysis mode (report)
  if (options.checkMode) {
    return yield* runBlockingCheck(options)
  }

  // Standard analysis mode
  const entries = yield* fetchUsageFromWorkflows(options)
  const exitCode = yield* analyzeUsage(entries, options)

  return exitCode
})

// Run program
Effect.runPromise(main).then(
  (exitCode) => {
    process.exit(exitCode)
  },
  (error) => {
    console.error('Usage check failed:', error)
    process.exit(1)
  }
)
