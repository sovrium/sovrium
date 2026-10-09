/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The automations admin reads, as registry entries.
 *
 * Each entry is the whole of one `GET /api/admin/automations*` read: the admin
 * route, the MCP admin tool and the OpenAPI operation are all derived from it.
 * The reads themselves are the existing use-cases — nothing here re-derives a
 * filter, a cursor or a body.
 *
 * Audit: list, detail and overview write their admin audit event on a
 * successful read; the catalog writes none, exactly as its route always has.
 * The detail read answers an unknown run id and a malformed one alike with
 * `NotFound`, so the shape of an id reveals nothing (anti-enumeration, S1).
 */

import { Effect, Option, Schema } from 'effect'
import { defineAdminRead } from '@/application/use-cases/admin/admin-read-operation'
import { BuildAutomationsCatalog } from '@/application/use-cases/admin/automations-catalog'
import {
  BuildAdminRunDetail,
  BuildAdminRunsList,
  BuildAutomationsOverview,
  type AdminRunsListInput,
} from '@/application/use-cases/admin/automations-overview'
import { decodeAdminRunsListQuery } from '@/application/use-cases/admin/automations-runs-query'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import {
  automationsCatalogResponseSchema,
  automationsOverviewQuerySchema,
  automationsOverviewResponseSchema,
  automationsRunsDetailParamsSchema,
  automationsRunsDetailWithStepsResponseSchema,
  automationsRunsListQuerySchema,
  automationsRunsListResponseSchema,
} from '@/domain/models/api/admin/automations'
import { runStatusSchema } from '@/domain/models/api/automations/automations'
import type { AdminReadOperation } from '@/application/use-cases/admin/admin-read-operation'

const RUNS_LIST_TOOL_PROPERTIES: Readonly<Record<string, unknown>> = {
  status: {
    type: 'string',
    enum: [...runStatusSchema.literals],
    description: 'Only runs in this status.',
  },
  automationName: {
    type: 'string',
    minLength: 1,
    description: 'Only runs of the automation with this name.',
  },
  triggerName: {
    type: 'string',
    minLength: 1,
    description:
      'Only runs started by the trigger with this name: its own name, else its type. AND-combined with every other filter.',
  },
  automationId: {
    type: 'string',
    minLength: 1,
    description: 'Only runs of the automation with this id. AND-combined with automationName.',
  },
  from: {
    type: 'string',
    format: 'date-time',
    description: 'Only runs started at or after this ISO 8601 instant.',
  },
  to: {
    type: 'string',
    format: 'date-time',
    description: 'Only runs started before this ISO 8601 instant. Must not precede from.',
  },
  q: {
    type: 'string',
    description: 'Case-insensitive search over the automation name and the failure message.',
  },
  limit: {
    type: 'integer',
    minimum: 1,
    maximum: 200,
    description: 'Runs per page (default 50).',
  },
  cursor: {
    type: 'string',
    description: 'The nextCursor of the previous page. Omit on the first page.',
  },
}

const runsList = defineAdminRead<AdminRunsListInput>({
  id: 'automations.runs.list',
  method: 'get',
  path: '/api/admin/automations/runs',
  pathParams: [],
  // An ALLOW-LIST: a parameter not named here never reaches the decoder, which
  // is how `?q=` once answered a confident 200 over the wrong rows.
  queryParams: [
    'cursor',
    'limit',
    'status',
    'automationName',
    'triggerName',
    'automationId',
    'from',
    'to',
    'include_deleted',
    'q',
  ],
  tool: {
    suffix: 'automation_runs_list',
    description:
      'List automation runs newest first, as GET /api/admin/automations/runs answers them (admin-only, read-only).',
    inputSchema: { type: 'object', properties: RUNS_LIST_TOOL_PROPERTIES },
  },
  openapi: {
    summary: 'List automation runs',
    description:
      'Cursor-paginated run history, newest first, each run carrying its `_admin` envelope. ' +
      'Filters AND-combine with each other, with `q` and with the cursor, so a page is a page ' +
      'of matches. A `from` later than `to` is refused 400 before any read. One audit event ' +
      'per call, never one per page. Admin only, and a non-admin caller is answered 404 ' +
      'rather than 403.',
    operationIdBase: 'listAdminAutomationRuns',
    querySchema: automationsRunsListQuerySchema,
    responseSchema: automationsRunsListResponseSchema,
    responseDescription: 'One page of runs',
  },
  subject: 'runs list',
  decode: (raw) => {
    const decoded = decodeAdminRunsListQuery(raw)
    if (decoded._tag === 'InvalidQuery') return { _tag: 'InvalidInput', reason: 'malformed' }
    if (decoded._tag === 'InvertedWindow') {
      return { _tag: 'InvalidInput', reason: 'inverted-window' }
    }
    return decoded
  },
  read: BuildAdminRunsList,
  audit: { action: AUDIT_ACTIONS.AUTOMATION_RUNS_LIST_QUERIED, resourceId: (app) => app.name },
})

