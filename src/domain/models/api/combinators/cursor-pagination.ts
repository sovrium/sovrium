/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { coercedNumber } from '@/domain/models/api/combinators/coerce'
import { optionalField } from '@/domain/models/api/combinators/optional-field'
import { withDefault } from './schema-defaults'

/**
 * Cursor pagination convention for high-volume time-series endpoints.
 *
 * Use cursor pagination (instead of offset pagination from `common.ts`) for
 * append-only or unboundedly-growing lists where offset pagination would force
 * full-scan re-counts on every page (audit log, automation runs, webhook
 * deliveries, AI requests, real-time sessions, email logs).
 *
 * The cursor is **opaque base64**: callers must not parse it. Server
 * implementations encode the last seen `{table, id, timestamp}` (or whichever
 * tuple is needed to seek the next page deterministically) into base64 so the
 * cursor format remains an internal contract.
 *
 * @see plan §6.1 (decision rule: cursor for append-only, offset otherwise)
 * @see plan §12 Q-cursor (locked: opaque base64)
 */

/**
 * Cursor pagination query parameters.
 *
 * Both fields are optional in the URL — omitted `cursor` means "first page",
 * omitted `limit` defaults to 50 (max 200). The 200 ceiling matches the
 * canonical audit-log spec and prevents accidental megabyte-sized responses.
 */
export const cursorPaginationQuerySchema = Schema.Struct({
  cursor: optionalField(
    Schema.String.annotate({
      description:
        'Opaque base64 cursor returned in `nextCursor` of the previous response. Omit on first page. Do not parse — format is an internal contract and may change without notice.',
    })
  ),
  limit: coercedNumber
    .annotate({ description: 'Maximum items to return (default 50, max 200)' })
    .pipe(
      Schema.check(
        Schema.isInt(),
        Schema.isGreaterThanOrEqualTo(1),
        Schema.isLessThanOrEqualTo(200)
      ),
      withDefault(50)
    ),
})

/**
 * Cursor pagination response wrapper factory.
 *
 * Returns a Zod object schema with `items: T[]` and `nextCursor: string | null`.
 * `nextCursor === null` signals the end of the stream (no more pages); a
 * non-null value is an opaque base64 token to pass back as `?cursor=...`.
 *
 * @example
 * ```typescript
 * import { auditLogEntrySchema } from '@/domain/models/api/admin/audit-log'
 *
 * export const listAuditLogResponseSchema = cursorPaginationResponseSchema(
 *   auditLogEntrySchema
 * ).annotate({ identifier: 'ListAuditLogResponse' })
 * ```
 */
export const cursorPaginationResponseSchema = <Item extends Schema.Top>(itemSchema: Item) =>
  Schema.Struct({
    items: Schema.Array(itemSchema).annotate({
      description: 'Page of items in descending recency order by default',
    }),
    nextCursor: Schema.NullOr(Schema.String).annotate({
      description:
        'Opaque cursor for the next page; null when the stream is fully consumed. Use as `?cursor=...` on the next request.',
    }),
  })

/**
 * TypeScript types inferred from schemas.
 */
export type CursorPaginationQuery = typeof cursorPaginationQuerySchema.Type
export type CursorPaginationResponse<T> = {
  readonly items: ReadonlyArray<T>
  readonly nextCursor: string | null
}
