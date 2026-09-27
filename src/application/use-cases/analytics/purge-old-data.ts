/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { zonedInstantDaysBefore } from '@/domain/kernel/time/zoned-calendar'
import { AnalyticsRepository } from '../../ports/repositories/analytics/analytics-repository'
import type { AnalyticsDatabaseError } from '../../ports/repositories/analytics/analytics-repository'

/**
 * Default retention period in days when not configured
 */
const DEFAULT_RETENTION_DAYS = 365

/**
 * Purge analytics data older than the configured retention period.
 *
 * Deletes page view records that exceed the retention window.
 * Returns the number of records deleted.
 *
 * The window is counted in calendar days on the wall clock of `timeZone` (the
 * operator timezone), so a day across a DST change is the 23 or 25 hours a
 * clock shows — never the host's POSIX `TZ`, which a `Date`'s local setters
 * would silently follow.
 *
 * @param appName - Application name to scope deletion
 * @param retentionDays - Number of days to retain (default: 365)
 * @param timeZone - IANA zone the calendar days are counted in (operator timezone)
 * @returns Number of deleted records
 */
export const purgeOldAnalyticsData = (
  appName: string,
  retentionDays: number | undefined,
  timeZone: string
): Effect.Effect<number, AnalyticsDatabaseError, AnalyticsRepository> =>
  Effect.gen(function* () {
    const repo = yield* AnalyticsRepository

    const days = retentionDays ?? DEFAULT_RETENTION_DAYS
    const cutoff = zonedInstantDaysBefore(new Date(), timeZone, days)

    return yield* repo.deleteOlderThan(appName, cutoff)
  }).pipe(Effect.withSpan('analytics.purge-old-analytics-data'))
