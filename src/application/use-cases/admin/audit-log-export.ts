/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The audit log as a CSV download (`GET /api/admin/audit-log?format=csv`):
 * every entry the list's filters select, newest first, never cut to a page.
 * The list read (`audit-log-read-operations.ts`) decodes the request and hands
 * the filter here.
 */

import { DateTime, Effect } from 'effect'
import {
  AuditLogRepository,
  type AuditListFilter,
} from '@/application/ports/repositories/admin/audit-log-repository'
import { AdminReadHost } from '@/application/ports/services/admin-read-host'
import {
  adminReadText,
  type AdminReadOutcome,
  type AdminReadRequest,
} from '@/application/use-cases/admin/admin-read-operation'
import { emitAuditEvent } from '@/application/use-cases/admin/audit-log-emit'
import { resolveActor } from '@/application/use-cases/admin/resolve-actor'
import { buildCsvAttachmentDisposition } from '@/domain/kernel/url/csv-attachment'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'

/** The CSV export's columns, in order: what the list shows, never the metadata. */
const AUDIT_CSV_COLUMNS = [
  'time',
  'actor',
  'action',
  'resource type',
  'resource id',
  'result',
  'transport',
] as const

/**
 * Every entry the filters select, newest first, as a CSV download. The file is
 * written before the export records itself, so the download never lists its
 * own read; that read then shows in the trail like any other.
 */
export const auditLogCsv = Effect.fn('admin.audit-log.export')(function* (
  filter: AuditListFilter,
  request: AdminReadRequest
) {
  const entries = yield* (yield* AuditLogRepository).list(filter)
  const host = yield* AdminReadHost
  const csv = host.encodeCsv(
    entries.map((entry) => ({
      time: entry.timestamp,
      actor: entry.actor.email ?? '',
      action: entry.action,
      'resource type': entry.resource.type,
      'resource id': entry.resource.id,
      result: entry.result,
      transport: entry.transport,
    })),
    AUDIT_CSV_COLUMNS
  )
  yield* emitAuditEvent({
    action: AUDIT_ACTIONS.AUDIT_EXPORT_QUERIED,
    actor: yield* resolveActor(request.actorUserId),
    resourceId: 'audit-log',
    severity: 'info',
    result: 'success',
    transport: request.transport,
  })
  const takenAt = DateTime.toDateUtc(yield* DateTime.now)
  return {
    _tag: 'Ok',
    body: adminReadText('text/csv; charset=utf-8', csv, {
      'Content-Disposition': buildCsvAttachmentDisposition('audit-log', takenAt),
    }),
  } satisfies AdminReadOutcome
})
