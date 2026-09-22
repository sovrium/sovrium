/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { parseEcoEnum } from './eco-env-parsing'
import { parseEcoMode } from './eco-mode'

/**
 * `ECO_LOW_DATA_DEFAULT` env var — operator-controlled low-data variant
 * posture (ADR 013 D2).
 *
 * Three operator values:
 *
 * - `on`             — every page response is served in low-data variant
 *                      regardless of client signals. End-users can still
 *                      opt out per-session via `sovrium_low_data=off`.
 * - `respect-client` — server inspects request headers per request: low-data
 *                      is served when `Save-Data: on` OR
 *                      `Sec-CH-Prefers-Reduced-Data: reduce` OR
 *                      `sovrium_low_data=on` cookie is present.
 * - `off` (default)  — full variant always. Eco-aligned in the sense that no
 *                      heuristic guesses the operator's intent; operators
 *                      opt *in* to the low-data posture explicitly.
 *
 * The "off" default here is the conservative choice — the spec uses
 * `respect-client` as an explicit opt-in, and `on` to test the unconditional
 * posture. Operators who want low-data-by-default must set the env var.
 */

export type EcoLowDataDefault = 'on' | 'off' | 'respect-client'

const ECO_LOW_DATA_DEFAULTS: readonly EcoLowDataDefault[] = ['on', 'off', 'respect-client']

/** Default when `ECO_LOW_DATA_DEFAULT` is unset. */
export const DEFAULT_ECO_LOW_DATA_DEFAULT: EcoLowDataDefault = 'off'

/**
 * Resolve `ECO_LOW_DATA_DEFAULT` from a snapshot of env vars. An unset or
 * empty value resolves to `off`.
 *
 * A SET-but-unrecognised value throws. `respect-client` is easy to
 * mistype (`respect_client`, `respectClient`) and every misspelling used to
 * resolve to `off` — the one posture that ignores the client signals the
 * operator was explicitly asking the platform to honour.
 *
 * @throws Error when set to anything other than `on`, `off` or `respect-client`.
 */
export const parseEcoLowDataDefault = (
  processEnv: Readonly<Record<string, string | undefined>>
): EcoLowDataDefault =>
  parseEcoEnum('ECO_LOW_DATA_DEFAULT', processEnv['ECO_LOW_DATA_DEFAULT'], {
    allowed: ECO_LOW_DATA_DEFAULTS,
    fallback: DEFAULT_ECO_LOW_DATA_DEFAULT,
  })

/**
 * Which input decided the effective low-data posture.
 *
 * - `explicit`  — the operator set a RECOGNISED `ECO_LOW_DATA_DEFAULT`.
 * - `eco-mode`  — no explicit value; `ECO_MODE=strict` decided it.
 * - `default`   — nothing decided it; the conservative `off` default stands.
 *
 * Reported verbatim by `GET /api/admin/footprint/overview` so the dashboard
 * names the value actually in force plus its provenance, rather than a list
 * of claims about levers that may move nothing.
 */
export type EcoLowDataDefaultSource = 'explicit' | 'eco-mode' | 'default'

/** Effective low-data posture plus the input that decided it. */
export interface EffectiveLowDataDefault {
  readonly effective: EcoLowDataDefault
  readonly source: EcoLowDataDefaultSource
}

/**
 * Resolve the low-data posture the platform will ACTUALLY apply, composing
 * `parseEcoLowDataDefault` with the `ECO_MODE` master posture.
 *
 * Precedence (highest first):
 *   1. `ECO_LOW_DATA_DEFAULT` set to a RECOGNISED value → that value (`explicit`)
 *   2. `ECO_MODE=strict`                                → `on` (`eco-mode`)
 *   3. otherwise                                        → `off` (`default`)
 *
 * An UNRECOGNISED `ECO_LOW_DATA_DEFAULT` (e.g. `aggressive`) is NOT rung 1: a
 * typo is not an operator choice, so it falls through to rungs 2/3 exactly as
 * `parseEcoLowDataDefault` already treats it. Claiming it as an explicit `off`
 * would silently strand the operator's chosen master posture.
 *
 * This is `ECO_MODE`'s ONLY enforcement point — the request path reads the
 * effective value here (`src/infrastructure/server/middleware/low-data-mode.ts`),
 * so `strict` changes something an end-user can observe.
 */
export const resolveEffectiveLowDataDefault = (
  processEnv: Readonly<Record<string, string | undefined>>
): EffectiveLowDataDefault => {
  const raw = processEnv['ECO_LOW_DATA_DEFAULT']?.trim().toLowerCase()
  if (raw !== undefined && ECO_LOW_DATA_DEFAULTS.includes(raw as EcoLowDataDefault)) {
    return { effective: parseEcoLowDataDefault(processEnv), source: 'explicit' }
  }
  if (parseEcoMode(processEnv) === 'strict') {
    return { effective: 'on', source: 'eco-mode' }
  }
  return { effective: DEFAULT_ECO_LOW_DATA_DEFAULT, source: 'default' }
}

/**
 * Request signals that inform low-data resolution under `respect-client`.
 *
 * Web-standard signals only (RFC 8478 `Save-Data`, Media Queries Level 5
 * `Sec-CH-Prefers-Reduced-Data`). The `cookie` row is the per-session
 * override that ALWAYS wins regardless of env value (user-story §C2).
 */
export interface LowDataSignals {
  /** Value of the `Save-Data` request header, trimmed + lower-cased. */
  readonly saveData: string | undefined
  /** Value of the `Sec-CH-Prefers-Reduced-Data` client-hint header. */
  readonly clientHint: string | undefined
  /** Value of the `sovrium_low_data` cookie (`'on'` / `'off'` / undefined). */
  readonly cookie: 'on' | 'off' | undefined
}

/**
 * Resolve whether the current request should be served in low-data variant.
 *
 * Precedence (highest first):
 *   1. `sovrium_low_data=off` cookie  → false (explicit user override always wins)
 *   2. `sovrium_low_data=on` cookie   → true  (explicit user opt-in always wins)
 *   3. env `on`                       → true
 *   4. env `respect-client` AND any positive header signal → true
 *   5. otherwise (env `off`, env `respect-client` with no signals) → false
 *
 * The cookie precedence over env is what makes the toggle a real user-
 * controlled affordance and not a marketing badge — see ADR 013 D6.
 */
export const resolveLowDataMode = (env: EcoLowDataDefault, signals: LowDataSignals): boolean => {
  if (signals.cookie === 'off') return false
  if (signals.cookie === 'on') return true
  if (env === 'on') return true
  if (env === 'off') return false
  // respect-client — accept Save-Data: on or Sec-CH-Prefers-Reduced-Data: reduce.
  return signals.saveData?.toLowerCase() === 'on' || signals.clientHint?.toLowerCase() === 'reduce'
}
