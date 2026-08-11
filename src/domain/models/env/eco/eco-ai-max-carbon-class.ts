/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `ECO_AI_MAX_CARBON_CLASS` env var — operator-imposed upper bound on the
 * carbon class (A–G) of the AI provider AI calls may route to (see
 * `[internal ref]`, ADR 013 D3).
 *
 * The Sovrium binary ships a static carbon-class table keyed by provider
 * region. When the operator sets `ECO_AI_MAX_CARBON_CLASS=C`, the routing
 * resolver skips any provider whose class is `D`–`G` (worse than `C`).
 *
 * Frugal-by-default: unset resolves to a permissive default (`G`) so the
 * resolver does not silently break AI calls in a fresh install. Operators
 * tighten the cap as they evaluate provider impact.
 */
export type CarbonClass = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'

const CARBON_CLASSES: readonly CarbonClass[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

/** Default when `ECO_AI_MAX_CARBON_CLASS` is unset (permissive). */
export const DEFAULT_ECO_AI_MAX_CARBON_CLASS: CarbonClass = 'G'

/**
 * Resolve `ECO_AI_MAX_CARBON_CLASS` from a snapshot of env vars. An unset,
 * empty, or unrecognised value resolves to the permissive default (`G`).
 */
export const parseEcoAiMaxCarbonClass = (
  processEnv: Readonly<Record<string, string | undefined>>
): CarbonClass => {
  const raw = processEnv['ECO_AI_MAX_CARBON_CLASS']?.trim().toUpperCase()
  return raw !== undefined && (CARBON_CLASSES as readonly string[]).includes(raw)
    ? (raw as CarbonClass)
    : DEFAULT_ECO_AI_MAX_CARBON_CLASS
}
