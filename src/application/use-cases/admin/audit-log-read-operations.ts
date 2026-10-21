/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The admin audit log reads, as registry entries: the trail, one page at a
 * time, and one entry on its own address.
 *
 * Neither writes an admin audit event: reading the trail must not grow it.
 *
 * The trail is read newest first, ties on the instant broken by the entry id,
 * so two reads of the same trail list it in the same order and a cursor names
 * a position in that order rather than an index. The cursor is the last
 * entry's instant and id: the next page is every entry after it, so an entry
 * written between two pages lands ahead of the first one and never repeats or
 * shifts the page being read.
 */

import { Effect, Option, Schema } from 'effect'
import {
  AuditLogRepository,
  type AuditListFilter,
  type AuditPagePosition,
  type AuditPageQuery,
} from '@/application/ports/repositories/admin/audit-log-repository'
import {
  adminReadPathParams,
  answerWithSchema,
  defineAdminRead,
  type AdminReadDecode,
  type AdminReadOperation,
} from '@/application/use-cases/admin/admin-read-operation'
import {
  auditLogEntrySchema,
  auditLogListResponseSchema,
  auditLogQuerySchema,
} from '@/domain/models/api/admin/audit-log'

/** A filter value as the route reads it: a non-empty string, else no filter. */
const filterValue = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined

/**
 * The audit-log filters, read as the route always read them: an unrecognised
 * transport or resource type matches nothing and answers an empty page — an
 * explicit empty state, never a 400. All filters combine conjunctively.
 */
const decodeAuditLogFilter = (raw: Readonly<Record<string, unknown>>): AuditListFilter => {
  const actorId = filterValue(raw['actorId'])
  const action = filterValue(raw['action'])
  const transport = filterValue(raw['transport'])
  const resourceType = filterValue(raw['resourceType'])
  return {
    ...(actorId !== undefined ? { actorId } : {}),
    ...(action !== undefined ? { action } : {}),
    ...(transport !== undefined ? { transport } : {}),
    ...(resourceType !== undefined ? { resourceType } : {}),
  }
}

const cursorSchema = Schema.Struct({ timestamp: Schema.String, id: Schema.String })

/** The opaque cursor naming `entry`: base64url of its instant and id. */
const encodeCursor = (entry: Readonly<AuditPagePosition>): string =>
  Buffer.from(JSON.stringify({ timestamp: entry.timestamp, id: entry.id }), 'utf8').toString(
    'base64url'
  )

/** A cursor this read handed out, or `undefined` for anything else. */
const decodeCursor = (raw: string): AuditPagePosition | undefined => {
  const parsed = Option.liftThrowable(() =>
    JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))
  )()
  const cursor = Option.getOrUndefined(
    Option.flatMap(parsed, Schema.decodeUnknownOption(cursorSchema))
  )
  // The instant is compared in the database, so one that does not read as an
  // instant is refused here rather than failing the read there.
  return cursor !== undefined && Number.isFinite(Date.parse(cursor.timestamp)) ? cursor : undefined
}

const pageParamsSchema = Schema.Struct({
  cursor: auditLogQuerySchema.fields.cursor,
  limit: auditLogQuerySchema.fields.limit,
})

/** The filters, the page size and the cursor; a malformed size or cursor is refused. */
const decodeAuditLogPage = (
  raw: Readonly<Record<string, unknown>>
): AdminReadDecode<AuditPageQuery> => {
  const refused = { _tag: 'InvalidInput', reason: 'malformed' } as const
  const params = Schema.decodeOption(pageParamsSchema)({
    cursor: filterValue(raw['cursor']),
    limit: filterValue(raw['limit']),
  })
  if (Option.isNone(params)) return refused
  const { cursor, limit } = params.value
  const after = cursor === undefined ? undefined : decodeCursor(cursor)
  if (cursor !== undefined && after === undefined) return refused
  return {
    _tag: 'Ok',
    input: { filter: decodeAuditLogFilter(raw), limit, ...(after === undefined ? {} : { after }) },
  }
}

