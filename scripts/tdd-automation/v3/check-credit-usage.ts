/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Check Claude Code Credit Usage
 *
 * Tracks daily and weekly credit usage for TDD automation.
 * Supports multiple cost parsing patterns and falls back to conservative estimate.
 *
 * Usage:
 *   bun run scripts/tdd-automation/v3/check-credit-usage.ts
 *
 * Environment:
 *   - GITHUB_REPOSITORY: owner/repo
 *   - GH_TOKEN or GITHUB_TOKEN: GitHub API token
 *   - TDD_DAILY_LIMIT: Override daily limit (default: $100)
 *   - TDD_WEEKLY_LIMIT: Override weekly limit (default: $500)
 *
 * Output (JSON):
 *   {
 *     "dailySpend": 45.50,
 *     "weeklySpend": 230.00,
 *     "dailyLimit": 100,
 *     "weeklyLimit": 500,
 *     "isAtDailyLimit": false,
 *     "isAtWeeklyLimit": false,
 *     "dailyWarning": false,
 *     "weeklyWarning": true
 *   }
 */

import { TDD_CONFIG, type CreditUsage } from './types'

/**
 * Patterns to extract cost from Claude Code workflow logs
 * Multiple patterns for resilience against format changes
 */
const COST_PATTERNS = [
  // Pattern 1: "Total cost: $X.XX"
  /Total cost:\s*\$?([\d.]+)/i,
  // Pattern 2: "Cost: $X.XX"
  /Cost:\s*\$?([\d.]+)/i,
  // Pattern 3: "API cost: $X.XX"
  /API cost:\s*\$?([\d.]+)/i,
  // Pattern 4: "Usage: $X.XX"
  /Usage:\s*\$?([\d.]+)/i,
  // Pattern 5: JSON format "cost": X.XX
  /"cost":\s*([\d.]+)/i,
]

/**
 * Extract cost from workflow log content
 *
 * @param logContent Raw log content string
 * @returns Extracted cost or fallback value
 */
export function extractCostFromLogs(logContent: string): number {
  // Try each pattern in order
  for (const pattern of COST_PATTERNS) {
    const match = logContent.match(pattern)
    if (match && match[1]) {
      const cost = parseFloat(match[1])
      if (!isNaN(cost) && cost >= 0) {
        return cost
      }
    }
  }

  // If no pattern matches, use conservative fallback
  console.error(
    `⚠️ Could not parse cost from logs, using fallback: $${TDD_CONFIG.FALLBACK_COST_PER_RUN}`
  )
  return TDD_CONFIG.FALLBACK_COST_PER_RUN
}

/**
 * Get repository info from environment
 */
function getRepoInfo(): { owner: string; repo: string; token: string } {
  const repository = process.env['GITHUB_REPOSITORY'] || ''
  const [owner, repo] = repository.split('/')
  const token = process.env['GH_TOKEN'] || process.env['GITHUB_TOKEN'] || ''

  if (!owner || !repo) {
    throw new Error('GITHUB_REPOSITORY environment variable not set or invalid')
  }

  if (!token) {
    throw new Error('GH_TOKEN or GITHUB_TOKEN environment variable not set')
  }

  return { owner, repo, token }
}

/**
 * Fetch recent Claude Code workflow runs
 *
 * @param owner Repository owner
 * @param repo Repository name
 * @param token GitHub token
 * @param since ISO date string for filtering
 * @returns Array of workflow run IDs
 */
