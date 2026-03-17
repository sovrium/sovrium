/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AnalyticsRepository } from '../../ports/repositories/analytics-repository'
import type { AnalyticsDatabaseError } from '../../ports/repositories/analytics-repository'

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
 * @param appName - Application name to scope deletion
 * @param retentionDays - Number of days to retain (default: 365)
 * @returns Number of deleted records
 */
export const purgeOldAnalyticsData = (
  appName: string,
  retentionDays?: number
): Effect.Effect<number, AnalyticsDatabaseError, AnalyticsRepository> =>
  Effect.gen(function* () {
    const repo = yield* AnalyticsRepository

    const days = retentionDays ?? DEFAULT_RETENTION_DAYS
    const cutoff = new Date()
    // eslint-disable-next-line functional/no-expression-statements
    cutoff.setDate(cutoff.getDate() - days)

    return yield* repo.deleteOlderThan(appName, cutoff)
  })
