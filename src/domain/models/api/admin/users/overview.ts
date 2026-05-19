/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { z } from '@hono/zod-openapi'
import { periodPresetSchema } from '@/domain/models/api/admin/_shared/period-preset'

export const usersOverviewQuerySchema = z
  .object({
    period: periodPresetSchema,
  })
  .openapi('UsersOverviewQuery')

export type UsersOverviewQuery = z.infer<typeof usersOverviewQuerySchema>

const seriesIntervalSchema = z
  .enum(['1h', '1d'])
  .describe('Bucket size for the rollup. 1h for 24h period; 1d for 7d/30d periods.')

const seriesPointSchema = z
  .object({
    timestamp: z
      .string()
      .datetime()
      .describe(
        'ISO 8601 UTC timestamp at the start of the bucket. For 1h buckets, the minute and second components are zeroed; for 1d buckets, the time component is zeroed (start of day in UTC).'
      ),
    signups: z
      .number()
      .int()
      .nonnegative()
      .describe('Total users whose created_at falls within this bucket.'),
    sessions_started: z
      .number()
      .int()
      .nonnegative()
      .describe(
        'Total sessions whose created_at falls within this bucket. May exceed `signups` because returning users open sessions without signing up.'
      ),
  })
  .openapi('UsersOverviewSeriesPoint')

const byRoleSchema = z
  .object({
    admin: z.number().int().nonnegative().describe('Users holding the `admin` role.'),
    operator: z.number().int().nonnegative().describe('Users holding the `operator` role.'),
    auditor: z.number().int().nonnegative().describe('Users holding the `auditor` role.'),
    member: z.number().int().nonnegative().describe('Users holding the `member` role.'),
  })
  .describe('Per-role count breakdown. The sum across all four roles equals `totals.users`.')

export const usersOverviewResponseSchema = z
  .object({
    totals: z
      .object({
        users: z
          .number()
          .int()
          .nonnegative()
          .describe(
            'Total live users in the auth.user table (excluding soft-deleted rows). Equals `by_role.admin + by_role.operator + by_role.auditor + by_role.member` per the single-role-per-user invariant.'
          ),
        active_24h: z
          .number()
          .int()
          .nonnegative()
          .describe(
            'Distinct users with session activity in the last 24 hours, regardless of the requested period.'
          ),
        new_in_period: z
          .number()
          .int()
          .nonnegative()
          .describe(
            'Users created within the requested period (24h / 7d / 30d). Equals the sum of `series.points[].signups` for the same period.'
          ),
        by_role: byRoleSchema,
      })
      .describe('Period-aware aggregate counters surfaced as dashboard tiles.'),
    series: z
      .object({
        interval: seriesIntervalSchema,
        points: z
          .array(seriesPointSchema)
          .describe(
            'Dense, ascending-by-timestamp series of buckets covering the requested period. Empty buckets are present with zero counts.'
          ),
      })
      .describe('Bucketed time series for chart rendering.'),
  })
  .openapi('UsersOverviewResponse')

export type UsersOverviewResponse = z.infer<typeof usersOverviewResponseSchema>
export type UsersOverviewSeriesPoint = z.infer<typeof seriesPointSchema>
