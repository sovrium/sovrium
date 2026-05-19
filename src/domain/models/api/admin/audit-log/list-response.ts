/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { cursorPaginationResponseSchema } from '@/domain/models/api/_shared/cursor-pagination'
import { auditLogEntrySchema, type AuditLogEntry } from './audit-log-entry'

export const listAuditLogResponseSchema =
  cursorPaginationResponseSchema(auditLogEntrySchema).openapi('ListAuditLogResponse')

export type ListAuditLogResponse = {
  readonly items: ReadonlyArray<AuditLogEntry>
  readonly nextCursor: string | null
}
