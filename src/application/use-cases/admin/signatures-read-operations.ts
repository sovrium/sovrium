/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The signing-request admin read, as a registry entry: the list the console's
 * Signatures page shows. Its route, its MCP admin tool and its OpenAPI
 * operation are derived from this one entry.
 *
 * Read-only and thin. A row names the flow, the record, the status and each
 * signer by her display name and status; the detail of one request, its
 * evidence log and its export stay on the routes that already serve them.
 * Nothing here reads an address, a link token or its digest, a code digest, a
 * salt or the document's fingerprint: the store's list read never selects
 * them, and the wire schema could not carry them.
 *
 * The list holds what the request page opens for its reader, and nothing
 * else: a request is listed only when its table is still declared, the table's
 * read admits the caller's role and groups (`tableReadAdmits`, the predicate
 * `read-signature-request.ts` applies), and its record is still there and
 * readable for her: a soft-deleted record is gone, and a table's row-level
 * `read.when` rule is applied to her as the records route applies it
 * (`readableRows`). The record check is one read per table over the listed
 * ids, never one per row, and it runs BEFORE the search, so a term never
 * matches a request she could not open.
 *
 * Audit: none, like the other catalog lists of the console.
 */

import { Effect } from 'effect'
import { SignatureRequestRepository } from '@/application/ports/repositories/signatures/signature-request-repository'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import {
  answerWithSchema,
  decodeAdminReadQuery,
  defineAdminRead,
} from '@/application/use-cases/admin/admin-read-operation'
import { readableRows } from '@/application/use-cases/tables/linked-row-visibility'
import { synthesizeCallerSession } from '@/application/use-cases/tables/list-records-as-caller'
import { tableReadAdmits } from '@/application/use-cases/tables/table-operations'
import { getUserGroups } from '@/application/use-cases/tables/user-groups'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import {
  adminSignatureRequestsQuerySchema,
  adminSignatureRequestsResponseSchema,
  type AdminSignatureRequestRow,
  type AdminSignatureRequestsQuery,
} from '@/domain/models/api/admin/signatures/signatures'
import { requestStatusOf } from '@/domain/models/app/signatures/signature-request-service'
import {
  matchesSearchTerm,
  requestEndedAt,
  requestRecordLabel,
  signersSummary,
} from '@/domain/models/app/signatures/signature-request-summary-service'
import type {
  AuthDatabaseError,
  AuthRepository,
} from '@/application/ports/repositories/auth/auth-repository'
import type { SignatureRequestWithSigners } from '@/application/ports/repositories/signatures/signature-request-repository'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type { TableReadError } from '@/application/ports/repositories/tables/table-repository'
import type { AdminReadOperation } from '@/application/use-cases/admin/admin-read-operation'
import type { App, Table } from '@/domain/models/app'

/**
 * How many requests the list reads, newest first. The console pages the list
 * itself, so the read is bounded rather than cursored; an instance past it
 * still sees its newest requests, and the search narrows within them.
 */
const SIGNATURE_LIST_LIMIT = 500

/** One request as one row of the list. */
const rowOf = (request: SignatureRequestWithSigners): AdminSignatureRequestRow => {
  const endedAt = requestEndedAt(request)
  return {
    ...{ id: request.id, flow: request.flowName, table: request.tableName },
    ...{ recordId: request.recordId, record: requestRecordLabel(request) },
    status: requestStatusOf(request.status),
    signers: signersSummary(request.signers),
    sentAt: request.createdAt,
    ...(endedAt === undefined ? {} : { endedAt }),
    ...(endedAt === undefined || request.keepUntil === undefined
      ? {}
      : { keepUntil: request.keepUntil }),
  }
}

/** The session the record reads run under: the caller's own id. */
const readerSession = (userId: string) =>
  synthesizeCallerSession(userId, { id: 'admin-signatures-list', token: 'admin-signatures-list' })

/** Who reads the records: the caller, by her id, role and groups. */
interface ListReader {
  readonly userId: string
  readonly role: string
  readonly groups: readonly string[]
}

/**
 * The ids among `recordIds` the caller may open in `table`: one read over all
 * of them, soft-deleted rows excluded, as `getRecord` reads one, and the
 * table's row-level `read.when` rule applied to her (`readableRows`, which an
 * admin-equivalent role and a table with no rule pass through).
 */
const readableRecordIds = (
  app: App,
  table: Table,
  recordIds: readonly string[],
  reader: ListReader
): Effect.Effect<
  ReadonlySet<string>,
  TableReadError,
  TableRepository | DataSourceRepository | AuthRepository
