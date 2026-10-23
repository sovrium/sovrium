/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `SOVRIUM_SELF_SEED` — the host's switch for the `app/seed` automation
 * action, which seeds an app's own data from its own seed files and, in mode
 * `reset`, brings the whole app back to them.
 *
 * - unset, empty or whitespace: off. No automation holding an `app/seed` step
 *   is scheduled.
 * - `reset`: every mode is allowed, `replace` and `reset` included.
 * - any other value: `if-empty` and `upsert` are allowed; `replace` and
 *   `reset`, the two modes that delete rows, are not.
 *
 * ─── WHY AN ENV VAR AND NOT A CONFIG KEY ───────────────────────────────────
 *
 * A template ships its seed and its nightly reset in its config. Whether that
 * reset may run is a fact about the HOST — a demo server, not a customer's app
 * built from the template — so it belongs to whoever operates the host. A
 * config key would travel with every copy of the template and wipe the first
 * customer who kept it.
 *
 * ─── WHY ANY OTHER VALUE IS READ, NOT REFUSED ──────────────────────────────
 *
 * The only value that unlocks deletion is the exact word `reset`. Any other
 * value can at most add rows that are missing, so a typo cannot destroy data;
 * refusing the boot over it would take an app down for no protection.
 */

type Env = Readonly<Record<string, string | undefined>>

/** The variable's name.
 *
 * @public
 */
export const SOVRIUM_SELF_SEED_VAR = 'SOVRIUM_SELF_SEED'

/**
 * What the switch allows: nothing, the two modes that never delete
 * (`additive`), or every mode (`reset`).
 *
 * @public
 */
export type SelfSeedGate = 'off' | 'additive' | 'reset'

/**
 * Read `SOVRIUM_SELF_SEED`.
 *
 * @public
 */
export const parseSovriumSelfSeed = (env: Env = process.env): SelfSeedGate => {
  const raw = env[SOVRIUM_SELF_SEED_VAR]?.trim() ?? ''
  if (raw === '') return 'off'
  return raw === 'reset' ? 'reset' : 'additive'
}

const ADDITIVE_MODES: ReadonlySet<string> = new Set(['if-empty', 'upsert'])

/**
 * Whether the switch allows a step written in `mode`. An automation holding
 * one step the switch does not allow is not scheduled at all.
 *
 * @public
 */
export const selfSeedGateAllows = (gate: SelfSeedGate, mode: string): boolean => {
  if (gate === 'off') return false
  return gate === 'reset' || ADDITIVE_MODES.has(mode)
}
