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
 * - `strict`   — most aggressive eco posture. Resolves the low-data default to
 *                `on` when the operator set no explicit `ECO_LOW_DATA_DEFAULT`
 *                (see `resolveEffectiveLowDataDefault` in
 *                `./eco-low-data-default`, which is the ONLY place `ECO_MODE`
 *                is enforced — the low-data middleware reads it per request).
 *                An explicit recognised value always wins.
 * - `balanced` (default) — eco-aligned defaults left in place but no
 *                additional sub-knobs forced on. Equivalent to `on` in the
 *                older two-value taxonomy and treated as the "frugal default
 *                that does not surprise operators."
 * - `lenient`  — backs out of the aggressive defaults (e.g. low-data mode
 *                disabled by default). Operators opt *in* to this posture;
 *                the resolver never selects it.
 *
 * `strict`, `balanced` and `lenient` are the only values recognised. The
 * `off` / `on` / `auto` spellings from the original ADR 013 D3 taxonomy were
 * aliases onto these three and have been removed.
 *
 * The dashboard ALWAYS surfaces the resolved canonical posture alongside the
 * low-data value it actually produced (`lowDataMode: { effective, source }`),
 * so operators read the posture in force rather than a claim about it.
 */
import { parseEcoEnum } from './eco-env-parsing'

export type EcoMode = 'strict' | 'balanced' | 'lenient'

const ECO_MODES: readonly EcoMode[] = ['strict', 'balanced', 'lenient']

/** Default when `ECO_MODE` is unset (eco-aligned, frugal-by-default). */
export const DEFAULT_ECO_MODE: EcoMode = 'balanced'

/**
 * Resolve `ECO_MODE` from a snapshot of env vars to a canonical posture.
 * Unset or empty resolves to the eco-aligned default (`balanced`).
 *
 * A SET-but-unrecognised value throws. Resolving `ECO_MODE=strcit` to
 * `balanced` would be indistinguishable from never setting the variable — an
 * operator who believed they had opted into the strictest posture would run
 * the middle one, and the dashboard would confirm `balanced` without ever
 * saying the typed input had been discarded.
 *
 * @throws Error when set to anything other than `strict`, `balanced` or `lenient`.
 */
export const parseEcoMode = (processEnv: Readonly<Record<string, string | undefined>>): EcoMode =>
  parseEcoEnum('ECO_MODE', processEnv['ECO_MODE'], {
    allowed: ECO_MODES,
    fallback: DEFAULT_ECO_MODE,
  })

// `ECO_MODE`'s single real effect runs through
// `resolveEffectiveLowDataDefault` in `./eco-low-data-default`, and the
// dashboard reports the low-data value actually produced rather than a claim
// about which sub-knobs the posture "activates".
