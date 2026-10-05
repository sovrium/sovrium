/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { UserMetadata } from '@/application/ports/contracts/user-metadata'
import type { QueryFilterNode } from '@/application/ports/repositories/tables/table-repository'
import type { Effect } from 'effect'

/**
 * Activity Log record type (port-level definition)
 *
 * Structurally compatible with the Drizzle schema inference.
 * Defined here to avoid application→infrastructure dependency.
 */
export interface ActivityLog {
  readonly id: string
  readonly createdAt: Date
  readonly userId: string | null
  readonly sessionId: string | null
  readonly action: 'create' | 'update' | 'delete' | 'restore' | 'permanent_delete'
  readonly tableName: string
  readonly tableId: string | null
  readonly recordId: string
  readonly changes: {
    readonly before?: Record<string, unknown>
    readonly after?: Record<string, unknown>
  } | null
  readonly ipAddress: string | null
  readonly userAgent: string | null
  readonly user?: UserMetadata | null | undefined
}

/**
 * Database error for activity log operations
 */
export class ActivityLogDatabaseError extends Data.TaggedError('ActivityLogDatabaseError')<{
  readonly cause: unknown
}> {}

/**
 * Which entries of ONE table a reader is admitted to, decided once per request:
 *
 * - `all` — every entry of the table (no row-level read rule narrows her);
 * - `rule` — the entries whose record, as it stands now, passes `rule`: the
 *   table's row-level read rule projected for this reader, judged by the
 *   database in the same statement that selects the entries;
 * - `listed` — the entries whose record id is one of `recordIds`, judged
 *   beforehand (a rule the database cannot judge exactly as a single-record
 *   read does).
 *
 * A table absent from the list admits nothing.
 */
export type ActivityTableAdmission =
  | { readonly tableName: string; readonly rows: 'all' }
  | { readonly tableName: string; readonly rows: 'rule'; readonly rule: QueryFilterNode }
  | {
      readonly tableName: string
      readonly rows: 'listed'
      readonly recordIds: readonly string[]
    }

/** The query-string filters of the activity list. */
export interface ActivityLogFilters {
  readonly tableName?: string
  readonly action?: ActivityLog['action']
  readonly userId?: string
  readonly since?: Date
}

/** One page of the activity list, and how many admitted entries match in all. */
export interface ActivityLogPageQuery {
  /** `everything` for an admin, else the tables (and rows) the reader is admitted to. */
  readonly admission: 'everything' | readonly ActivityTableAdmission[]
  readonly filters: ActivityLogFilters
  readonly offset: number
  readonly limit: number
}

/** A page of entries, plus the count of every admitted entry the filters match. */
export interface ActivityLogPage {
  readonly rows: readonly ActivityLog[]
  readonly total: number
}

/**
 * The live (not soft-deleted) records of one table a gate judges: those named
 * by `recordIds`, or — `'logged'` — those the activity log names for the
 * table, optionally narrowed by a row-level `rule`.
 */
export interface LiveRecordsQuery {
  readonly tableName: string
  readonly recordIds: readonly string[] | 'logged'
  readonly rule?: QueryFilterNode
}

/**
 * Activity Log Repository Port
 *
 * Provides type-safe database operations for activity logs.
 * Implementation lives in infrastructure layer (activity-log-repository-live.ts).
 */
export class ActivityLogRepository extends Context.Service<
  ActivityLogRepository,
  {
    /** One page of the activity of the last year, admitted and filtered in the database. */
    readonly listPage: (
      query: ActivityLogPageQuery
    ) => Effect.Effect<ActivityLogPage, ActivityLogDatabaseError>
    /** The raw live rows a gate judges, in one statement. */
    readonly liveRecords: (
      query: LiveRecordsQuery
    ) => Effect.Effect<readonly Readonly<Record<string, unknown>>[], ActivityLogDatabaseError>
    readonly create: (log: {
      readonly userId: string
      readonly action: 'create' | 'update' | 'delete' | 'restore' | 'permanent_delete'
      readonly tableName: string
      readonly tableId: string
      readonly recordId: string
      readonly changes: {
        readonly before?: Record<string, unknown>
        readonly after?: Record<string, unknown>
      }
      readonly sessionId?: string
      readonly ipAddress?: string
      readonly userAgent?: string
    }) => Effect.Effect<ActivityLog, ActivityLogDatabaseError>
  }
>()('ActivityLogRepository') {}
