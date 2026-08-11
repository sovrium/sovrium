/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

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

const ECO_LOW_DATA_DEFAULTS: ReadonlySet<EcoLowDataDefault> = new Set([
  'on',
  'off',
  'respect-client',
])

/** Default when `ECO_LOW_DATA_DEFAULT` is unset. */
export const DEFAULT_ECO_LOW_DATA_DEFAULT: EcoLowDataDefault = 'off'

/**
 * Resolve `ECO_LOW_DATA_DEFAULT` from a snapshot of env vars. An unset,
 * empty, or unrecognised value resolves to `off`.
 */
export const parseEcoLowDataDefault = (
  processEnv: Readonly<Record<string, string | undefined>>
): EcoLowDataDefault => {
  const raw = processEnv['ECO_LOW_DATA_DEFAULT']?.trim().toLowerCase()
  return raw !== undefined && ECO_LOW_DATA_DEFAULTS.has(raw as EcoLowDataDefault)
    ? (raw as EcoLowDataDefault)
    : DEFAULT_ECO_LOW_DATA_DEFAULT
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
