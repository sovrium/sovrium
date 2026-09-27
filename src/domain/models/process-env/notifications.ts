/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The operator-email variables.
 *
 * - `SOVRIUM_NOTIFY_AUTOMATIONS` — `on` (default) or `off`, the instance-wide
 *   kill switch for the automation-failure email.
 * - `SOVRIUM_NOTIFY_TO` — a comma-separated list of extra addresses that receive
 *   the operator emails beside the app's admin-tier accounts. It is the only
 *   audience an app without an `auth:` block has, which is why it exists.
 * - `SOVRIUM_AUTOMATION_AUTOPAUSE` — unset (the default: never) or a positive
 *   integer N, the number of final failures IN A ROW after which the platform
 *   pauses an automation itself.
 * - `SOVRIUM_NOTIFY_DIGEST` — `weekly` (default) or `off`, the instance-wide
 *   switch for the weekly summary email.
 * - `SOVRIUM_NOTIFY_DIGEST_CRON` — when the weekly summary goes out, as a
 *   five-field cron expression read in the operator timezone
 *   (`SOVRIUM_TIMEZONE`). Default `0 8 * * 1`: Mondays at 08:00.
 *
 * ─── WHY THESE ARE ENV VARS AND NOT CONFIG KEYS ────────────────────────────
 *
 * Who is paged when something breaks is a property of the DEPLOYMENT — the same
 * app runs in staging and in production with different on-call addresses — so
 * it belongs to whoever operates the host, not in the versioned application.
 *
 * ─── WHY A BAD VALUE THROWS ────────────────────────────────────────────────
 *
 * `SOVRIUM_NOTIFY_AUTOMATIONS=false` read leniently would mean "not off, so on",
 * and a mistyped address in `SOVRIUM_NOTIFY_TO` would silently page nobody. Both
 * are discovered only when an alert fails to arrive — the worst moment. Refusing
 * the boot, naming the variable and the value, moves that discovery to startup.
 */

import { Cron, Result } from 'effect'
import { isValidEmail } from '@/domain/kernel/sanitize/email-validation'
import { parseEcoEnum } from './eco/eco-env-parsing'

/** The automation-alert kill switch's two postures. */
export type SovriumNotifyAutomationsMode = 'on' | 'off'

/** The kill switch's name, so a caller can quote it without spelling it again. */
export const SOVRIUM_NOTIFY_AUTOMATIONS_VAR = 'SOVRIUM_NOTIFY_AUTOMATIONS'

/** The extra-recipients variable's name. */
export const SOVRIUM_NOTIFY_TO_VAR = 'SOVRIUM_NOTIFY_TO'

/**
 * Resolve `SOVRIUM_NOTIFY_AUTOMATIONS`. Unset, empty or whitespace-only is `on`.
 *
 * @param env - the environment to read (defaults to the process environment).
 * @throws Error when set to anything other than `on` or `off`.
 */
export const parseSovriumNotifyAutomations = (
  env: Readonly<Record<string, string | undefined>> = process.env
): SovriumNotifyAutomationsMode =>
  parseEcoEnum(SOVRIUM_NOTIFY_AUTOMATIONS_VAR, env[SOVRIUM_NOTIFY_AUTOMATIONS_VAR], {
    allowed: ['on', 'off'] as const,
    fallback: 'on',
  })

/**
 * Resolve `SOVRIUM_NOTIFY_TO` into its addresses, trimmed, in the order given.
 * Unset or empty is `[]`; empty entries between commas are ignored.
 *
 * @param env - the environment to read (defaults to the process environment).
 * @throws Error naming the variable and the offending entry when one is not a
 *   valid email address.
 */
export const parseSovriumNotifyTo = (
  env: Readonly<Record<string, string | undefined>> = process.env
): readonly string[] => {
  const entries = (env[SOVRIUM_NOTIFY_TO_VAR] ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '')
  const invalid = entries.find((entry) => !isValidEmail(entry))
  if (invalid !== undefined) {
    // eslint-disable-next-line functional/no-throw-statements -- a boot-time refusal: the caller turns it into a startup failure before the port binds.
    throw new Error(
      `${SOVRIUM_NOTIFY_TO_VAR} must be a comma-separated list of email addresses; "${invalid}" is not one.`
    )
  }
  return entries
}

