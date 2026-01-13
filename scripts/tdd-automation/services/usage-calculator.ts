/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Claude Code Usage Calculator
 *
 * Calculates token usage and costs from Claude Code CLI output.
 * Works without OAuth API access - parses logs from GitHub Actions.
 *
 * Usage data is extracted from Claude Code's output format:
 * "Usage: 1,234 input tokens, 567 output tokens (model: claude-sonnet-4-5-20250929)"
 */

/**
 * Model pricing per million tokens (as of January 2025)
 * Source: https://www.anthropic.com/pricing
 */
export const MODEL_PRICING = {
  'claude-sonnet-4-5-20250929': {
    input: 3.0 / 1_000_000, // $3 per million input tokens
    output: 15.0 / 1_000_000, // $15 per million output tokens
  },
  'claude-sonnet-4-20250514': {
    input: 3.0 / 1_000_000,
    output: 15.0 / 1_000_000,
  },
  'claude-opus-4-5-20251101': {
    input: 15.0 / 1_000_000, // $15 per million input tokens
    output: 75.0 / 1_000_000, // $75 per million output tokens
  },
  'claude-haiku-4-20250110': {
    input: 0.25 / 1_000_000, // $0.25 per million input tokens
    output: 1.25 / 1_000_000, // $1.25 per million output tokens
  },
} as const

/**
 * Claude Code Max subscription limits (approximate)
 * These are estimates based on typical subscription tiers
 */
export const CLAUDE_CODE_MAX_LIMITS = {
  // Five-hour rolling window (same as API limit)
  fiveHourPercent: 100,

  // Seven-day rolling window (same as API limit)
  sevenDayPercent: 100,

  // Conservative monthly cost estimate for Max tier
  // Note: Claude Code Max doesn't have a hard cost limit, but we track to avoid excessive usage
  estimatedMonthlyCost: 100, // ~$100/month equivalent in usage
}

/**
 * Usage data extracted from Claude Code output
 */
export interface UsageData {
  inputTokens: number
  outputTokens: number
  model: string
  cacheCreationTokens?: number // Prompt caching (if used)
  cacheReadTokens?: number // Cached tokens read
  totalCostUsd?: number // Direct cost from JSON output (Claude Code SDK)
}

/**
 * Result data from Claude Code JSON output
 */
