/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect, Layer } from 'effect'
import {
  UsersOverviewRepository,
  type UsersOverviewDatabaseError,
  type UserOverviewRow,
} from '@/application/ports/repositories/tables/users-overview-repository'
import {
  resolvePeriodWindow,
  type PeriodPreset,
} from '@/domain/models/api/admin/_shared/period-preset'
import {
  usersOverviewResponseSchema,
  type UsersOverviewResponse,
  type UsersOverviewSeriesPoint,
} from '@/domain/models/api/admin/users'
import { UsersOverviewRepositoryLive } from '@/infrastructure/database/repositories/tables/users-overview-repository-live'


const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

function tsToMs(value: Readonly<Date> | string | number): number {
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  return new Date(value).getTime()
}

function buildDenseSeries(
  fromIso: string,
  toIso: string,
  interval: '1h' | '1d',
  rowsByBucket: ReadonlyMap<string, { readonly signups: number; readonly sessions_started: number }>
): readonly UsersOverviewSeriesPoint[] {
  const stepMs = interval === '1h' ? HOUR_MS : DAY_MS
  const fromMs = new Date(fromIso).getTime()
  const toMs = new Date(toIso).getTime()
  const firstBucketMs = Math.floor(fromMs / stepMs) * stepMs
  const lastBucketMs = Math.floor(toMs / stepMs) * stepMs
  const expectedCount = Math.max(1, Math.round((lastBucketMs - firstBucketMs) / stepMs) + 1)
  const bucketIndexes: readonly number[] = Array.from({ length: expectedCount }, (_unused, i) => i)
  return bucketIndexes.map((i) => {
    const timestamp = new Date(firstBucketMs + i * stepMs).toISOString()
    const found = rowsByBucket.get(timestamp)
    return {
      timestamp,
      signups: found?.signups ?? 0,
      sessions_started: found?.sessions_started ?? 0,
    }
  })
}

function bucketTimestamps(
  rows: ReadonlyArray<{ readonly createdAt: Readonly<Date> | string | number }>,
  fromMs: number,
  stepMs: number
): ReadonlyMap<string, number> {
  const keys = rows
    .filter((row) => tsToMs(row.createdAt) >= fromMs)
    .map((row) => new Date(Math.floor(tsToMs(row.createdAt) / stepMs) * stepMs).toISOString())
  const counts = keys.reduce<Readonly<Record<string, number>>>(
    (acc, key) => ({ ...acc, [key]: (acc[key] ?? 0) + 1 }),
    {}
  )
  return new Map(Object.entries(counts))
}


function classifyRole(raw: string | null | undefined): 'admin' | 'operator' | 'member' {
  if (raw === 'admin') return 'admin'
  if (raw === 'operator') return 'operator'
  return 'member'
}


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

const tallyUserRows = (rows: ReadonlyArray<UserOverviewRow>, fromMs: number): UserTotals =>
  rows.reduce<UserTotals>(
    (acc, row) => {
      const cls = classifyRole(row.role)
      const inPeriod = tsToMs(row.createdAt) >= fromMs
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


export type UsersOverviewOutcome =
  | { readonly _tag: 'Ok'; readonly body: UsersOverviewResponse }
  | { readonly _tag: 'ValidationFailed'; readonly error: unknown }


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

    const totals = tallyUserRows(yield* repo.listUserRows(), fromMs)

    const active24h = yield* repo.countActiveUsersSince(last24hDate)

    const sessionRowsInPeriod = yield* repo.listSessionRowsSince(fromDate)

    const stepMs = window.interval === '1h' ? HOUR_MS : DAY_MS
    const merged = mergeBuckets(
      bucketTimestamps(totals.signupRowsInPeriod, fromMs, stepMs),
      bucketTimestamps(sessionRowsInPeriod, fromMs, stepMs)
    )
    const points = buildDenseSeries(window.from, window.to, window.interval, merged)

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

    const parsed = usersOverviewResponseSchema.safeParse(body)
    if (!parsed.success) {
      return { _tag: 'ValidationFailed', error: parsed.error } as const
    }
    return { _tag: 'Ok', body: parsed.data } as const
  })

export const UsersOverviewLayer = Layer.mergeAll(UsersOverviewRepositoryLive)
