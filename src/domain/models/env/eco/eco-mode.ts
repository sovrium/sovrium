/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `ECO_MODE` env var — master eco-posture toggle for the platform (see
 * `[internal ref]` and ADR 013 D3).
 *
 * Three operator postures are recognised:
 *
 * - `strict`   — most aggressive eco posture. Activates every sub-knob the
 *                resolver knows about (`ECO_LOW_DATA_DEFAULT=on`,
 *                `ECO_AI_MAX_CARBON_CLASS` gating, `ECO_RETENTION_PURGE_DAYS`
 *                enforcement).
 * - `balanced` (default) — eco-aligned defaults left in place but no
 *                additional sub-knobs forced on. Equivalent to `on` in the
 *                older two-value taxonomy and treated as the "frugal default
 *                that does not surprise operators."
 * - `lenient`  — backs out of the aggressive defaults (e.g. low-data mode
 *                disabled by default, carbon-class cap relaxed). Operators
 *                opt *in* to this posture; the resolver never selects it.
 *
 * `strict`, `balanced` and `lenient` are the only values recognised. The
 * `off` / `on` / `auto` spellings from the original ADR 013 D3 taxonomy were
 * aliases onto these three and have been removed.
 *
 * The dashboard ALWAYS surfaces the resolved canonical posture so operators
 * see exactly which sub-knobs the platform decided to activate.
 */
export type EcoMode = 'strict' | 'balanced' | 'lenient'

/** Default when `ECO_MODE` is unset (eco-aligned, frugal-by-default). */
export const DEFAULT_ECO_MODE: EcoMode = 'balanced'

/**
 * Resolve `ECO_MODE` from a snapshot of env vars to a canonical posture.
 * Unset, empty, or unrecognised values resolve to the eco-aligned default
 * (`balanced`). Operators opt out, they never opt in.
 */
export const parseEcoMode = (processEnv: Readonly<Record<string, string | undefined>>): EcoMode => {
  const raw = processEnv['ECO_MODE']?.trim().toLowerCase()
  if (raw === 'strict') return 'strict'
  if (raw === 'lenient') return 'lenient'
  // `balanced`, empty, unset, unrecognised → balanced.
  return DEFAULT_ECO_MODE
}

/**
 * Sub-knob identifiers surfaced by the eco-overview dashboard so operators
 * can see which downstream toggles a given `ECO_MODE` value activates.
 *
 * The set is closed (a string-literal union) rather than open-ended so a
 * typo in the resolver fails the type-checker rather than silently shipping
 * a phantom toggle to the dashboard.
 */
export type EcoSubKnob =
  'ECO_LOW_DATA_DEFAULT' | 'ECO_AI_MAX_CARBON_CLASS' | 'ECO_RETENTION_PURGE_DAYS'

/**
 * Resolve the sub-knob set that a given `ECO_MODE` value activates.
 *
 * `strict` activates every known sub-knob — the operator has opted in to the
 * most aggressive posture and expects the platform to enforce every lever it
 * knows about. `balanced` and `lenient` activate none (their defaults already
 * reflect the operator's chosen posture; the dashboard is informational).
 */
export const resolveActivatedSubKnobs = (mode: EcoMode): readonly EcoSubKnob[] => {
  if (mode === 'strict') {
    return ['ECO_LOW_DATA_DEFAULT', 'ECO_AI_MAX_CARBON_CLASS', 'ECO_RETENTION_PURGE_DAYS']
  }
  return []
}