export interface ClaudeCodeResult {
  type: 'result'
  subtype: 'success' | 'error' | string
  is_error: boolean
  duration_ms: number
  num_turns: number
  total_cost_usd: number
  permission_denials: string[]
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
export function parseCostFromClaudeJsonOutput(output: string): number | null {
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
 * Supports two formats:
 * 1. Text format: "Usage: 1,234 input tokens, 567 output tokens (model: claude-sonnet-4-5-20250929)"
 * 2. JSON format: { "type": "result", "total_cost_usd": 0.123, ... }
 *
 * @param output - Claude Code CLI output (from GitHub Actions logs)
 * @returns Parsed usage data or null if not found
 */
export function parseUsageFromClaudeOutput(output: string): UsageData | null {
  // First, try to parse JSON format (Claude Code SDK output)
  // Accept cost >= 0 (including $0 for failed/skipped runs) as valid usage data
  const jsonCost = parseCostFromClaudeJsonOutput(output)
  if (jsonCost !== null) {
    // Try to extract model from the same output
    const modelMatch = output.match(/"model"\s*:\s*"([^"]+)"/i)
    const model = modelMatch ? modelMatch[1]! : 'claude-sonnet-4-5-20250929'

    return {
      inputTokens: 0, // Not available in JSON format
      outputTokens: 0, // Not available in JSON format
      model,
      totalCostUsd: jsonCost, // May be 0 for error runs, which is valid
    }
  }

  // Pattern 1: Standard format with model
  // "Usage: 1,234 input tokens, 567 output tokens (model: claude-sonnet-4-5-20250929)"
  const patternWithModel =
    /Usage:\s*([\d,]+)\s*input tokens,\s*([\d,]+)\s*output tokens\s*\(model:\s*([\w-]+)\)/i

  const matchWithModel = output.match(patternWithModel)
  if (matchWithModel) {
    return {
      inputTokens: parseInt(matchWithModel[1]!.replace(/,/g, ''), 10),
      outputTokens: parseInt(matchWithModel[2]!.replace(/,/g, ''), 10),
      model: matchWithModel[3]!,
    }
  }

  // Pattern 2: Format without model (fallback)
  // "Usage: 1,234 input tokens, 567 output tokens"
  const patternWithoutModel = /Usage:\s*([\d,]+)\s*input tokens,\s*([\d,]+)\s*output tokens/i

  const matchWithoutModel = output.match(patternWithoutModel)
  if (matchWithoutModel) {
    return {
      inputTokens: parseInt(matchWithoutModel[1]!.replace(/,/g, ''), 10),
      outputTokens: parseInt(matchWithoutModel[2]!.replace(/,/g, ''), 10),
      model: 'claude-sonnet-4-5-20250929', // Default model
    }
  }

  // Pattern 3: Multiple usage entries (take the last one - final total)
  const multiplePattern =
    /Usage:\s*([\d,]+)\s*input tokens,\s*([\d,]+)\s*output tokens\s*(?:\(model:\s*([\w-]+)\))?/gi

  let lastMatch: UsageData | null = null
  let match

  while ((match = multiplePattern.exec(output)) !== null) {
    lastMatch = {
      inputTokens: parseInt(match[1]!.replace(/,/g, ''), 10),
      outputTokens: parseInt(match[2]!.replace(/,/g, ''), 10),
      model: match[3] || 'claude-sonnet-4-5-20250929',
    }
  }

  return lastMatch
}

/**
 * Calculate cost from usage data
 *
 * @param usage - Usage data with token counts and model
 * @returns Estimated cost in USD
 */
export function calculateCost(usage: UsageData): number {
  // If totalCostUsd is provided (from JSON output), use it directly
  if (usage.totalCostUsd !== undefined && usage.totalCostUsd > 0) {
    return usage.totalCostUsd
  }

  // Otherwise, calculate from token counts
  const pricing = MODEL_PRICING[usage.model as keyof typeof MODEL_PRICING]

  if (!pricing) {
    console.warn(`Unknown model: ${usage.model}, using Sonnet pricing`)
    const fallbackPricing = MODEL_PRICING['claude-sonnet-4-5-20250929']
    return usage.inputTokens * fallbackPricing.input + usage.outputTokens * fallbackPricing.output
  }

  const inputCost = usage.inputTokens * pricing.input
  const outputCost = usage.outputTokens * pricing.output

  // Cache costs (if applicable)
  const cacheCost = (usage.cacheCreationTokens ?? 0) * pricing.input * 1.25 // 25% markup
  const cacheReadCost = (usage.cacheReadTokens ?? 0) * pricing.input * 0.1 // 90% discount

  return inputCost + outputCost + cacheCost + cacheReadCost
}

/**
 * Format usage data for display
 */
export function formatUsage(usage: UsageData): string {
  const totalTokens = usage.inputTokens + usage.outputTokens
  const cost = calculateCost(usage)

  return [
    `Tokens: ${totalTokens.toLocaleString()}`,
    `  ├─ Input:  ${usage.inputTokens.toLocaleString()}`,
    `  └─ Output: ${usage.outputTokens.toLocaleString()}`,
    `Cost: $${cost.toFixed(4)}`,
    `Model: ${usage.model}`,
  ].join('\n')
}

/**
 * Aggregate usage across multiple runs
 */
export function aggregateUsage(usageList: UsageData[]): {
  totalInputTokens: number
  totalOutputTokens: number
  totalTokens: number
  totalCost: number
  runs: number
  avgTokensPerRun: number
  avgCostPerRun: number
  modelBreakdown: Record<string, number> // runs per model
} {
  const totals = usageList.reduce(
    (acc, usage) => ({
      inputTokens: acc.inputTokens + usage.inputTokens,
      outputTokens: acc.outputTokens + usage.outputTokens,
      cost: acc.cost + calculateCost(usage),
      models: {
        ...acc.models,
        [usage.model]: (acc.models[usage.model] || 0) + 1,
      },
    }),
    {
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      models: {} as Record<string, number>,
    }
  )

  const totalTokens = totals.inputTokens + totals.outputTokens
  const runs = usageList.length

  return {
    totalInputTokens: totals.inputTokens,
    totalOutputTokens: totals.outputTokens,
    totalTokens,
    totalCost: totals.cost,
    runs,
    avgTokensPerRun: runs > 0 ? Math.round(totalTokens / runs) : 0,
    avgCostPerRun: runs > 0 ? totals.cost / runs : 0,
    modelBreakdown: totals.models,
  }
}

/**
 * Check if usage is approaching Max subscription limits
 * @deprecated Use checkCostLimits for blocking behavior in CI workflows
 */
export function checkLimits(
  dailyCost: number,
  weeklyCost: number
): {
  status: 'ok' | 'warning' | 'critical'
  message: string
  dailyPercent: number
  weeklyPercent: number
  projectedMonthlyCost: number
} {
  const projectedMonthlyCost = (weeklyCost / 7) * 30

  const dailyPercent = (dailyCost / (CLAUDE_CODE_MAX_LIMITS.estimatedMonthlyCost / 30)) * 100
  const weeklyPercent =
    (weeklyCost / ((CLAUDE_CODE_MAX_LIMITS.estimatedMonthlyCost / 30) * 7)) * 100
  const monthlyPercent = (projectedMonthlyCost / CLAUDE_CODE_MAX_LIMITS.estimatedMonthlyCost) * 100

  let status: 'ok' | 'warning' | 'critical' = 'ok'
  let message = `Usage is within limits (${monthlyPercent.toFixed(1)}% of estimated monthly)`

  if (monthlyPercent >= 100) {
    status = 'critical'
    message = `⛔ CRITICAL: Projected monthly usage (${monthlyPercent.toFixed(1)}%) exceeds estimated limit`
  } else if (monthlyPercent >= 80) {
    status = 'warning'
    message = `⚠️  WARNING: High usage detected (${monthlyPercent.toFixed(1)}% of estimated monthly)`
  } else if (dailyPercent >= 20) {
    status = 'warning'
    message = `⚠️  WARNING: Today's usage is high (${dailyPercent.toFixed(1)}% of daily average)`
  }

  return {
    status,
    message,
    dailyPercent,
    weeklyPercent,
    projectedMonthlyCost,
  }
}

/**
 * Default cost limits for blocking behavior
 *
 * Based on estimated $100/week Claude Code Max subscription:
 * - Daily: $15 (~15% of weekly)
 * - Weekly: $90 (90% of weekly allocation)
 */
export const DEFAULT_COST_LIMITS = {
  dailyLimitUsd: 15.0,
  weeklyLimitUsd: 90.0,
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
 * @param dailyLimit - Maximum allowed daily cost (default: $15.00)
 * @param weeklyLimit - Maximum allowed weekly cost (default: $90.00)
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
