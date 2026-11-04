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
  type AdminReadRequest,
} from '@/application/use-cases/admin/admin-read-operation'
import { auditLogCsv } from '@/application/use-cases/admin/audit-log-export'
import { resolveDateWindow } from '@/application/use-cases/admin/automations-runs-query'
import {
  AUDIT_FACET_LIMIT,
  auditLogEntrySchema,
  auditLogFacetsResponseSchema,
  auditLogListResponseSchema,
  auditLogQuerySchema,
} from '@/domain/models/api/admin/audit-log'
import { parseSovriumTimezone } from '@/domain/models/process-env/timezone'

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
  q: auditLogQuerySchema.fields.q,
  from: auditLogQuerySchema.fields.from,
  to: auditLogQuerySchema.fields.to,
  reads: auditLogQuerySchema.fields.reads,
  format: auditLogQuerySchema.fields.format,
})

/**
 * What the list read answers: one page of the trail, or, for `format=csv`,
 * every entry the filters select, as a download.
 */
type AuditLogRead =
  | ({ readonly format: 'page' } & AuditPageQuery)
  | { readonly format: 'csv'; readonly filter: AuditListFilter }

/**
 * The search term and the period as filter fields. The period follows the run
 * history exactly: a calendar day counts in the operator timezone and a `to`
 * day is included; a date-time `to` is exclusive. `undefined` when the period
 * ends before it starts.
 */
const narrowingOf = (
  params: {
    readonly q?: string | undefined
    readonly from?: string | undefined
    readonly to?: string | undefined
    readonly reads?: 'true' | 'false' | undefined
  },
  operatorTimezone: string
): Pick<AuditListFilter, 'q' | 'since' | 'until' | 'withoutReads'> | undefined => {
  const window = resolveDateWindow(params.from, params.to, operatorTimezone)
  if (window === undefined) return undefined
  return {
    ...(params.q === undefined ? {} : { q: params.q }),
    // Only `false` narrows: `true` and absence both keep the reads, so a caller
    // that never sends the parameter reads the trail it always read.
    ...(params.reads === 'false' ? { withoutReads: true } : {}),
    ...(window.from === undefined ? {} : { since: new Date(window.from) }),
    ...(window.to === undefined ? {} : { until: new Date(window.to) }),
  }
}

/** The raw page parameters, without the page size and cursor an export does not read. */
const pageParamsOf = (raw: Readonly<Record<string, unknown>>, csv: boolean) => ({
  ...(csv ? {} : { cursor: filterValue(raw['cursor']), limit: filterValue(raw['limit']) }),
  q: typeof raw['q'] === 'string' ? raw['q'] : undefined,
  from: filterValue(raw['from']),
  to: filterValue(raw['to']),
  reads: filterValue(raw['reads']),
  format: filterValue(raw['format']),
})

/**
 * The filters, the page size and the cursor; a malformed size, cursor or period
 * is refused. A calendar-day period is read in `operatorTimezone`. A CSV export
 * reads every entry the filters select, so its `cursor` and `limit` are not
 * read at all: an export carrying a page's leftovers still answers.
 */
const decodeAuditLogPage = (
  raw: Readonly<Record<string, unknown>>,
  operatorTimezone: string
): AdminReadDecode<AuditLogRead> => {
  const refused = { _tag: 'InvalidInput', reason: 'malformed' } as const
  const csv = raw['format'] === 'csv'
  const params = Schema.decodeUnknownOption(pageParamsSchema)(pageParamsOf(raw, csv))
  if (Option.isNone(params)) return refused
  const { cursor, limit } = params.value
  const after = cursor === undefined ? undefined : decodeCursor(cursor)
  const narrowing = narrowingOf(params.value, operatorTimezone)
  if ((cursor !== undefined && after === undefined) || narrowing === undefined) return refused
  const filter = { ...decodeAuditLogFilter(raw), ...narrowing }
  if (csv) return { _tag: 'Ok', input: { format: 'csv', filter } }
  return {
    _tag: 'Ok',
    input: { format: 'page', filter, limit, ...(after === undefined ? {} : { after }) },
  }
}