async function fetchRecentClaudeCodeRuns(
  owner: string,
  repo: string,
  token: string,
  since: string
): Promise<number[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/claude-code.yml/runs?created=>${since}&status=completed&per_page=100`

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!response.ok) {
    // Workflow might not exist yet
    if (response.status === 404) {
      console.error('⚠️ claude-code.yml workflow not found, assuming zero usage')
      return []
    }
    const errorText = await response.text()
    throw new Error(`Failed to fetch workflow runs: ${response.status} ${errorText}`)
  }

  const data = (await response.json()) as { workflow_runs: Array<{ id: number }> }
  return data.workflow_runs.map((run) => run.id)
}

/**
 * Fetch logs for a specific workflow run
 *
 * @param owner Repository owner
 * @param repo Repository name
 * @param runId Workflow run ID
 * @param token GitHub token
 * @returns Log content string
 */
async function fetchWorkflowLogs(
  owner: string,
  repo: string,
  runId: number,
  token: string
): Promise<string> {
  const url = `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/logs`

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!response.ok) {
    // Logs might be expired or unavailable
    console.error(`⚠️ Could not fetch logs for run ${runId}, using fallback cost`)
    return ''
  }

  // GitHub returns a redirect to download URL
  // For simplicity, we'll use the fallback cost
  // In production, you might want to download and parse the zip
  console.error(`⚠️ Log download not implemented, using fallback cost for run ${runId}`)
  return ''
}

/**
 * Calculate credit usage for a time period
 *
 * @param since ISO date string for start of period
 * @returns Total spend for the period
 */
async function calculateUsageForPeriod(since: string): Promise<number> {
  const { owner, repo, token } = getRepoInfo()

  // Fetch recent runs
  const runIds = await fetchRecentClaudeCodeRuns(owner, repo, token, since)

  if (runIds.length === 0) {
    return 0
  }

  console.error(`📊 Found ${runIds.length} Claude Code runs since ${since}`)

  // For each run, try to get cost from logs or use fallback
  let totalCost = 0

  for (const runId of runIds) {
    const logs = await fetchWorkflowLogs(owner, repo, runId, token)
    const cost = logs ? extractCostFromLogs(logs) : TDD_CONFIG.FALLBACK_COST_PER_RUN
    totalCost += cost
  }

  return totalCost
}

/**
 * Get ISO date string for start of today (UTC)
 */
function getStartOfToday(): string {
  const now = new Date()
  now.setUTCHours(0, 0, 0, 0)
  return now.toISOString()
}

/**
 * Get ISO date string for start of this week (Monday, UTC)
 */
function getStartOfWeek(): string {
  const now = new Date()
  const dayOfWeek = now.getUTCDay()
  // Adjust to Monday (day 1), handling Sunday (day 0)
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  now.setUTCDate(now.getUTCDate() - daysToSubtract)
  now.setUTCHours(0, 0, 0, 0)
  return now.toISOString()
}

/**
 * Check current credit usage against limits
 *
 * @returns Credit usage information
 */
export async function checkCreditUsage(): Promise<CreditUsage> {
  const dailyLimit = parseInt(process.env['TDD_DAILY_LIMIT'] || '', 10) || TDD_CONFIG.DAILY_LIMIT
  const weeklyLimit = parseInt(process.env['TDD_WEEKLY_LIMIT'] || '', 10) || TDD_CONFIG.WEEKLY_LIMIT
  const warningThreshold = TDD_CONFIG.WARNING_THRESHOLD

  console.error('🔍 Checking credit usage...')

  // Calculate daily and weekly usage
  const [dailySpend, weeklySpend] = await Promise.all([
    calculateUsageForPeriod(getStartOfToday()),
    calculateUsageForPeriod(getStartOfWeek()),
  ])

  const result: CreditUsage = {
    dailySpend: Math.round(dailySpend * 100) / 100,
    weeklySpend: Math.round(weeklySpend * 100) / 100,
    dailyLimit,
    weeklyLimit,
    isAtDailyLimit: dailySpend >= dailyLimit,
    isAtWeeklyLimit: weeklySpend >= weeklyLimit,
    dailyWarning: dailySpend >= dailyLimit * warningThreshold,
    weeklyWarning: weeklySpend >= weeklyLimit * warningThreshold,
  }

  // Log summary
  console.error('')
  console.error('📈 Credit Usage Summary:')
  console.error(
    `   Daily:  $${result.dailySpend} / $${result.dailyLimit} (${Math.round((result.dailySpend / result.dailyLimit) * 100)}%)`
  )
  console.error(
    `   Weekly: $${result.weeklySpend} / $${result.weeklyLimit} (${Math.round((result.weeklySpend / result.weeklyLimit) * 100)}%)`
  )

  if (result.isAtDailyLimit) {
    console.error('   ⛔ Daily limit reached!')
  } else if (result.dailyWarning) {
    console.error('   ⚠️ Daily usage at 80%+ threshold')
  }

  if (result.isAtWeeklyLimit) {
    console.error('   ⛔ Weekly limit reached!')
  } else if (result.weeklyWarning) {
    console.error('   ⚠️ Weekly usage at 80%+ threshold')
  }

  return result
}

/**
 * CLI entry point
 */
async function main(): Promise<void> {
  try {
    const usage = await checkCreditUsage()

    // Output JSON for workflow parsing
    console.log(JSON.stringify(usage))

    // Exit with error if at limit
    if (usage.isAtDailyLimit || usage.isAtWeeklyLimit) {
      process.exit(1)
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

// Run CLI if executed directly
if (import.meta.main) {
  main().catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })
}
