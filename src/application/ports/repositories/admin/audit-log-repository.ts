/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The admin audit log, as the use-cases that write and read it see it.
 *
 * Every method is TOTAL: the store absorbs its own failures (a missing table
 * on a boot path, a transient driver error) and answers with the empty value,
 * logging the cause. An audit write must never fail the request whose action
 * already succeeded, and a read endpoint must answer rather than 500 when the
 * table is not there yet.
 */

import { Context, type Effect } from 'effect'
import type { AuditLogEntry } from '@/domain/models/api/admin/audit-log/entry'

export interface AuditListFilter {
  readonly actorId?: string | undefined
  readonly action?: string | undefined
  /**
   * Transport ("canal") filter — narrows the feed to entries made through one
   * modality (`config-file | env | api | mcp | restore`). Backs the
   * `GET /api/admin/audit-log?transport=` filter.
   */
  readonly transport?: string | undefined
  /**
   * Resource-type filter — narrows the feed to entries touching one kind of
   * resource (`config`, `form`, `form.submission`, `table.record`, …). Backs
   * the `GET /api/admin/audit-log?resourceType=` filter.
   *
   * Matched EXACTLY, never by prefix: several catalog resource types are
   * dotted compounds sharing a parent's prefix (`form` vs `form.submission`,
   * `automation` vs `automation.run`), so a prefix match would silently
   * over-return the children when the parent is requested.
   *
   * The value set is OPEN — every new `ACTION_CATALOG` row may introduce a
   * resource type — so an unrecognised value is a predicate that matches
   * nothing (200 with an empty item set), not a client error.
   */
  readonly resourceType?: string | undefined
  /**
   * Resource-id filter — narrows the feed to entries about ONE resource (an
   * automation's name, a user's id). Matched exactly. Used with `action` to
   * find, say, the latest `automation.resumed` of one automation.
   */
  readonly resourceId?: string | undefined
  /** Entries at or after this instant only. */
  readonly since?: Readonly<Date> | undefined
  /** Entries whose severity is one of these. An empty list matches nothing. */
  readonly severities?: readonly string[] | undefined
  /** Entries whose action is one of these. An empty list matches nothing. */
  readonly actions?: readonly string[] | undefined
}

/** One action's count over a window, most frequent first. */
export interface AuditActionCount {
  readonly action: string
  readonly count: number
}

export class AuditLogRepository extends Context.Service<
  AuditLogRepository,
  {
    /** Persist one entry. */
    readonly append: (entry: Readonly<AuditLogEntry>) => Effect.Effect<void>
    /** Entries matching the filter, newest first. */
    readonly list: (filter?: AuditListFilter) => Effect.Effect<readonly AuditLogEntry[]>
    /** Per-action counts inside a half-open window, capped at `limit`. */
    readonly countByAction: (input: {
      readonly since: Readonly<Date>
      readonly until: Readonly<Date>
      readonly severities: readonly string[]
      readonly limit: number
    }) => Effect.Effect<readonly AuditActionCount[]>
  }
>()('AuditLogRepository') {}
