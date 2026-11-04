/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * When the server's hourly maintenance runs.
 *
 * Three jobs run once an hour: the form-draft expiry, the automation-failure
 * roll-up and the account-erasure purge. Run at minute 0 everywhere, every
 * instance on a host would wake together on the hour. Each instance instead
 * runs all three at one minute of the hour, derived from its app's name: the
 * same on every start of an app, spread across apps. The minute is logged once
 * at boot, so an operator knows when to expect the hourly summary.
 */

import { Effect } from 'effect'
import { logInfo } from '@/infrastructure/logging/logger'

/** What the hourly maintenance does, as the boot line names it. */
const HOURLY_MAINTENANCE_JOBS: readonly string[] = [
  'form drafts',
  'failure roll-up',
  'account purge',
]

/**
 * The minute of the hour, 0 to 59, at which an app's hourly maintenance runs:
 * a stable hash (32-bit FNV-1a) of its name, modulo 60.
 */
export const hourlyMaintenanceMinute = (appName: string): number =>
  [...new TextEncoder().encode(appName)].reduce(
    (hash, byte) => Math.imul(hash ^ byte, 0x01_00_01_93) >>> 0,
    0x81_1c_9d_c5
  ) % 60

/** The cron expression of an app's hourly jobs: once an hour, at its minute. */
export const hourlyCronExpression = (appName: string): string =>
  `${String(hourlyMaintenanceMinute(appName))} * * * *`

/** The boot line naming the minute. */
export const describeHourlyMaintenance = (appName: string): string =>
  `[scheduler] hourly maintenance runs at minute ${String(hourlyMaintenanceMinute(appName))} of each hour (${HOURLY_MAINTENANCE_JOBS.join(', ')})`

/** Log, once at boot, the minute at which the hourly maintenance runs. */
export const logHourlyMaintenance = (appName: string): Effect.Effect<void> =>
  Effect.sync(() => logInfo(describeHourlyMaintenance(appName)))