const runRead = defineAdminRead<string>({
  id: 'automations.runs.read',
  method: 'get',
  path: '/api/admin/automations/runs/:runId',
  pathParams: ['runId'],
  queryParams: [],
  tool: {
    suffix: 'automation_run_read',
    description:
      'Read one automation run with its steps and the entries each step logged, as GET /api/admin/automations/runs/:runId answers it (admin-only, read-only).',
    inputSchema: {
      type: 'object',
      properties: { runId: { type: 'string', description: 'The run id.' } },
      required: ['runId'],
    },
  },
  openapi: {
    summary: 'Read one automation run',
    description:
      'One run with its `_admin` envelope, its steps, and the entries each step logged. An ' +
      'unknown run id and a malformed one are both answered 404, so the shape of an id ' +
      'reveals nothing; neither writes an audit event. Admin only.',
    operationIdBase: 'getAdminAutomationRun',
    paramsSchema: automationsRunsDetailParamsSchema,
    responseSchema: automationsRunsDetailWithStepsResponseSchema,
    responseDescription: 'The run, its steps and their logs',
  },
  subject: 'run detail',
  // A malformed id is not-found too — the 400-vs-404 split would leak which
  // shapes of id exist.
  decode: (raw) =>
    Option.match(
      Schema.decodeUnknownOption(automationsRunsDetailParamsSchema)({ runId: raw['runId'] }),
      {
        onNone: () => ({ _tag: 'NotFound' }) as const,
        onSome: (params) => ({ _tag: 'Ok', input: params.runId }) as const,
      }
    ),
  read: BuildAdminRunDetail,
  audit: {
    action: AUDIT_ACTIONS.AUTOMATION_RUNS_DETAIL_QUERIED,
    resourceId: (_app, runId) => runId,
  },
})

type OverviewPeriod = NonNullable<typeof automationsOverviewQuerySchema.Type.period>

const overview = defineAdminRead<OverviewPeriod>({
  id: 'automations.overview',
  method: 'get',
  path: '/api/admin/automations/overview',
  pathParams: [],
  queryParams: ['period'],
  tool: {
    suffix: 'automations_overview',
    description:
      'Automation totals and a bucketed run series for a period, as GET /api/admin/automations/overview answers them (admin-only, read-only).',
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
    summary: 'Read the automations overview',
    description:
      'Totals (configured automations, runs and failures over the last 24 hours, the ' +
      'period success rate) and a bucketed run series for the period, hourly for `24h` and ' +
      'daily for `7d` and `30d`. Admin only.',
    operationIdBase: 'getAdminAutomationsOverview',
    querySchema: automationsOverviewQuerySchema,
    responseSchema: automationsOverviewResponseSchema,
    responseDescription: 'The overview totals and series',
  },
  subject: 'automations overview',
  decode: (raw) =>
    Option.match(
      Schema.decodeUnknownOption(automationsOverviewQuerySchema)({ period: raw['period'] }),
      {
        onNone: () => ({ _tag: 'InvalidInput', reason: 'malformed' }) as const,
        onSome: (query) => ({ _tag: 'Ok', input: query.period ?? '24h' }) as const,
      }
    ),
  read: BuildAutomationsOverview,
  audit: { action: AUDIT_ACTIONS.AUTOMATION_OVERVIEW_QUERIED, resourceId: (app) => app.name },
})

const catalog = defineAdminRead<undefined>({
  id: 'automations.catalog',
  method: 'get',
  path: '/api/admin/automations',
  pathParams: [],
  queryParams: [],
  tool: {
    suffix: 'automations_catalog',
    description:
      'Every declared automation in config order with its trigger and operational state, as GET /api/admin/automations answers it (admin-only, read-only).',
    inputSchema: { type: 'object', properties: {} },
  },
  openapi: {
    summary: 'List the declared automations',
    description:
      'Every automation declared in config, in config order, with its trigger and its ' +
      'operational state (active, paused, or disabled in config). Uncursored by design: it ' +
      'enumerates configuration, which the app file bounds. Admin only.',
    operationIdBase: 'listAdminAutomations',
    responseSchema: automationsCatalogResponseSchema,
    responseDescription: 'The declared automations',
  },
  subject: 'automations catalog',
  decode: () => ({ _tag: 'Ok', input: undefined }),
  // No admin audit event: the catalog route has never written one.
  read: (app) =>
    Effect.map(BuildAutomationsCatalog(app), (body) => ({ _tag: 'Ok', body }) as const),
})

/** The automations admin reads, in the order the registry lists them. */
export const AUTOMATIONS_READ_OPERATIONS: ReadonlyArray<AdminReadOperation> = [
  runsList,
  runRead,
  overview,
  catalog,
]
