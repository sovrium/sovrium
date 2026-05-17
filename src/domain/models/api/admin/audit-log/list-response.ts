/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { cursorPaginationResponseSchema } from '@/domain/models/api/_shared/cursor-pagination'
import { auditLogEntrySchema, type AuditLogEntry } from './audit-log-entry'

/**
 * Response shape for `GET /api/admin/audit-log`.
 *
 * Wraps the canonical entry schema in the cursor-pagination envelope:
 *
 * ```jsonc
 * {
 *   "items": [ AuditLogEntry, ... ],
 *   "nextCursor": "eyJ0Ijo...=" // or null when stream is exhausted
 * }
 * ```
 *
 * AI body fields (`prompt`, `response`) are always redacted in this envelope
 * regardless of `AI_AUDIT_CAPTURE_BODIES_ALLOWED`. Operators wishing to
 * inspect bodies must call `GET /api/admin/audit-log/:id?reveal=true` from an
 * admin role; that call emits an `audit.body.revealed` audit event.
 */
export const listAuditLogResponseSchema =
  cursorPaginationResponseSchema(auditLogEntrySchema).openapi('ListAuditLogResponse')

/** @public */
export type ListAuditLogResponse = {
  readonly items: ReadonlyArray<AuditLogEntry>
  readonly nextCursor: string | null
}
