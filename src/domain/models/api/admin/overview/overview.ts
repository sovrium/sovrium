/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { z } from '@hono/zod-openapi'

export const overviewRecordsSchema = z
  .object({
    total: z
      .number()
      .int()
      .nonnegative()
      .describe(
        'Live record count across every configured table. Equals tables-overview `totals.total_rows` (soft-deleted rows excluded). `0` when no tables are configured.'
      ),
  })
  .openapi('AdminOverviewRecords')

export const overviewSubmissionsSchema = z
  .object({
    total: z
      .number()
      .int()
      .nonnegative()
      .describe(
        'Lifetime submission count across every configured form (sum of per-form `submissionCount`, non-deleted rows). `0` when no forms exist or none have submissions.'
      ),
  })
  .openapi('AdminOverviewSubmissions')

export const overviewRunsSchema = z
  .object({
    recent: z
      .number()
      .int()
      .nonnegative()
      .describe(
        'Automation runs in the last 24h. Sourced from automations-overview `totals.runs_24h`. `0` when no automations have run.'
      ),
    successRate: z
      .number()
      .min(0)
      .max(1)
      .describe(
        'Fraction of the last-24h runs that succeeded (0–1). Sourced from automations-overview `totals.success_rate`. `1` when there were zero runs (healthy by default).'
      ),
  })
  .openapi('AdminOverviewRuns')

export const overviewUsersSchema = z
  .object({
    total: z
      .number()
      .int()
      .nonnegative()
      .describe(
        'Live user count (excluding soft-deleted rows). Equals users-overview `totals.users`. `0` when auth is disabled or there are no users.'
      ),
  })
  .openapi('AdminOverviewUsers')

export const overviewStorageSchema = z
  .object({
    totalBytes: z
      .number()
      .int()
      .nonnegative()
      .describe(
        'Total stored bytes across every live bucket. Equals buckets-overview `totals.totalBytes`. `0` when storage is disabled or no files are stored.'
      ),
  })
  .openapi('AdminOverviewStorage')

export const overviewConnectionsSchema = z
  .object({
    total: z
      .number()
      .int()
      .nonnegative()
      .describe(
        'Number of configured connections (one per `system.connections` row). Equals the connections-list length. `0` when no connections are configured.'
      ),
    healthy: z
      .number()
      .int()
      .nonnegative()
      .describe(
        'Subset of `total` whose derived status is `active` (absent or comfortably-future expiry) — excludes `expiring-soon` and `expired`. Always `<= total`.'
      ),
  })
  .openapi('AdminOverviewConnections')

export const adminOverviewResponseSchema = z
  .object({
    records: overviewRecordsSchema,
    submissions: overviewSubmissionsSchema,
    runs: overviewRunsSchema,
    users: overviewUsersSchema,
    storage: overviewStorageSchema,
    connections: overviewConnectionsSchema,
  })
  .openapi('AdminOverviewResponse')

export type AdminOverviewResponse = z.infer<typeof adminOverviewResponseSchema>
export type AdminOverviewRecords = z.infer<typeof overviewRecordsSchema>
export type AdminOverviewSubmissions = z.infer<typeof overviewSubmissionsSchema>
export type AdminOverviewRuns = z.infer<typeof overviewRunsSchema>
export type AdminOverviewUsers = z.infer<typeof overviewUsersSchema>
export type AdminOverviewStorage = z.infer<typeof overviewStorageSchema>
export type AdminOverviewConnections = z.infer<typeof overviewConnectionsSchema>
