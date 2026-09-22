/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Use case for the admin users-overview tile (`GET /api/admin/users/overview`).
 *
 * The application layer owns all pure logic:
 *   - coercing dialect-native timestamps to epoch-ms,
 *   - bucketing signup + session timestamps into the interval grid,
 *   - building a dense bucket series (empty buckets present with 0 counts),
 *   - classifying the raw `auth.user.role` value into the response's by_role
 *     bucket,
 *   - assembling + response-schema-validating the final overview body.
 *
 * Only the three raw reads (full user scan, distinct-active count, session list)
 * live in the infrastructure repository, accessed via
 * {@link UsersOverviewRepository}. The audit emit (`user.overview.queried`) is
 * already an application-layer async funnel and is composed by the route after a
 * successful read.
 *
 * Locks plan §6.4 (canonical `series` rollup shape) + [internal ref] D5 (fixed-bucket
 * interval mapping) by consuming the shared `resolvePeriodWindow()` helper rather
 * than re-deriving the bucket grid.
 */

import { Effect } from 'effect'
import {
  UsersOverviewRepository,
  type UsersOverviewDatabaseError,
  type UserOverviewRow,
} from '@/application/ports/repositories/tables/users-overview-repository'
import {
  bucketRowsByTimestamp,
  buildDenseBucketGrid,
  coerceTimestampToMs,
  HOUR_MS,
  intervalStepMs,
} from '@/domain/kernel/time/time-series-bucketing'
import {
  resolvePeriodWindow,
  type PeriodPreset,
  type PeriodWindow,
} from '@/domain/models/api/admin/envelope/period-preset'
import {
  usersOverviewResponseSchema,
  type UsersOverviewResponse,
  type UsersOverviewSeriesPoint,
} from '@/domain/models/api/admin/users'
import { decodeSafe } from '@/domain/models/api/combinators/decode'

// ─── Role mapping ────────────────────────────────────────────────────────────

/**
 * Map the raw `auth.user.role` column value to the response's by_role bucket.
 *
 * Mirrors `application/use-cases/tables/user-role.ts`: NULL / unknown → 'member'.
 * `admin` and `operator` are the two named admin-tier roles; everything else
 * (including a future custom role) collapses into 'member' for the
 * dashboard tile. When a new role lands, the response schema gets an
 * additive field and this mapping gets a new branch — non-breaking.
 */
function classifyRole(raw: string | null | undefined): 'admin' | 'operator' | 'member' {
  if (raw === 'admin') return 'admin'
  if (raw === 'operator') return 'operator'
  return 'member'
}

// ─── Role / bucket tallies ─────────────────────────────────────────────────

/** Aggregate tallies derived from a single full scan of `auth.user`. */
interface UserTotals {
  readonly totalUsers: number
  readonly admins: number
  readonly operators: number
  readonly members: number
  readonly newInPeriod: number
  readonly signupRowsInPeriod: ReadonlyArray<{
    readonly createdAt: Readonly<Date> | string | number
  }>
}

/**
 * Fold the full `auth.user` row list into the totals + in-period signup rows.
 * NULL / unknown roles classify to `member`; a row counts toward
 * `newInPeriod` (and its createdAt joins `signupRowsInPeriod`) when its
 * timestamp is on/after `fromMs`.
 */
const tallyUserRows = (rows: ReadonlyArray<UserOverviewRow>, fromMs: number): UserTotals =>
  rows.reduce<UserTotals>(
    (acc, row) => {
      const cls = classifyRole(row.role)
      const inPeriod = coerceTimestampToMs(row.createdAt) >= fromMs
      return {
        totalUsers: acc.totalUsers + 1,
        admins: acc.admins + (cls === 'admin' ? 1 : 0),
        operators: acc.operators + (cls === 'operator' ? 1 : 0),
        members: acc.members + (cls === 'member' ? 1 : 0),
        newInPeriod: acc.newInPeriod + (inPeriod ? 1 : 0),
        signupRowsInPeriod: inPeriod
          ? [...acc.signupRowsInPeriod, { createdAt: row.createdAt }]
          : acc.signupRowsInPeriod,
      }
    },
    {
      totalUsers: 0,
      admins: 0,
      operators: 0,
      members: 0,
      newInPeriod: 0,
      signupRowsInPeriod: [],
    }
  )

/**
 * Merge the signup and sessions_started bucket counts into a single map keyed
 * by ISO timestamp, ready for the dense-series fill.
 */
