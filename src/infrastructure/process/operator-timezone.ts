/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { parseSovriumTimezone } from '@/domain/models/process-env/timezone'

/**
 * The operator timezone (`SOVRIUM_TIMEZONE`, UTC when unset), as an IANA id.
 *
 * Read at each boundary that needs it — a cron registration, a formatter, a
 * retention sweep — rather than captured once. Deliberately uncached: the
 * in-process test harness boots many servers in one process, each with its own
 * environment, and a module-level cache would freeze the first one's zone.
 * Validation happens at boot (`startServer`), so a bad value never reaches a
 * request; calling this later only re-reads a value already known to be good.
 *
 * POSIX `TZ` is never read nor set: it belongs to the host.
 *
 * @param env - the environment to read (defaults to the process environment).
 */
export const resolveOperatorTimezone = (
  env: Readonly<Record<string, string | undefined>> = process.env
): string => parseSovriumTimezone(env).zoneId
