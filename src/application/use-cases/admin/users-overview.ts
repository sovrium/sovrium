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
 *   - counting each account under the assignable role it holds, apart when its
 *     stored role is empty or unassignable, and setting aside the accounts an
 *     unaccepted invitation provisioned,
 *   - assembling + response-schema-validating the final overview body.
 *
 * Only the four raw reads (full user scan, pending invitee ids, distinct-active
 * count, session list) live in the infrastructure repository, accessed via
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
import { assignableRoleNames, type AdminRoleResolvable } from '@/domain/models/app/auth/roles'

// ─── Role / bucket tallies ─────────────────────────────────────────────────

/** Aggregate tallies derived from a single full scan of `auth.user`. */
interface UserTotals {
  readonly totalUsers: number
  readonly invited: number
  readonly withoutRole: number
  readonly roleCounts: ReadonlyMap<string, number>
  readonly newInPeriod: number
  readonly signupRowsInPeriod: ReadonlyArray<{
    readonly createdAt: Readonly<Date> | string | number
  }>
}

/**
 * The roles this app can assign, sorted by name exactly as
 * `GET /api/admin/roles` sorts its rows, so the breakdown and the roles
 * endpoint list the same names in the same order.
 */
const sortedAssignableRoles = (app: AdminRoleResolvable): readonly string[] =>
  [...assignableRoleNames(app)].toSorted((a, b) => a.localeCompare(b))

/**
 * Fold the full `auth.user` row list into the totals + in-period signup rows.
 *
 * An account an unaccepted invitation provisioned is counted in `invited` and
 * nowhere else (it cannot sign in yet). Every other account is counted once:
 * under its role when the app can assign it, in `withoutRole` when the stored
 * value is empty or no longer assignable — the stored string itself is never
 * carried out. A row counts toward `newInPeriod` (and its createdAt joins
 * `signupRowsInPeriod`) when its timestamp is on/after `fromMs`.
 */
const tallyUserRows = (
  rows: ReadonlyArray<UserOverviewRow>,
  assignable: ReadonlySet<string>,
  pendingInvitees: ReadonlySet<string>,
  fromMs: number
): UserTotals =>
  rows.reduce<UserTotals>(
    (acc, row) => {
      if (pendingInvitees.has(row.id)) return { ...acc, invited: acc.invited + 1 }
      const role = row.role ?? ''
      const recognised = assignable.has(role)
      const inPeriod = coerceTimestampToMs(row.createdAt) >= fromMs
      return {
        totalUsers: acc.totalUsers + 1,
        invited: acc.invited,
        withoutRole: acc.withoutRole + (recognised ? 0 : 1),
        roleCounts: recognised
          ? new Map([...acc.roleCounts, [role, (acc.roleCounts.get(role) ?? 0) + 1]])
          : acc.roleCounts,
        newInPeriod: acc.newInPeriod + (inPeriod ? 1 : 0),
        signupRowsInPeriod: inPeriod
          ? [...acc.signupRowsInPeriod, { createdAt: row.createdAt }]
          : acc.signupRowsInPeriod,
      }
    },
    {
      totalUsers: 0,
      invited: 0,
      withoutRole: 0,
      roleCounts: new Map(),
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
 * (the route maps this to a 500 + logs the schema decode error, exactly as before).
 */
export type UsersOverviewOutcome =
  | { readonly _tag: 'Ok'; readonly body: UsersOverviewResponse }
  | { readonly _tag: 'ValidationFailed'; readonly error: unknown }

// ─── Use case ────────────────────────────────────────────────────────────────

/**
 * Build the users-overview body for the requested `period`.
 *
 * Reads (via {@link UsersOverviewRepository}):
 *   - the full `auth.user` `{ id, role, createdAt }` scan and the pending
 *     invitee ids → totals.users + roles + without_role + invited + in-period
 *     signups,
 *   - the distinct-active-users count since 24h ago → totals.active_24h,
 *   - the in-period `auth.session` `{ createdAt }` list → sessions_started series.
 *
 * Returns the response-schema-validated body (`Ok`) or `ValidationFailed` when
 * the assembled body does not match `usersOverviewResponseSchema`. The audit
 * emit is composed by the route after a successful read.
 */
export const BuildUsersOverview = (
  app: AdminRoleResolvable,
  period: PeriodPreset
): Effect.Effect<UsersOverviewOutcome, UsersOverviewDatabaseError, UsersOverviewRepository> =>
  Effect.gen(function* () {
    const repo = yield* UsersOverviewRepository

    const window = resolvePeriodWindow(period)
    const fromDate = new Date(window.from)
    const fromMs = fromDate.getTime()
    const nowMs = Date.now()
    const last24hDate = new Date(nowMs - 24 * HOUR_MS)

    // 1) totals.users + roles + without_role + invited + in-period signups —
    //    one full scan, with the unaccepted invitations' accounts set aside.
    const roleNames = sortedAssignableRoles(app)
    const pendingInvitees = new Set(yield* repo.listPendingInviteeIds)
    const totals = tallyUserRows(
      yield* repo.listUserRows,
      new Set(roleNames),
      pendingInvitees,
      fromMs
    )

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
        roles: roleNames.map((name) => ({ name, count: totals.roleCounts.get(name) ?? 0 })),
        without_role: totals.withoutRole,
        invited: totals.invited,
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
