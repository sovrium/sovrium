/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Claude Code Usage Calculator
 *
 * Extracts cost data from Claude Code CLI output (GitHub Actions logs).
 * Works without OAuth API access - parses JSON output from Claude Code SDK.
 *
 * Cost is extracted from the total_cost_usd field in Claude Code SDK output:
 * { "type": "result", "total_cost_usd": 0.123, ... }
 */

/**
 * Usage data extracted from Claude Code output
 *
 * Note: Token counts are not available in Claude Code SDK JSON output.
 * We track cost directly from the total_cost_usd field.
 */
export interface UsageData {
  model: string
  cost: number // Cost in USD (from total_cost_usd in JSON output)
}

/**
 * Parse cost from Claude Code JSON output
 *
 * Claude Code SDK outputs JSON format:
 * { "type": "result", "total_cost_usd": 0.123, ... }
 *
 * @param output - Claude Code output (from GitHub Actions logs)
 * @returns Total cost in USD or null if not found
 */
function parseCostFromClaudeJsonOutput(output: string): number | null {
  // Pattern: JSON object with total_cost_usd field
  const jsonPattern = /\{[^{}]*"type"\s*:\s*"result"[^{}]*"total_cost_usd"\s*:\s*([\d.]+)[^{}]*\}/g

  let lastCost: number | null = null
  let match

  while ((match = jsonPattern.exec(output)) !== null) {
    const cost = parseFloat(match[1]!)
    if (!isNaN(cost)) {
      lastCost = cost
    }
  }

  // Also try alternative format where total_cost_usd comes before type
  if (lastCost === null) {
    const altPattern = /\{[^{}]*"total_cost_usd"\s*:\s*([\d.]+)[^{}]*"type"\s*:\s*"result"[^{}]*\}/g
    while ((match = altPattern.exec(output)) !== null) {
      const cost = parseFloat(match[1]!)
      if (!isNaN(cost)) {
        lastCost = cost
      }
    }
  }

  // Simplest pattern - just find total_cost_usd in result JSON
  if (lastCost === null) {
    const simplePattern = /"total_cost_usd"\s*:\s*([\d.]+)/g
    while ((match = simplePattern.exec(output)) !== null) {
      const cost = parseFloat(match[1]!)
      if (!isNaN(cost)) {
        lastCost = cost
      }
    }
  }

  return lastCost
}

/**
 * Parse usage from Claude Code CLI output
 *
 * Parses JSON format from Claude Code SDK:
 * { "type": "result", "total_cost_usd": 0.123, ... }
 *
 * @param output - Claude Code CLI output (from GitHub Actions logs)
 * @returns Parsed usage data or null if not found
 */
export function parseUsageFromClaudeOutput(output: string): UsageData | null {
  // Parse JSON format (Claude Code SDK output)
  // Accept cost >= 0 (including $0 for failed/skipped runs) as valid usage data
  const jsonCost = parseCostFromClaudeJsonOutput(output)
  if (jsonCost !== null) {
    // Try to extract model from the same output
    const modelMatch = output.match(/"model"\s*:\s*"([^"]+)"/i)
    const model = modelMatch ? modelMatch[1]! : 'claude-sonnet-4-5-20250929'

    return {
      model,
      cost: jsonCost, // May be 0 for error runs, which is valid
    }
  }

  return null
}

/**
 * Get cost from usage data
 *
 * @param usage - Usage data with cost
 * @returns Cost in USD
 */
export function getCost(usage: UsageData): number {
  return usage.cost
}

/**
 * Format usage data for display
 */
export function formatUsage(usage: UsageData): string {
  return [`Cost: $${usage.cost.toFixed(4)}`, `Model: ${usage.model}`].join('\n')
}

/**
 * Aggregate usage across multiple runs
 */
