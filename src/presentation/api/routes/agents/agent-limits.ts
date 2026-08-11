/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Per-agent operational limits enforcement.
 *
 * Backs `[internal ref]`. An agent declares optional
 * `limits` ({ maxActionsPerMinute, maxTokensPerDay, maxConcurrentTasks });
 * any omitted field falls back to a system default. This module owns the
 * runtime accounting:
 *
 *  - {@link resolveAgentLimits}    — merge declared limits with defaults.
 *  - {@link checkActionRateLimit}  — sliding-window action counter
 *.
 *  - {@link acquireConcurrencySlot}/{@link releaseConcurrencySlot}
 *                                    — in-flight task counter
 *.
 *  - {@link isTokenBudgetExhausted} — per-day token budget gate
 *.
 *  - {@link recordTokenUsage}/{@link getAgentUsage}
 *                                    — daily token accounting that resets at
 * midnight UTC.
 *
 * State is process-local (a plain Map), exactly like `agent-rate-limit.ts`
 * and `webhook-rate-limit.ts` — suitable for the single-process E2E topology.
 */

/** System default operational limits applied when a field is omitted. */
export const DEFAULT_AGENT_LIMITS = {
  maxActionsPerMinute: 30,
  maxTokensPerDay: 200_000,
  maxConcurrentTasks: 5,
} as const

/** Fully-resolved limits — every field present after default merging. */
export interface ResolvedAgentLimits {
  readonly maxActionsPerMinute: number
  readonly maxTokensPerDay: number
  readonly maxConcurrentTasks: number
}

/** Optional declared limits (any subset of the three fields). */
interface DeclaredLimits {
  readonly maxActionsPerMinute?: number
  readonly maxTokensPerDay?: number
  readonly maxConcurrentTasks?: number
}

/**
 * Merge an agent's declared `limits` with the system defaults so callers
 * always see a fully-populated {@link ResolvedAgentLimits}.
 */
export const resolveAgentLimits = (declared: DeclaredLimits | undefined): ResolvedAgentLimits => ({
  maxActionsPerMinute: declared?.maxActionsPerMinute ?? DEFAULT_AGENT_LIMITS.maxActionsPerMinute,
  maxTokensPerDay: declared?.maxTokensPerDay ?? DEFAULT_AGENT_LIMITS.maxTokensPerDay,
  maxConcurrentTasks: declared?.maxConcurrentTasks ?? DEFAULT_AGENT_LIMITS.maxConcurrentTasks,
})

// ── Sliding-window action counter (maxActionsPerMinute) ─────────────────────

/** Sliding-window length for the per-agent action limiter (ms). */
const ACTION_WINDOW_MS = 60_000

const actionTimestamps = new Map<string, ReadonlyArray<number>>()

/**
 * Record an action attempt and decide whether the agent has exceeded its
 * `maxActionsPerMinute` budget. A `queued` decision does NOT consume a slot —
 * the window only tracks the actions that actually ran.
 */
export const checkActionRateLimit = (
  agentName: string,
  maxActionsPerMinute: number
): { readonly queued: boolean } => {
  const now = Date.now()
  const recent = (actionTimestamps.get(agentName) ?? []).filter((t) => now - t < ACTION_WINDOW_MS)
  if (recent.length >= maxActionsPerMinute) {
    // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- mutable singleton store; the value is a fresh immutable array
    actionTimestamps.set(agentName, recent)
    return { queued: true }
  }
  // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- mutable singleton store; the value is a fresh immutable array
  actionTimestamps.set(agentName, [...recent, now])
  return { queued: false }
}

// ── In-flight task counter (maxConcurrentTasks) ─────────────────────────────

const concurrentTasks = new Map<string, number>()

/**
 * Try to claim a concurrency slot. Returns `false` (and claims nothing) when
 * the agent is already at `maxConcurrentTasks`; the caller must then queue.
 */
export const acquireConcurrencySlot = (agentName: string, maxConcurrentTasks: number): boolean => {
  const inFlight = concurrentTasks.get(agentName) ?? 0
  if (inFlight >= maxConcurrentTasks) return false
  // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- mutable singleton counter
  concurrentTasks.set(agentName, inFlight + 1)
  return true
}

/** Release a previously-acquired concurrency slot. */
export const releaseConcurrencySlot = (agentName: string): void => {
  const inFlight = concurrentTasks.get(agentName) ?? 0
  // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- mutable singleton counter
  concurrentTasks.set(agentName, Math.max(0, inFlight - 1))
}

// ── Daily token accounting (maxTokensPerDay) ────────────────────────────────

interface DailyTokenUsage {
  /** UTC day key (YYYY-MM-DD) the counter belongs to. */
  readonly day: string
  /** Tokens consumed by the agent during {@link day}. */
  readonly tokens: number
}

const tokenUsage = new Map<string, DailyTokenUsage>()

/**
 * Conservative per-call token reservation. A call to the LLM is assumed to
 * cost at least this many tokens (prompt + completion). An agent whose
 * remaining daily budget cannot cover one reservation is considered
 * exhausted — this makes a very low `maxTokensPerDay` (e.g. 100) reject the
 * first action while a realistic budget (200k default) is unaffected.
 */
const PER_CALL_TOKEN_RESERVATION = 1000

/** UTC day key (YYYY-MM-DD) for the current instant. */
const currentUtcDay = (): string => new Date().toISOString().slice(0, 10)

/** Read the agent's token counter for the current UTC day (0 after reset). */
const tokensUsedToday = (agentName: string): number => {
  const entry = tokenUsage.get(agentName)
  if (entry === undefined || entry.day !== currentUtcDay()) return 0
  return entry.tokens
}

/**
 * Decide whether the agent's daily token budget cannot accommodate another
 * LLM round-trip. True once the remaining budget drops below one
 * {@link PER_CALL_TOKEN_RESERVATION}.
 */
export const isTokenBudgetExhausted = (agentName: string, maxTokensPerDay: number): boolean =>
  tokensUsedToday(agentName) + PER_CALL_TOKEN_RESERVATION > maxTokensPerDay

/**
 * Record the token cost of a completed LLM round-trip against the agent's
 * daily counter, resetting the counter when the UTC day has rolled over.
 */
export const recordTokenUsage = (agentName: string, tokens: number): void => {
  const day = currentUtcDay()
  const entry = tokenUsage.get(agentName)
  const base = entry !== undefined && entry.day === day ? entry.tokens : 0
  // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- mutable singleton store; the value is a fresh immutable object
  tokenUsage.set(agentName, { day, tokens: base + tokens })
}

/** Daily token usage snapshot for `GET /api/agents/:name/usage`. */
export interface AgentUsage {
  readonly tokensUsedToday: number
  readonly maxTokensPerDay: number
  readonly day: string
}

/** Return the agent's daily token usage snapshot. */
export const getAgentUsage = (agentName: string, maxTokensPerDay: number): AgentUsage => ({
  tokensUsedToday: tokensUsedToday(agentName),
  maxTokensPerDay,
  day: currentUtcDay(),
})
