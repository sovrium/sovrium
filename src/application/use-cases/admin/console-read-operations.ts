/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The console overview admin reads, as registry entries: the pulse of the
 * instance the console root and its tiles are drawn from.
 *
 * Each entry is the whole of one read: the admin route, the MCP admin tool and
 * the OpenAPI operation are all derived from it. The reads themselves are the
 * existing use-cases — each degrades an unreadable source to its zero rather
 * than failing, so the entries only add the response-validation gate.
 *
 * Audit: the tables overview writes its admin audit event; the five others
 * write none, exactly as their routes always have.
 */

import { Cause, Effect, Option, Schema } from 'effect'
import { AdminReadHost } from '@/application/ports/services/admin-read-host'
import {
  answerWithSchema,
  defineAdminRead,
} from '@/application/use-cases/admin/admin-read-operation'
import { buildAdminAttention } from '@/application/use-cases/admin/attention'
import { buildAdminOverview } from '@/application/use-cases/admin/overview'
import { SearchAdminGlobal } from '@/application/use-cases/admin/search'
import { buildTablesOverview } from '@/application/use-cases/admin/tables-overview'
import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import { footprintOverviewResponseSchema } from '@/domain/models/api/admin/footprint/overview'
import { adminAttentionResponseSchema } from '@/domain/models/api/admin/overview/attention'
import { adminOverviewResponseSchema } from '@/domain/models/api/admin/overview/overview'
import {
  adminSearchQuerySchema,
  adminSearchResponseSchema,
} from '@/domain/models/api/admin/search/search'
import {
  storageStatusResponseSchema,
  type StorageStatusResponse,
} from '@/domain/models/api/admin/storage/status'
import {
  tablesOverviewQuerySchema,
  tablesOverviewResponseSchema,
  type TablesOverviewQuery,
} from '@/domain/models/api/admin/tables/overview'
import { parseStorageEnvConfig } from '@/domain/models/process-env/storage/storage'
import { Logger } from '@/infrastructure/logging/logger'
import type {
  AdminReadDecode,
  AdminReadOperation,
} from '@/application/use-cases/admin/admin-read-operation'

const NO_ARGUMENTS = { type: 'object', properties: {} } as const

/** A read that takes no parameter. */
const noInput = (): AdminReadDecode<undefined> => ({ _tag: 'Ok', input: undefined })

const overview = defineAdminRead<undefined>({
  id: 'console.overview',
  method: 'get',
  path: '/api/admin/overview',
  pathParams: [],
  queryParams: [],
  tool: {
    suffix: 'overview_read',
    description:
      'The cross-domain roll-up of this instance — records, submissions, runs, users, storage and connections — as GET /api/admin/overview answers it (admin-only, read-only).',
    inputSchema: NO_ARGUMENTS,
  },
  openapi: {
    summary: 'Read the cross-domain overview',
    description:
      'A flat roll-up of scalar counts across records, submissions, runs, users, storage ' +
      'and connections. Each domain degrades to its zero block rather than failing the ' +
      'whole. Revalidated by ETag. Admin only.',
    operationIdBase: 'getAdminOverview',
    responseSchema: adminOverviewResponseSchema,
    responseDescription: 'The overview roll-up',
  },
  // Private, revalidated by ETag after the admin guard.
  http: { conditional: {} },
  subject: 'overview',
  decode: noInput,
  read: (app) =>
    Effect.map(buildAdminOverview(app), (body) =>
      answerWithSchema(adminOverviewResponseSchema, body)
    ),
})

const attention = defineAdminRead<undefined>({
  id: 'console.attention',
  method: 'get',
  path: '/api/admin/attention',
  pathParams: [],
  queryParams: [],
  tool: {
    suffix: 'attention_read',
    description:
      'What needs attention on this instance right now — failed runs, unset variables, expired tokens, pending invitations — as GET /api/admin/attention answers it (admin-only, read-only).',
    inputSchema: NO_ARGUMENTS,
  },
  openapi: {
    summary: 'Read what needs attention',
    description:
      'The pulse cells of the console root as count and rendered-detail pairs, plus the ' +
      'per-tile sub-line counts. Every unreadable source degrades to its zero and is named ' +
      'in `degraded`. Admin only.',
    operationIdBase: 'getAdminAttention',
    responseSchema: adminAttentionResponseSchema,
    responseDescription: 'The attention report',
  },
  subject: 'attention',
  decode: noInput,
  read: (app) =>
    Effect.gen(function* () {
      const host = yield* AdminReadHost
      // The boot instant is the one the config version reports as `startedAt`:
      // one value shared by two reads, not two clocks that happen to agree.
      const body = yield* buildAdminAttention(app, host.processStartedAt)
      return answerWithSchema(adminAttentionResponseSchema, body)
    }),
})

const search = defineAdminRead<string>({
  id: 'console.search',
  method: 'get',
  path: '/api/admin/search',
  pathParams: [],
  queryParams: ['q'],
  tool: {
    suffix: 'search',
    description:
      'Search records, submissions, runs, users, files, conversations and connections at once, grouped by kind, as GET /api/admin/search answers it (admin-only, read-only).',
    inputSchema: {
      type: 'object',
      properties: { q: { type: 'string', description: 'The words to search for.' } },
    },
  },
  openapi: {
    summary: 'Search the whole instance',
    description:
      'Indexed full-text search over every entity kind the console shows, grouped by kind. ' +
      'An empty `q` and a query nothing matches both answer 200 with empty groups. Admin only.',
    operationIdBase: 'searchAdmin',
    // An empty or absent term answers empty groups; no term is refused.
    querySchema: adminSearchQuerySchema,
    refusesQuery: false,
    responseSchema: adminSearchResponseSchema,
    responseDescription: 'The grouped results',
  },
  subject: 'search',
  decode: (raw) => ({ _tag: 'Ok', input: typeof raw['q'] === 'string' ? raw['q'] : '' }),
  read: (app, query) =>
    SearchAdminGlobal(app, query).pipe(
      Effect.tapCause((cause) =>
        Effect.gen(function* () {
          const logger = yield* Logger
          yield* logger.error('[admin] search degraded to empty groups', Cause.squash(cause))
        })
      ),
      // effect-swallow: an empty `groups` array is this read's canonical no-results body, so a search that cannot run degrades into the shape every client already handles rather than a 500 it does not. The cause is logged above.
      Effect.orElseSucceed(() => ({ query: query.trim(), groups: [] })),
      Effect.map((body) => answerWithSchema(adminSearchResponseSchema, body))
    ),
})

