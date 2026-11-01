/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * How each analytics report reads under the `audience-only` profile: every
 * figure rounded by `roundReportCount`, every breakdown share computed over the
 * rounded counts. A report's `total` that counts ROWS of the report (pages,
 * referrers, campaigns) is not a count of people and stays exact; ranking was
 * done on the stored counts before any of this runs.
 *
 * Kept beside the routes rather than in them so `routes.ts` stays inside its
 * line budget, and so the one place a report figure is rounded is readable on
 * its own.
 */

import {
  roundReportCount,
  roundedShares,
} from '@/domain/models/app/analytics/report-rounding-service'
import { validationError } from '@/presentation/api/runtime/auth-helpers'
import type { AnalyticsProfile } from '@/domain/models/app/analytics/analytics-profile-service'
import type { Context } from 'hono'

/** A row carrying the two audience figures every visit report answers. */
interface VisitFigures {
  readonly pageViews: number
  readonly uniqueVisitors: number
}

/** A breakdown entry of the device report. */
interface ShareEntry {
  readonly name: string
  readonly count: number
  readonly percentage: number
}

const roundVisits = <R extends VisitFigures>(row: R): R => ({
  ...row,
  pageViews: roundReportCount(row.pageViews),
  uniqueVisitors: roundReportCount(row.uniqueVisitors),
})

const roundSessions = <R extends VisitFigures & { readonly sessions: number }>(row: R): R => ({
  ...roundVisits(row),
  sessions: roundReportCount(row.sessions),
})

const roundBreakdown = <E extends ShareEntry>(entries: readonly E[]): readonly E[] =>
  roundedShares(entries).entries as readonly E[]

/** The overview: its summary and every point of its series. */
export const roundOverview = <
  O extends {
    readonly summary: VisitFigures & { readonly sessions: number }
    readonly timeSeries: ReadonlyArray<VisitFigures & { readonly sessions: number }>
  },
>(
  overview: O
): O => ({
  ...overview,
  summary: roundSessions(overview.summary),
  timeSeries: overview.timeSeries.map(roundSessions),
})

/** A ranked list of visit rows under `key`; its `total` (a row count) stays exact. */
export const roundVisitRows =
  <K extends string>(key: K) =>
  <R extends Readonly<Record<K, ReadonlyArray<VisitFigures>>>>(report: R): R => ({
    ...report,
    [key]: report[key].map(roundVisits),
  })

/** The device report: each of its three breakdowns, shares over the rounded counts. */
export const roundDevices = <
  D extends {
    readonly deviceTypes: readonly ShareEntry[]
    readonly browsers: readonly ShareEntry[]
    readonly operatingSystems: readonly ShareEntry[]
  },
>(
  devices: D
): D => ({
  ...devices,
  deviceTypes: roundBreakdown(devices.deviceTypes),
  browsers: roundBreakdown(devices.browsers),
  operatingSystems: roundBreakdown(devices.operatingSystems),
})

/**
 * The 400 an hourly series is refused with under `audience-only`, or
 * `undefined` when the request may proceed. The finest series that profile
 * answers is a day.
 */
export const refuseHourlySeries = (c: Context, profile: AnalyticsProfile): Response | undefined =>
  profile === 'audience-only' && c.req.query('granularity') === 'hour'
    ? validationError(c, [
        {
          field: 'granularity',
          message:
            'Hourly series are not available under the audience-only analytics profile; use day, week or month',
        },
      ])
    : undefined