export function aggregateUsage(usageList: UsageData[]): {
  totalCost: number
  runs: number
  avgCostPerRun: number
  modelBreakdown: Record<string, number> // runs per model
} {
  const totals = usageList.reduce(
    (acc, usage) => ({
      cost: acc.cost + usage.cost,
      models: {
        ...acc.models,
        [usage.model]: (acc.models[usage.model] || 0) + 1,
      },
    }),
    {
      cost: 0,
      models: {} as Record<string, number>,
    }
  )

  const runs = usageList.length

  return {
    totalCost: totals.cost,
    runs,
    avgCostPerRun: runs > 0 ? totals.cost / runs : 0,
    modelBreakdown: totals.models,
  }
}

/**
 * Default cost limits for blocking behavior
 *
 * Based on Claude Code usage budget allocation:
 * - Daily: $200 (20% of weekly)
 * - Weekly: $1000 (weekly allocation)
 */
export const DEFAULT_COST_LIMITS = {
  dailyLimitUsd: 200.0,
  weeklyLimitUsd: 1000.0,
} as const

/**
 * Result of cost limit check for CI blocking decisions
 */
export type CostLimitCheckResult = {
  canProceed: boolean
  reason: 'within_limits' | 'daily_exceeded' | 'weekly_exceeded'
  dailyCost: number
  weeklyCost: number
  dailyPercent: number
  weeklyPercent: number
  dailyLimit: number
  weeklyLimit: number
}

/**
 * Check if costs are within configured limits (for CI blocking)
 *
 * This function is designed for fail-closed behavior:
 * - Returns clear boolean for CI decision-making
 * - Provides reason for logging/debugging
 * - Includes percentage calculations for visibility
 *
 * @param dailyCost - Total cost in last 24 hours (USD)
 * @param weeklyCost - Total cost in last 7 days (USD)
 * @param dailyLimit - Maximum allowed daily cost (default: $200.00)
 * @param weeklyLimit - Maximum allowed weekly cost (default: $1000.00)
 * @returns Result with canProceed boolean and detailed breakdown
 */
export function checkCostLimits(
  dailyCost: number,
  weeklyCost: number,
  dailyLimit: number = DEFAULT_COST_LIMITS.dailyLimitUsd,
  weeklyLimit: number = DEFAULT_COST_LIMITS.weeklyLimitUsd
): CostLimitCheckResult {
  const dailyPercent = dailyLimit > 0 ? (dailyCost / dailyLimit) * 100 : 0
  const weeklyPercent = weeklyLimit > 0 ? (weeklyCost / weeklyLimit) * 100 : 0

  // Check weekly limit first (higher priority - longer timeframe)
  if (weeklyCost >= weeklyLimit) {
    return {
      canProceed: false,
      reason: 'weekly_exceeded',
      dailyCost,
      weeklyCost,
      dailyPercent,
      weeklyPercent,
      dailyLimit,
      weeklyLimit,
    }
  }

  // Check daily limit
  if (dailyCost >= dailyLimit) {
    return {
      canProceed: false,
      reason: 'daily_exceeded',
      dailyCost,
      weeklyCost,
      dailyPercent,
      weeklyPercent,
      dailyLimit,
      weeklyLimit,
    }
  }

  // Both limits OK
  return {
    canProceed: true,
    reason: 'within_limits',
    dailyCost,
    weeklyCost,
    dailyPercent,
    weeklyPercent,
    dailyLimit,
    weeklyLimit,
  }
}

/**
 * Format cost limit result for logging
 */
export function formatCostLimitResult(result: CostLimitCheckResult): string {
  const statusIcon = result.canProceed ? '✅' : '⛔'
  const reasonText = {
    within_limits: 'Within limits',
    daily_exceeded: 'Daily limit exceeded',
    weekly_exceeded: 'Weekly limit exceeded',
  }[result.reason]

  return [
    `${statusIcon} ${reasonText}`,
    `   Daily:  $${result.dailyCost.toFixed(2)} / $${result.dailyLimit.toFixed(2)} (${result.dailyPercent.toFixed(1)}%)`,
    `   Weekly: $${result.weeklyCost.toFixed(2)} / $${result.weeklyLimit.toFixed(2)} (${result.weeklyPercent.toFixed(1)}%)`,
  ].join('\n')
}