> =>
  Effect.gen(function* () {
    const session = readerSession(reader.userId)
    const byRule = yield* readableRows(app, table, recordIds, { ...reader, session })
    if (byRule !== undefined) return new Set(byRule.keys())
    const rows = yield* (yield* TableRepository).listRecords({
      session,
      tableName: table.name,
      filter: { and: [{ field: 'id', operator: 'in', value: recordIds }] },
      columns: ['id'],
    })
    return new Set(rows.map((row) => String(row['id'])))
  })

/**
 * The requests among `requests` whose page `actorUserId` may open: a declared
 * table her role and groups may read, and a record still there that the
 * table's row-level read rule admits for her. Order kept.
 */
export const requestsTheReaderMayOpen = (
  app: App,
  requests: readonly SignatureRequestWithSigners[],
  actorUserId: string
): Effect.Effect<
  readonly SignatureRequestWithSigners[],
  AuthDatabaseError | TableReadError,
  AuthRepository | TableRepository | DataSourceRepository
> =>
  Effect.gen(function* () {
    const role = yield* getUserRole(actorUserId, app)
    const groups = yield* getUserGroups(actorUserId)
    const reader: ListReader = { userId: actorUserId, role, groups }
    const admittedTables = (app.tables ?? []).filter((table) =>
      tableReadAdmits(app, table, { role, groups })
    )
    const listed = admittedTables.filter((table) =>
      requests.some((request) => request.tableName === table.name)
    )
    const readable = yield* Effect.forEach(listed, (table) =>
      readableRecordIds(
        app,
        table,
        [
          ...new Set(
            requests
              .filter((request) => request.tableName === table.name)
              .map((request) => request.recordId)
          ),
        ],
        reader
      ).pipe(Effect.map((ids) => [table.name, ids] as const))
    )
    const readableByTable = new Map(readable)
    return requests.filter(
      (request) => readableByTable.get(request.tableName)?.has(request.recordId) === true
    )
  }).pipe(Effect.withSpan('admin.signatures.requests-the-reader-may-open'))

/** What `q` searches: the flow, the record and each signer's name. */
const searchedTexts = (request: SignatureRequestWithSigners): readonly string[] => [
  request.flowName,
  requestRecordLabel(request),
  ...request.signers.map((signer) => signer.displayName ?? signer.name),
]

const signatureRequestsList = defineAdminRead<AdminSignatureRequestsQuery>({
  id: 'signatures.list',
  method: 'get',
  path: '/api/admin/signatures',
  pathParams: [],
  queryParams: ['q'],
  tool: {
    suffix: 'signature_requests_list',
    description:
      "List the signing requests the caller may open, newest first (those whose table her role may read and whose record is still there and readable for her), each with its flow, record, status and each signer's name and status, as GET /api/admin/signatures answers them (admin-only, read-only; never an address, a token or a code).",
    inputSchema: {
      type: 'object',
      properties: {
        q: {
          type: 'string',
          description: "Free-text narrowing over the flow, the record and the signers' names.",
        },
      },
    },
  },
  openapi: {
    summary: 'List signing requests',
    description:
      'The signing requests the caller may open, newest first: those whose table her role and ' +
      'groups may read and whose record is still there and readable for her (row-level rules ' +
      'included), as the request page judges them. One ' +
      'row per request: its flow, the ' +
      "record it is for, its status, each signer's display name and status, when it was sent, " +
      'when it ended and until when its evidence is kept. `q` narrows over the flow, the record ' +
      "and the signers' names. Never carries an address, a link token, a code or a salt. Admin only.",
    operationIdBase: 'getAdminSignatureRequests',
    querySchema: adminSignatureRequestsQuerySchema,
    responseSchema: adminSignatureRequestsResponseSchema,
    responseDescription: 'The signing requests',
  },
  subject: 'signature requests',
  decode: (raw) => decodeAdminReadQuery(adminSignatureRequestsQuerySchema, raw),
  read: (app, query, request) =>
    Effect.gen(function* () {
      const recent = yield* (yield* SignatureRequestRepository).recent(SIGNATURE_LIST_LIMIT)
      const requests = yield* requestsTheReaderMayOpen(app, recent, request.actorUserId)
      const rows = requests.filter((request) => matchesSearchTerm(searchedTexts(request), query.q))
      return answerWithSchema(adminSignatureRequestsResponseSchema, {
        requests: rows.map(rowOf),
        query: query.q ?? null,
      })
    }),
})

/** The list of signing requests. */
export const SIGNATURES_READ_OPERATIONS: ReadonlyArray<AdminReadOperation> = [signatureRequestsList]