const mergeBuckets = (
  signupsByBucket: ReadonlyMap<string, number>,
  sessionsByBucket: ReadonlyMap<string, number>
): ReadonlyMap<string, { readonly signups: number; readonly sessions_started: number }> => {
  const bucketKeys = new Set<string>([...signupsByBucket.keys(), ...sessionsByBucket.keys()])
  return new Map(
    [...bucketKeys].map((key) => [
      key,
      {
        signups: signupsByBucket.get(key) ?? 0,
        sessions_started: sessionsByBucket.get(key) ?? 0,
      },
    ])
  )
}

/**
 * Bucket the in-period signup + session timestamps into the dense response
 * series via the shared time-series helpers. Signups and sessions are counted
 * into separate per-bucket maps, then merged into the
 * `{ signups, sessions_started }` point shape and filled across the dense grid.
 */
function buildUsersSeries(
  window: PeriodWindow,
  signupRows: ReadonlyArray<{ readonly createdAt: Readonly<Date> | string | number }>,
  sessionRows: ReadonlyArray<{ readonly createdAt: Readonly<Date> | string | number }>
): readonly UsersOverviewSeriesPoint[] {
  const stepMs = intervalStepMs(window.interval)
  const fromMs = new Date(window.from).getTime()
  const countRows = (
    rows: ReadonlyArray<{ readonly createdAt: Readonly<Date> | string | number }>
  ): ReadonlyMap<string, number> =>
    bucketRowsByTimestamp({
      rows,
      getTimestamp: (row) => row.createdAt,
      stepMs,
      initial: 0,
      accumulate: (count) => count + 1,
      fromMs,
    })
  const merged = mergeBuckets(countRows(signupRows), countRows(sessionRows))
  return buildDenseBucketGrid({
    fromIso: window.from,
    toIso: window.to,
    stepMs,
    rowsByBucket: merged,
    emptyValue: { signups: 0, sessions_started: 0 },
  })
}

// ─── Result shape ────────────────────────────────────────────────────────────

/**
 * Outcome of the overview build. `Ok` carries the response-schema-validated
 * body; `ValidationFailed` signals the assembled body failed the response gate
 * (the route maps this to a 500 + logs the Zod error, exactly as before).
 */
export type UsersOverviewOutcome =
  | { readonly _tag: 'Ok'; readonly body: UsersOverviewResponse }
  | { readonly _tag: 'ValidationFailed'; readonly error: unknown }

// ─── Use case ────────────────────────────────────────────────────────────────

/**
 * Build the users-overview body for the requested `period`.
 *
 * Reads (via {@link UsersOverviewRepository}):
 *   - the full `auth.user` `{ role, createdAt }` scan → totals.users + by_role +
 *     in-period signups,
 *   - the distinct-active-users count since 24h ago → totals.active_24h,
 *   - the in-period `auth.session` `{ createdAt }` list → sessions_started series.
 *
 * Returns the response-schema-validated body (`Ok`) or `ValidationFailed` when
 * the assembled body does not match `usersOverviewResponseSchema`. The audit
 * emit is composed by the route after a successful read.
 */
export const BuildUsersOverview = (
  period: PeriodPreset
): Effect.Effect<UsersOverviewOutcome, UsersOverviewDatabaseError, UsersOverviewRepository> =>
  Effect.gen(function* () {
    const repo = yield* UsersOverviewRepository

    const window = resolvePeriodWindow(period)
    const fromDate = new Date(window.from)
    const fromMs = fromDate.getTime()
    const nowMs = Date.now()
    const last24hDate = new Date(nowMs - 24 * HOUR_MS)

    // 1) totals.users + by_role + in-period signups — one full scan.
    const totals = tallyUserRows(yield* repo.listUserRows, fromMs)

    // 2) active_24h — distinct user_id from auth.session rows in last 24h.
    const active24h = yield* repo.countActiveUsersSince(last24hDate)

    // 3) series — bucket signups + sessions_started by the window.interval grid.
    //    Signups come from the in-memory rows we already filtered above; for
    //    sessions, fetch the createdAt list scoped to the same window.
    const sessionRowsInPeriod = yield* repo.listSessionRowsSince(fromDate)

    const points = buildUsersSeries(window, totals.signupRowsInPeriod, sessionRowsInPeriod)

    const body = {
      totals: {
        users: totals.totalUsers,
        active_24h: active24h,
        new_in_period: totals.newInPeriod,
        by_role: {
          admin: totals.admins,
          operator: totals.operators,
          member: totals.members,
        },
      },
      series: {
        interval: window.interval,
        points: [...points],
      },
    } satisfies UsersOverviewResponse

    const parsed = decodeSafe(usersOverviewResponseSchema)(body)
    if (!parsed.success) {
      return { _tag: 'ValidationFailed', error: parsed.error } as const
    }
    return { _tag: 'Ok', body: parsed.data } as const
  }).pipe(Effect.withSpan('admin.build-users-overview'))