/** The automatic-pause threshold variable's name. */
export const SOVRIUM_AUTOMATION_AUTOPAUSE_VAR = 'SOVRIUM_AUTOMATION_AUTOPAUSE'

/**
 * Resolve `SOVRIUM_AUTOMATION_AUTOPAUSE`: the number of consecutive final
 * failures that pauses an automation, or `undefined` when automatic pausing is
 * off. Unset, empty or whitespace-only is off — pausing a workflow is a
 * decision the operator opts into, never a default.
 *
 * Anything but a positive whole number throws, naming the variable and the
 * value: `0` or `-1` read leniently would either pause on the first failure or
 * never, and the operator would find out only when an automation stopped.
 */
export const parseSovriumAutomationAutopause = (
  env: Readonly<Record<string, string | undefined>> = process.env
): number | undefined => {
  const raw = env[SOVRIUM_AUTOMATION_AUTOPAUSE_VAR]?.trim() ?? ''
  if (raw === '') return undefined
  if (!/^\d+$/.test(raw) || Number(raw) < 1) {
    // eslint-disable-next-line functional/no-throw-statements -- a boot-time refusal: the caller turns it into a startup failure before the port binds.
    throw new Error(
      `${SOVRIUM_AUTOMATION_AUTOPAUSE_VAR} must be a positive whole number of consecutive failures, or unset; "${raw}" is not one.`
    )
  }
  return Number(raw)
}

/** The weekly summary switch's two postures. */
export type SovriumNotifyDigestMode = 'weekly' | 'off'

/** The weekly summary switch's name. */
export const SOVRIUM_NOTIFY_DIGEST_VAR = 'SOVRIUM_NOTIFY_DIGEST'

/**
 * Resolve `SOVRIUM_NOTIFY_DIGEST`. Unset, empty or whitespace-only is `weekly`.
 *
 * @param env - the environment to read (defaults to the process environment).
 * @throws Error when set to anything other than `weekly` or `off`.
 */
export const parseSovriumNotifyDigest = (
  env: Readonly<Record<string, string | undefined>> = process.env
): SovriumNotifyDigestMode =>
  parseEcoEnum(SOVRIUM_NOTIFY_DIGEST_VAR, env[SOVRIUM_NOTIFY_DIGEST_VAR], {
    allowed: ['weekly', 'off'] as const,
    fallback: 'weekly',
  })

/** The weekly summary schedule variable's name. */
export const SOVRIUM_NOTIFY_DIGEST_CRON_VAR = 'SOVRIUM_NOTIFY_DIGEST_CRON'

/** Mondays at 08:00, in the operator timezone. */
export const DEFAULT_NOTIFY_DIGEST_CRON = '0 8 * * 1'

/**
 * Resolve `SOVRIUM_NOTIFY_DIGEST_CRON` into a five-field cron expression.
 * Unset, empty or whitespace-only is {@link DEFAULT_NOTIFY_DIGEST_CRON}.
 *
 * Validated with the same parser the scheduler runs it with, so an expression
 * that would never fire — or fire every second — refuses the boot instead of
 * silencing the summary. Six-field (seconds) expressions are refused: a
 * weekly email has no use for them, and a stray leading field is the typo
 * that would turn it into a flood.
 *
 * @param env - the environment to read (defaults to the process environment).
 * @throws Error naming the variable and the value when it is not a valid
 *   five-field cron expression.
 */
export const parseSovriumNotifyDigestCron = (
  env: Readonly<Record<string, string | undefined>> = process.env
): string => {
  const raw = env[SOVRIUM_NOTIFY_DIGEST_CRON_VAR]?.trim() ?? ''
  if (raw === '') return DEFAULT_NOTIFY_DIGEST_CRON
  const expression = raw.split(/\s+/).join(' ')
  if (expression.split(' ').length !== 5 || Result.isFailure(Cron.parse(expression))) {
    // eslint-disable-next-line functional/no-throw-statements -- a boot-time refusal: the caller turns it into a startup failure before the port binds.
    throw new Error(
      `${SOVRIUM_NOTIFY_DIGEST_CRON_VAR} must be a five-field cron expression such as "${DEFAULT_NOTIFY_DIGEST_CRON}"; "${raw}" is not one.`
    )
  }
  return expression
}