const auditLogList = defineAdminRead<AuditPageQuery>({
  id: 'audit-log.list',
  method: 'get',
  path: '/api/admin/audit-log',
  pathParams: [],
  queryParams: ['actorId', 'action', 'resourceType', 'transport', 'cursor', 'limit'],
  tool: {
    suffix: 'audit_log_list',
    description:
      'Read the admin audit trail newest first, filtered by actor, action, transport or resource type and paged by cursor, as GET /api/admin/audit-log answers it (admin-only, read-only; reading it records nothing).',
    inputSchema: {
      type: 'object',
      properties: {
        actorId: { type: 'string', description: 'Only entries by this user id.' },
        action: { type: 'string', description: 'Only entries of this exact action.' },
        transport: {
          type: 'string',
          description: 'Only entries made through this transport, e.g. api or mcp.',
        },
        resourceType: {
          type: 'string',
          description: 'Only entries on this exact resource type.',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 200,
          description: 'Entries per page (default 50).',
        },
        cursor: {
          type: 'string',
          description: 'The nextCursor of the previous page, to read the entries after it.',
        },
      },
    },
  },
  openapi: {
    summary: 'Read the admin audit log',
    description:
      'The admin audit trail, newest first, optionally filtered by actor, action, transport ' +
      'and resource type (all exact, combined conjunctively). An unrecognised value matches ' +
      'nothing and answers an empty page. `limit` caps a page (default 50, at most 200) and ' +
      '`nextCursor` reads the entries after it, `null` on the last page; a malformed `limit` ' +
      'or `cursor` is refused with 400. Reading the trail writes no audit event. Admin only.',
    operationIdBase: 'listAdminAuditLog',
    querySchema: auditLogQuerySchema,
    responseSchema: auditLogListResponseSchema,
    responseDescription: 'The matching audit entries',
  },
  subject: 'audit-log response',
  decode: decodeAuditLogPage,
  // No admin audit event: reading the trail must not grow it.
  // The page is read in the database, one page of rows at a time; the cursor
  // is the last entry's instant and id, the same keys the order is read by.
  read: Effect.fn('admin.audit-log.page')(function* (_app: unknown, query: AuditPageQuery) {
    const page = yield* (yield* AuditLogRepository).listPage(query)
    const last = page.entries.at(-1)
    return answerWithSchema(auditLogListResponseSchema, {
      items: [...page.entries],
      nextCursor: page.hasMore && last !== undefined ? encodeCursor(last) : null,
    })
  }),
})

const auditLogEntry = defineAdminRead<string>({
  id: 'audit-log.read',
  method: 'get',
  path: '/api/admin/audit-log/:id',
  pathParams: ['id'],
  queryParams: [],
  tool: {
    suffix: 'audit_log_entry_read',
    description:
      'Read one admin audit entry by its id, exactly as GET /api/admin/audit-log lists it, as GET /api/admin/audit-log/:id answers it (admin-only, read-only; reading it records nothing).',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'The audit entry id.' } },
      required: ['id'],
    },
  },
  openapi: {
    summary: 'Read one admin audit entry',
    description:
      'One entry of the admin audit trail, exactly as the trail lists it, details included. ' +
      'An id no entry has is answered 404. Reading it writes no audit event. Admin only.',
    operationIdBase: 'getAdminAuditLogEntry',
    paramsSchema: adminReadPathParams({ id: 'The audit entry id' }),
    responseSchema: auditLogEntrySchema,
    responseDescription: 'The audit entry',
  },
  subject: 'audit-log entry',
  decode: ({ id }) =>
    typeof id === 'string' && id.length > 0 ? { _tag: 'Ok', input: id } : { _tag: 'NotFound' },
  // No admin audit event: reading the trail must not grow it.
  read: (_app, id) =>
    Effect.map(
      AuditLogRepository.use((repository) => repository.get(id)),
      (entry) =>
        Option.match(entry, {
          onNone: () => ({ _tag: 'NotFound' }) as const,
          onSome: (found) => answerWithSchema(auditLogEntrySchema, found),
        })
    ).pipe(Effect.withSpan('admin.audit-log.get')),
})

/** The admin audit log. */
export const AUDIT_LOG_READ_OPERATIONS: ReadonlyArray<AdminReadOperation> = [
  auditLogList,
  auditLogEntry,
]
