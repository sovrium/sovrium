/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `AI_CONFIRMATION_TTL_MS` env var — how long a stashed AI-chat mutation
 * confirmation stays committable ([internal ref], decision 4).
 *
 * A destructive chat mutation (every delete; a bulk update of 2+ rows) is
 * proposed rather than executed: the executor stashes the parsed intent
 * together with the caller's identity — `userRole`, `userGroups` — and the
 * `tables` snapshot the intent was parsed against, then hands back a token.
 * The commit runs on that CAPTURED identity and re-resolves nothing, which is
 * the only combination describing an authorization decision that was ever
 * actually true (the quoted `affectedCount` is bound to the same snapshot).
 *
 * Capture is defensible only because the window is bounded. Without an expiry
 * an unconsumed token survives the whole process lifetime, so a verdict reached
 * under a role, a group membership and a table config that have all since
 * changed stays authoritative forever. This TTL is that bound, and it closes
 * all three staleness windows at once — role demotion, group removal, and
 * config tightening — where re-resolving any single input closes only its own.
 *
 * Operator infrastructure: it lives in the environment only, never in the app
 * schema. An operational safety bound is not an application-behaviour choice
 * ([internal ref] operator/app split; [internal ref] rejected `ai.confirmationTtl` for this
 * reason).
 */

/** Default lifetime of a stashed confirmation when the var is unset (5 minutes). */
export const DEFAULT_AI_CONFIRMATION_TTL_MS = 5 * 60 * 1000

/**
 * Resolve `AI_CONFIRMATION_TTL_MS` from a snapshot of env vars.
 *
 * - unset / empty / whitespace-only → {@link DEFAULT_AI_CONFIRMATION_TTL_MS}
 * - a positive whole number of ms   → that number
 * - anything else                   → {@link DEFAULT_AI_CONFIRMATION_TTL_MS}
 *
 * The digit match is full-string on purpose, the same reasoning as
 * `parseEcoInteger`: `Number.parseInt` reads a prefix and discards the rest, so
 * `"5m"` would silently become 5 MILLISECONDS — a bound so tight every
 * confirmation expires before the user can answer.
 *
 * Unlike the `ECO_*` parsers this one is TOTAL rather than fail-fast, and the
 * difference is deliberate: it is read on the request path, inside
 * `consumeConfirmation`, so a throw would turn a malformed operator value into
 * a 500 on a legitimate user's confirmation reply rather than a refusal at
 * boot. There is no boot-time validation pass for `AI_*` vars to hang a
 * fail-fast parse on — `env/ai/ai.ts` made the same call for the same reason.
 * The fallback is the conservative direction: a malformed value yields the
 * 5-minute bound, never an unbounded one.
 */
export const parseAiConfirmationTtlMs = (
  processEnv: Readonly<Record<string, string | undefined>>
): number => {
  const trimmed = processEnv['AI_CONFIRMATION_TTL_MS']?.trim()
  if (trimmed === undefined || trimmed === '') return DEFAULT_AI_CONFIRMATION_TTL_MS
  if (!/^\d+$/.test(trimmed)) return DEFAULT_AI_CONFIRMATION_TTL_MS
  const parsed = Number.parseInt(trimmed, 10)
  return parsed > 0 ? parsed : DEFAULT_AI_CONFIRMATION_TTL_MS
}
