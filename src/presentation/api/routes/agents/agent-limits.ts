/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export const DEFAULT_AGENT_LIMITS = {
  maxActionsPerMinute: 30,
  maxTokensPerDay: 200_000,
  maxConcurrentTasks: 5,
} as const

export interface ResolvedAgentLimits {
  readonly maxActionsPerMinute: number
  readonly maxTokensPerDay: number
  readonly maxConcurrentTasks: number
}

interface DeclaredLimits {
  readonly maxActionsPerMinute?: number
  readonly maxTokensPerDay?: number
  readonly maxConcurrentTasks?: number
}

export const resolveAgentLimits = (declared: DeclaredLimits | undefined): ResolvedAgentLimits => ({
  maxActionsPerMinute: declared?.maxActionsPerMinute ?? DEFAULT_AGENT_LIMITS.maxActionsPerMinute,
  maxTokensPerDay: declared?.maxTokensPerDay ?? DEFAULT_AGENT_LIMITS.maxTokensPerDay,
  maxConcurrentTasks: declared?.maxConcurrentTasks ?? DEFAULT_AGENT_LIMITS.maxConcurrentTasks,
})


const ACTION_WINDOW_MS = 60_000

const actionTimestamps = new Map<string, ReadonlyArray<number>>()

export const checkActionRateLimit = (
  agentName: string,
  maxActionsPerMinute: number
): { readonly queued: boolean } => {
  const now = Date.now()
  const recent = (actionTimestamps.get(agentName) ?? []).filter((t) => now - t < ACTION_WINDOW_MS)
  if (recent.length >= maxActionsPerMinute) {
    actionTimestamps.set(agentName, recent)
    return { queued: true }
  }
  actionTimestamps.set(agentName, [...recent, now])
  return { queued: false }
}


const concurrentTasks = new Map<string, number>()

export const acquireConcurrencySlot = (agentName: string, maxConcurrentTasks: number): boolean => {
  const inFlight = concurrentTasks.get(agentName) ?? 0
  if (inFlight >= maxConcurrentTasks) return false
  concurrentTasks.set(agentName, inFlight + 1)
  return true
}

export const releaseConcurrencySlot = (agentName: string): void => {
  const inFlight = concurrentTasks.get(agentName) ?? 0
  concurrentTasks.set(agentName, Math.max(0, inFlight - 1))
}


interface DailyTokenUsage {
  readonly day: string
  readonly tokens: number
}

const tokenUsage = new Map<string, DailyTokenUsage>()

const PER_CALL_TOKEN_RESERVATION = 1000

const currentUtcDay = (): string => new Date().toISOString().slice(0, 10)

const tokensUsedToday = (agentName: string): number => {
  const entry = tokenUsage.get(agentName)
  if (entry === undefined || entry.day !== currentUtcDay()) return 0
  return entry.tokens
}

export const isTokenBudgetExhausted = (agentName: string, maxTokensPerDay: number): boolean =>
  tokensUsedToday(agentName) + PER_CALL_TOKEN_RESERVATION > maxTokensPerDay

export const recordTokenUsage = (agentName: string, tokens: number): void => {
  const day = currentUtcDay()
  const entry = tokenUsage.get(agentName)
  const base = entry !== undefined && entry.day === day ? entry.tokens : 0
  tokenUsage.set(agentName, { day, tokens: base + tokens })
}

export interface AgentUsage {
  readonly tokensUsedToday: number
  readonly maxTokensPerDay: number
  readonly day: string
}

export const getAgentUsage = (agentName: string, maxTokensPerDay: number): AgentUsage => ({
  tokensUsedToday: tokensUsedToday(agentName),
  maxTokensPerDay,
  day: currentUtcDay(),
})
