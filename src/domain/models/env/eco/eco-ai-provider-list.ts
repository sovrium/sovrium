/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `ECO_AI_PROVIDER_PRECEDENCE` env var — operator-controlled ordered list of
 * AI provider IDs to consult in fallback order (see
 * `[internal ref]`, ADR 013 D3).
 *
 * Two surface shapes are recognised, in order of precedence:
 *
 * 1. **Precedence keyword** — `local-first` / `cloud-first` / `local-only`
 * (the historical [internal ref] D3 taxonomy). When the env var matches one of
 *    these keywords the platform routes via the precedence resolver in
 *    `ai-eco-routing.ts` and the eco overview surfaces an empty list (the
 *    keyword itself is reported elsewhere on the dashboard).
 *
 * 2. **Comma-separated provider IDs** — e.g. `mistral-eu,anthropic,openai`.
 *    The resolver walks the list in order, picking the first provider whose
 *    carbon class (per `ECO_AI_MAX_CARBON_CLASS`) is acceptable. Whitespace
 *    around commas is trimmed; case is preserved; empty segments dropped.
 *
 * The two surfaces co-exist because the older `precedence` keyword model is
 * still wired through `ai-eco-routing.ts` for the runtime resolver, while
 * the eco-overview dashboard exposes the operator's *declared* provider
 * list. When the operator declared a list (surface 2), the dashboard
 * surfaces it verbatim. When the operator stuck with a keyword (surface 1),
 * the dashboard surfaces an empty list — the precedence keyword is reported
 * on the routing panel, not the provider-mix panel.
 *
 * This separation is what keeps the historical keyword users
 * (`local-first`) working alongside the new operator who wants to declare
 * an explicit fallback chain (`mistral-eu,anthropic,openai`).
 */
const PRECEDENCE_KEYWORDS: ReadonlySet<string> = new Set([
  'local-first',
  'cloud-first',
  'local-only',
])

/**
 * Resolve the declared AI-provider precedence list from a snapshot of env
 * vars. Returns the list verbatim (no canonicalisation, no validation
 * against any known provider catalog) so the dashboard reports exactly what
 * the operator typed.
 */
export const parseEcoAiProviderPrecedenceList = (
  processEnv: Readonly<Record<string, string | undefined>>
): readonly string[] => {
  const raw = processEnv['ECO_AI_PROVIDER_PRECEDENCE']?.trim()
  if (raw === undefined || raw === '') return []
  // Precedence keyword (surface 1) — the resolver in ai-eco-routing.ts
  // handles routing; the dashboard list is empty.
  if (PRECEDENCE_KEYWORDS.has(raw)) return []
  return raw
    .split(',')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
}
