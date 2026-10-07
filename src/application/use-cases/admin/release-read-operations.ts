/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The release admin reads, as registry entries: the boot ledger — every start
 * whose app version or config hash changed, and one boot's diff against the
 * one before it — and the decision register the app declares beside its
 * configuration ([internal ref] A6).
 *
 * Each entry is the whole of one read: the admin route, the MCP admin tool and
 * the OpenAPI operation are all derived from it. Every row describes something
 * that has already happened; nothing here creates, edits or reverts one.
 *
 * Audit: none of the three writes an admin audit event, exactly as their
 * routes never have.
 */

import { Effect, Schema } from 'effect'
import {
  answerWithSchema,
  defineAdminRead,
  type AdminReadDecode,
  type AdminReadOperation,
} from '@/application/use-cases/admin/admin-read-operation'
import { listBootLedger, readBootLedgerEntry } from '@/application/use-cases/admin/boot-ledger'
import { readDecisionRegister } from '@/application/use-cases/admin/decisions-register'
import { decisionsCatalogResponseSchema } from '@/domain/models/api/admin/decisions/catalog'
import {
  releaseDetailResponseSchema,
  releasesListResponseSchema,
} from '@/domain/models/api/admin/releases/ledger'

const NO_ARGUMENTS = { type: 'object', properties: {} } as const

/** A read that takes no parameter. */
const noInput = (): AdminReadDecode<undefined> => ({ _tag: 'Ok', input: undefined })

// ─── The boot ledger ──────────────────────────────────────────────────────────

const releasesList = defineAdminRead<undefined>({
  id: 'config.releases.list',
  method: 'get',
  path: '/api/admin/releases',
  pathParams: [],
  queryParams: [],
  tool: {
    suffix: 'releases_list',
    description:
      'Every retained boot of this instance, newest first, with flat totals, as GET /api/admin/releases answers it (admin-only, read-only).',
    inputSchema: NO_ARGUMENTS,
  },
  openapi: {
    summary: 'List the boot ledger',
    description:
      'Every retained start whose app version or config hash changed, newest first, with ' +
      'flat totals beside it. An emptied ledger answers 200 with an empty list. Admin only.',
    operationIdBase: 'listAdminReleases',
    responseSchema: releasesListResponseSchema,
    responseDescription: 'The boot ledger',
  },
  subject: 'boot ledger',
  decode: noInput,
  read: (app) =>
    Effect.map(listBootLedger(app.name), (body) =>
      answerWithSchema(releasesListResponseSchema, body)
    ),
})

/** The `:hash` segment: a twelve-hex config hash or a row id. */
const releaseParamsSchema = Schema.Struct({
  hash: Schema.String.annotate({
    description: 'A twelve-hex config hash (the newest boot carrying it) or a boot row id',
  }),
})

const releaseRead = defineAdminRead<string>({
  id: 'config.releases.read',
  method: 'get',
  path: '/api/admin/releases/:hash',
  pathParams: ['hash'],
  queryParams: [],
  tool: {
    suffix: 'release_read',
    description:
      'One boot of this instance by its config hash or its id, with its diff against the boot before it, as GET /api/admin/releases/:hash answers it (admin-only, read-only).',
    inputSchema: {
      type: 'object',
      properties: {
        hash: { type: 'string', description: 'A config hash or a boot id.' },
      },
      required: ['hash'],
    },
  },
  openapi: {
    summary: 'Read one boot',
    description:
      'One boot, its derived DDL and engine migrations, and its diff against the boot ' +
      'before it. A hash resolves to the newest boot carrying it; an id addresses any boot ' +
      'exactly. Anything resolving to neither is 404, never 400, so the shape of an address ' +
      'reveals nothing. Admin only.',
    operationIdBase: 'getAdminRelease',
    paramsSchema: releaseParamsSchema,
    responseSchema: releaseDetailResponseSchema,
    responseDescription: 'The boot and its diff',
  },
  subject: 'boot ledger entry',
  // Nothing validates the address's SHAPE before the lookup: a 400 would tell a
  // prober the shape was right.
  decode: (raw) => ({ _tag: 'Ok', input: typeof raw['hash'] === 'string' ? raw['hash'] : '' }),
  read: (app, address) =>
    Effect.map(readBootLedgerEntry(app.name, address), (entry) =>
      entry === undefined
        ? ({ _tag: 'NotFound' } as const)
        : answerWithSchema(releaseDetailResponseSchema, entry)
    ),
})

const decisionsList = defineAdminRead<undefined>({
  id: 'config.decisions.list',
  method: 'get',
  path: '/api/admin/decisions',
  pathParams: [],
  queryParams: [],
  tool: {
    suffix: 'decisions_list',
    description:
      'Every architecture decision the app declares, with its status and lineage and the tally by status, as GET /api/admin/decisions answers it (admin-only, read-only).',
    inputSchema: NO_ARGUMENTS,
  },
  openapi: {
    summary: 'List the declared decisions',
    description:
      'Every declared decision record, in declared order, with four flat counts. An app ' +
      'declaring no register answers 200 with an empty list and zeroes. Admin only.',
    operationIdBase: 'listAdminDecisions',
    responseSchema: decisionsCatalogResponseSchema,
    responseDescription: 'The decision register',
  },
  subject: 'decisions response',
  decode: noInput,
  read: (app) =>
    Effect.map(readDecisionRegister(app), (body) =>
      answerWithSchema(decisionsCatalogResponseSchema, body)
    ),
})

/** The release admin reads, in the order the registry lists them. */
export const RELEASE_READ_OPERATIONS: ReadonlyArray<AdminReadOperation> = [
  releasesList,
  releaseRead,
  decisionsList,
]
