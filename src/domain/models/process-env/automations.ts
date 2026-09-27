/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The automation-engine variables.
 *
 * - `SOVRIUM_AUTOMATION_DEFAULT_TIMEOUT_MS` — how long a run of an automation
 *   that declares no `timeout` may execute before it is stopped as
 *   `timed-out`, in milliseconds. Unset is 900000 (15 minutes). Only active
 *   execution counts: the time a run waits for a concurrency slot is not part
 *   of it.
 *
 * ─── WHY AN ENV VAR AND NOT A CONFIG KEY ───────────────────────────────────
 *
 * Each automation already states its own bound with `timeout`. The DEFAULT is
 * a property of the host running the engine — a slow machine, a remote AI
 * provider — so it belongs to whoever operates that host.
 *
 * ─── WHY A BAD VALUE THROWS ────────────────────────────────────────────────
 *
 * `SOVRIUM_AUTOMATION_DEFAULT_TIMEOUT_MS=15m` read leniently would fall back to
 * the default the operator meant to change, and they would find out only when a
 * run was stopped. Refusing the boot, naming the variable and the value, moves
 * that discovery to startup.
 */

/** The default-timeout variable's name. */
export const SOVRIUM_AUTOMATION_DEFAULT_TIMEOUT_MS_VAR = 'SOVRIUM_AUTOMATION_DEFAULT_TIMEOUT_MS'

/** Fifteen minutes: the run timeout of an automation that declares none. */
export const DEFAULT_AUTOMATION_RUN_TIMEOUT_MS = 900_000

/** The accepted range, the same one the `timeout` option of an automation has. */
export const MIN_AUTOMATION_RUN_TIMEOUT_MS = 1000
export const MAX_AUTOMATION_RUN_TIMEOUT_MS = 3_600_000

/** The value when it is a whole number of milliseconds inside the range, else `undefined`. */
const readTimeoutMs = (raw: string): number | undefined => {
  const value = Number(raw)
  return /^\d+$/.test(raw) &&
    value >= MIN_AUTOMATION_RUN_TIMEOUT_MS &&
    value <= MAX_AUTOMATION_RUN_TIMEOUT_MS
    ? value
    : undefined
}

/**
 * Resolve `SOVRIUM_AUTOMATION_DEFAULT_TIMEOUT_MS`. Unset, empty or
 * whitespace-only is {@link DEFAULT_AUTOMATION_RUN_TIMEOUT_MS}.
 *
 * @param env - the environment to read (defaults to the process environment).
 * @throws Error naming the variable and the value when it is not a whole number
 *   of milliseconds between 1000 and 3600000.
 */
export const parseSovriumAutomationDefaultTimeoutMs = (
  env: Readonly<Record<string, string | undefined>> = process.env
): number => {
  const raw = env[SOVRIUM_AUTOMATION_DEFAULT_TIMEOUT_MS_VAR]?.trim() ?? ''
  if (raw === '') return DEFAULT_AUTOMATION_RUN_TIMEOUT_MS
  const value = readTimeoutMs(raw)
  if (value === undefined) {
    // eslint-disable-next-line functional/no-throw-statements -- a boot-time refusal: the caller turns it into a startup failure before the port binds.
    throw new Error(
      `${SOVRIUM_AUTOMATION_DEFAULT_TIMEOUT_MS_VAR} must be a whole number of milliseconds between ${String(MIN_AUTOMATION_RUN_TIMEOUT_MS)} and ${String(MAX_AUTOMATION_RUN_TIMEOUT_MS)}; "${raw}" is not one.`
    )
  }
  return value
}

/**
 * The default run timeout for a run that is already under way: the variable's
 * value, or {@link DEFAULT_AUTOMATION_RUN_TIMEOUT_MS} when it is unset or
 * invalid. Never throws — the boot already refused an invalid value, and a run
 * must not fail because an environment passed to it later is malformed.
 */
export const resolveAutomationDefaultTimeoutMs = (
  env: Readonly<Record<string, string | undefined>> = process.env
): number =>
  readTimeoutMs(env[SOVRIUM_AUTOMATION_DEFAULT_TIMEOUT_MS_VAR]?.trim() ?? '') ??
  DEFAULT_AUTOMATION_RUN_TIMEOUT_MS