const footprint = defineAdminRead<undefined>({
  id: 'console.footprint',
  method: 'get',
  path: '/api/admin/footprint/overview',
  pathParams: [],
  queryParams: [],
  tool: {
    suffix: 'footprint_overview',
    description:
      'The environmental footprint of this instance — its eco posture, page weight grades, storage and runtime — as GET /api/admin/footprint/overview answers it (admin-only, read-only).',
    inputSchema: NO_ARGUMENTS,
  },
  openapi: {
    summary: 'Read the environmental footprint',
    description:
      'The eco posture the operator set, the graded page weights served since boot, the ' +
      'largest storage consumers, the page cache and the runtime. Read at request time, ' +
      'with no third-party call. Admin only.',
    operationIdBase: 'getAdminFootprintOverview',
    responseSchema: footprintOverviewResponseSchema,
    responseDescription: 'The footprint overview',
  },
  subject: 'footprint overview',
  decode: noInput,
  read: (app) =>
    Effect.gen(function* () {
      const host = yield* AdminReadHost
      const body = yield* host.footprintOverview(app)
      return answerWithSchema(footprintOverviewResponseSchema, body)
    }),
})

/**
 * The storage status from the active environment: `disabled` when no provider
 * is configured, the S3 fields for S3, the directory for local storage, and the
 * provider alone for bytea.
 */
const buildStorageStatus = (): StorageStatusResponse => {
  const config = parseStorageEnvConfig()
  if (!config) return { provider: 'disabled' }
  if (config.provider === 's3') {
    return {
      provider: 's3',
      region: config.region,
      bucket: config.bucket,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
    }
  }
  if (config.provider === 'local') return { provider: 'local', directory: config.directory }
  return { provider: 'bytea' }
}

const storageStatus = defineAdminRead<undefined>({
  id: 'console.storage-status',
  method: 'get',
  path: '/api/admin/storage/status',
  pathParams: [],
  queryParams: [],
  tool: {
    suffix: 'storage_status',
    description:
      'The active storage provider and its settings, as GET /api/admin/storage/status answers them (admin-only, read-only).',
    inputSchema: NO_ARGUMENTS,
  },
  openapi: {
    summary: 'Get storage status',
    description: 'Returns the configured storage provider and its settings. Admin only.',
    operationIdBase: 'getAdminStorageStatus',
    responseSchema: storageStatusResponseSchema,
    responseDescription: 'Storage status',
  },
  subject: 'storage status',
  decode: noInput,
  read: () =>
    Effect.sync(() => answerWithSchema(storageStatusResponseSchema, buildStorageStatus())),
})

type Period = TablesOverviewQuery['period']

const tablesOverview = defineAdminRead<Period>({
  id: 'console.tables-overview',
  method: 'get',
  path: '/api/admin/tables/overview',
  pathParams: [],
  queryParams: ['period'],
  tool: {
    suffix: 'tables_overview',
    description:
      'Each table row count, soft-deleted count and last write, with the write volume over a period, as GET /api/admin/tables/overview answers them (admin-only, read-only).',
    inputSchema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['24h', '7d', '30d'],
          description: 'The reporting period (default 24h).',
        },
      },
    },
  },
  openapi: {
    summary: 'Read the tables overview',
    description:
      'Per-table aggregates (row count, soft-deleted count, last write) and the write ' +
      'volume series over the period. Writes an audit event. Admin only.',
    operationIdBase: 'getAdminTablesOverview',
    querySchema: tablesOverviewQuerySchema,
    responseSchema: tablesOverviewResponseSchema,
    responseDescription: 'The tables overview',
  },
  subject: 'tables overview',
  decode: (raw) =>
    Option.match(
      Schema.decodeUnknownOption(tablesOverviewQuerySchema)({ period: raw['period'] ?? '24h' }),
      {
        onNone: () =>
          ({
            _tag: 'InvalidInput',
            reason: 'malformed',
            message: 'Invalid period query parameter',
            code: 'VALIDATION_ERROR',
          }) as const,
        onSome: (query) => ({ _tag: 'Ok', input: query.period }) as const,
      }
    ),
  read: (app, period) =>
    Effect.map(
      buildTablesOverview({
        tables: (app.tables ?? []).map((table) => ({
          displayName: table.name,
          dbName: sanitizeTableName(table.name),
        })),
        period,
        now: new Date(),
      }),
      (body) => answerWithSchema(tablesOverviewResponseSchema, body)
    ),
  audit: { action: AUDIT_ACTIONS.TABLE_OVERVIEW_QUERIED, resourceId: () => 'overview' },
})

/** The console overview admin reads, in the order the registry lists them. */
export const CONSOLE_READ_OPERATIONS: ReadonlyArray<AdminReadOperation> = [
  overview,
  attention,
  search,
  footprint,
  storageStatus,
  tablesOverview,
]
