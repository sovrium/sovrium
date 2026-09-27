/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `SOVRIUM_TIMEZONE` — the operator timezone.
 *
 * One IANA zone, chosen by whoever operates the deployment, is the default for
 * every timed feature that names no zone of its own: cron triggers, agent
 * schedules, date actions, the display formatting of records, and the calendar
 * day behind retention windows. An explicit `timezone` on a trigger, a schedule,
 * an action or a request always wins over it.
 *
 * ─── WHY NOT POSIX `TZ` ────────────────────────────────────────────────────
 *
 * `TZ` belongs to the host: container images, hosting platforms and CI runners
 * set it for their own reasons, and none of them is a statement about when the
 * operator's reports should run. Reading it would let a base-image change move
 * every schedule. So Sovrium neither reads nor sets it: the zone is this
 * variable or UTC, and nothing else.
 *
 * ─── WHY AN UNKNOWN ZONE THROWS ────────────────────────────────────────────
 *
 * A mistyped zone (`Europe/Pari`) read leniently would fall back to UTC and
 * move every schedule by an hour or two with no diagnostic. Refusing the boot,
 * naming the variable and the value, costs one restart and removes that class.
 *
 * Pure: the environment is a parameter, so the function reads nothing global
 * beyond its default argument. It is uncached on purpose — an in-process test
 * harness boots many servers per worker, and a cache would freeze the first
 * one's zone for all of them.
 */

import { DateTime, Option } from 'effect'

/** The variable's name, so a caller can quote it without spelling it again. */
export const SOVRIUM_TIMEZONE_VAR = 'SOVRIUM_TIMEZONE'

/** The zone used when the operator has not set one. */
export const SOVRIUM_TIMEZONE_DEFAULT = 'UTC'

/** The resolved operator timezone. */
export interface SovriumTimezone {
  /** An IANA zone identifier, e.g. `Europe/Paris`. */
  readonly zoneId: string
}

/**
 * Resolve `SOVRIUM_TIMEZONE`.
 *
 * Unset, empty or whitespace-only resolves to UTC. Any other value must name a
 * zone the runtime's time-zone database knows.
 *
 * @param env - the environment to read (defaults to the process environment).
 * @throws Error naming the variable and the value when the zone is unknown.
 */
export const parseSovriumTimezone = (
  env: Readonly<Record<string, string | undefined>> = process.env
): SovriumTimezone => {
  const raw = env[SOVRIUM_TIMEZONE_VAR]?.trim() ?? ''
  if (raw === '') return { zoneId: SOVRIUM_TIMEZONE_DEFAULT }
  const zone = DateTime.zoneMakeNamed(raw)
  if (Option.isNone(zone)) {
    // eslint-disable-next-line functional/no-throw-statements -- a boot-time refusal: the caller turns it into a startup failure before the port binds.
    throw new Error(
      `${SOVRIUM_TIMEZONE_VAR} must be an IANA timezone such as "Europe/Paris" or "UTC"; got "${raw}".`
    )
  }
  return { zoneId: DateTime.zoneToString(zone.value) }
}