const auditLogList = defineAdminRead<AuditLogRead>({
  id: 'audit-log.list',
  method: 'get',
  path: '/api/admin/audit-log',
  pathParams: [],
  queryParams: [
    'actorId',
    'action',
    'resourceType',
    'transport',
    'q',
    'from',
    'to',
    'reads',
    'format',
    'cursor',
    'limit',
  ],
  tool: {
    suffix: 'audit_log_list',
    description:
      'Read the admin audit trail newest first, filtered by actor, action, transport, resource type, period or a search term, with or without the reads, and paged by cursor, as GET /api/admin/audit-log answers it (admin-only, read-only; reading it records nothing).',
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
        q: {
          type: 'string',
          description: 'Search over the actor email, the action and the resource id.',
        },
        from: {
          type: 'string',
          description: 'Start of the period: a calendar day or an ISO 8601 date-time.',
        },
        to: {
          type: 'string',
          description:
            'End of the period: a calendar day (included) or an ISO 8601 date-time (excluded).',
        },
        reads: {
          type: 'string',
          enum: ['true', 'false'],
          description:
            'Leave out the reads (false): the entries whose action ends in .queried or .read, which record someone looking and nothing changing. true or absent keeps them.',
        },
        format: {
          type: 'string',
          enum: ['csv'],
          description:
            'csv answers every entry the filters select as CSV text instead of one page; cursor and limit do not apply.',
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
      'and resource type (all exact), a period (`from` / `to`) and a search term `q`, all ' +
      'combined conjunctively. `reads=false` leaves out the reads (an action ending in `.queried` ' +
      'or `.read`); `reads=true` or no `reads` keeps them, and any other value is refused with 400. ' +
      'An unrecognised filter value matches nothing and answers an empty page; ' +
      'a period that ends before it starts is refused with 400. `limit` caps a page (default 50, at most 200) and ' +
      '`nextCursor` reads the entries after it, `null` on the last page; a malformed `limit` ' +
      'or `cursor` is refused with 400. Reading the trail writes no audit event. ' +
      '`format=csv` answers every selected entry as a `text/csv` download instead, newest first, ' +
      'with no `cursor` or `limit` applied; that download is recorded as a read. Admin only.',
    operationIdBase: 'listAdminAuditLog',
    querySchema: auditLogQuerySchema,
    responseSchema: auditLogListResponseSchema,
    responseDescription: 'The matching audit entries',
  },
  subject: 'audit-log response',
  decode: (raw, _app, env) => decodeAuditLogPage(raw, parseSovriumTimezone(env).zoneId),
  // No admin audit event for a page: reading the trail must not grow it. The
  // CSV export, a copy that leaves the console, records itself.
  // The page is read in the database, one page of rows at a time; the cursor
  // is the last entry's instant and id, the same keys the order is read by.
  read: Effect.fn('admin.audit-log.page')(function* (
    _app: unknown,
    query: AuditLogRead,
    request: AdminReadRequest
  ) {
    if (query.format === 'csv') return yield* auditLogCsv(query.filter, request)
    const page = yield* (yield* AuditLogRepository).listPage(query)
    const last = page.entries.at(-1)
    return answerWithSchema(auditLogListResponseSchema, {
      items: [...page.entries],
      nextCursor: page.hasMore && last !== undefined ? encodeCursor(last) : null,
      // Present on EVERY page, `null` without a term: its presence tells the
      // console grid the search already ran on the server.
      appliedQuery: query.filter.q ?? null,
    })
  }),
})

const auditLogFacets = defineAdminRead<undefined>({
  id: 'audit-log.facets',
  method: 'get',
  path: '/api/admin/audit-log/facets',
  pathParams: [],
  queryParams: [],
  tool: {
    suffix: 'audit_log_facets',
    description:
      'The actors and the actions the admin audit trail holds, each with how many entries carry it, most first, as GET /api/admin/audit-log/facets answers them (admin-only, read-only; reading it records nothing).',
    inputSchema: { type: 'object', properties: {} },
  },
  openapi: {
    summary: 'Read the audit log facets',
    description:
      'The actors (by `actor.id`, labelled by email) and the actions the trail holds, each ' +
      `with its entry count, most entries first, at most ${AUDIT_FACET_LIMIT} of each: the ` +
      'values the list filters on. Reading it writes no audit event. Admin only.',
    operationIdBase: 'getAdminAuditLogFacets',
    responseSchema: auditLogFacetsResponseSchema,
    responseDescription: 'The actors and actions of the trail',
  },
  subject: 'audit-log facets',
  decode: () => ({ _tag: 'Ok', input: undefined }),
  // No admin audit event: reading the trail must not grow it.
  read: () =>
    Effect.map(
      AuditLogRepository.use((repository) => repository.facets(AUDIT_FACET_LIMIT)),
      (facets) => answerWithSchema(auditLogFacetsResponseSchema, facets)
    ).pipe(Effect.withSpan('admin.audit-log.facets')),
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
  // Before the one-entry read, so `/facets` is not captured as an entry id.
  auditLogFacets,
  auditLogEntry,
]
