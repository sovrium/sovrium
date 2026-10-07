/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The people and access admin reads, as registry entries: the users overview,
 * the account directory, the outstanding invitations, the assignable roles
 * (`roles-read-operations.ts`), the organisation graph and the admin audit log.
 *
 * Each entry is the whole of one read: the admin route, the MCP admin tool and
 * the OpenAPI operation are derived from it. Only the users overview writes an
 * admin audit event (`user.overview.queried`, against the caller); the five
 * others write none, exactly as their routes never have — and the audit log in
 * particular must not, or reading the trail would grow it.
 *
 * Redaction is the reads' own: the directory is a secret-free allow-list, an
 * invitation never carries the bearer token its invitee received, and the
 * organisation graph is an allow-list of scalars and short rendered strings —
 * never an account address.
 *
 * The directory's `?format=csv` download is a FORMAT of this read, not another
 * read, so it stays an HTTP-only branch of the route; {@link
 * decodeUsersDirectoryQuery} is exported for it so both decode one query.
 */

import { DateTime, Effect, Option, Schema } from 'effect'
import { InvitationTokenRepository } from '@/application/ports/repositories/auth/invitation-token-repository'
import {
  defineAdminRead,
  answerWithSchema,
  type AdminReadDecode,
  type AdminReadOperation,
} from '@/application/use-cases/admin/admin-read-operation'
import { ListAuditEvents } from '@/application/use-cases/admin/audit-log/emit'
import { buildAdminOrganisationGraph } from '@/application/use-cases/admin/organisation-graph'
import { ROLES_READ_OPERATIONS } from '@/application/use-cases/admin/roles-read-operations'
import {
  BuildUsersDirectory,
  type UsersDirectoryInput,
} from '@/application/use-cases/admin/users-directory'
import { BuildUsersOverview } from '@/application/use-cases/admin/users-overview'
import { projectInvitations } from '@/application/use-cases/auth/admin-invitation-lifecycle'
import { parseSortSpec } from '@/domain/kernel/format/sort-spec'
import {
  auditLogListResponseSchema,
  auditLogQuerySchema,
} from '@/domain/models/api/admin/audit-log'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import { adminInvitationsListResponseSchema } from '@/domain/models/api/admin/invitations/lifecycle'
import {
  adminOrganisationGraphQuerySchema,
  adminOrganisationGraphResponseSchema,
  type AdminOrganisationGraphQuery,
} from '@/domain/models/api/admin/organisation'
import {
  adminUsersDirectoryQuerySchema,
  adminUsersDirectoryResponseSchema,
  usersOverviewQuerySchema,
  usersOverviewResponseSchema,
} from '@/domain/models/api/admin/users'
import type { AuditListFilter } from '@/application/ports/repositories/admin/audit-log-repository'
import type { PeriodPreset } from '@/domain/models/api/admin/envelope/period-preset'

// ─── Users ───────────────────────────────────────────────────────────────────

const usersOverview = defineAdminRead<PeriodPreset>({
  id: 'users.overview',
  method: 'get',
  path: '/api/admin/users/overview',
  pathParams: [],
  queryParams: ['period'],
  tool: {
    suffix: 'users_overview',
    description:
      'Count the people of the instance by role and the signups and sessions of a period, as GET /api/admin/users/overview answers them (admin-only, read-only).',
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
    summary: 'Read the users overview',
    description:
      'Totals (people, active in the last 24 hours, new in the period, people per assignable ' +
      'role, people no role recognises, invitations not yet accepted) and ' +
      'a bucketed signups and sessions series for the period, hourly for `24h` and daily ' +
      'for `7d` and `30d`. Admin only.',
    operationIdBase: 'getAdminUsersOverview',
    querySchema: usersOverviewQuerySchema,
    responseSchema: usersOverviewResponseSchema,
    responseDescription: 'The users totals and series',
  },
  subject: 'users overview',
  decode: (raw) =>
    Option.match(Schema.decodeUnknownOption(usersOverviewQuerySchema)({ period: raw['period'] }), {
      onNone: () => ({ _tag: 'InvalidInput', reason: 'malformed' }) as const,
      onSome: (query) => ({ _tag: 'Ok', input: query.period }) as const,
    }),
  read: (app, period) => BuildUsersOverview(app, period),
  // Against the caller: the trail then answers "every overview this operator read".
  audit: {
    action: AUDIT_ACTIONS.USER_OVERVIEW_QUERIED,
    resourceId: (_app, _period, caller) => caller.actorUserId,
  },
})

/** A decoded directory query: the search, the ordering and the page. */
type UsersDirectoryQuery = Required<Pick<UsersDirectoryInput, 'page' | 'limit'>> &
  Omit<UsersDirectoryInput, 'page' | 'limit'>

/**
 * Decode the directory's query. The literal below is an explicit ALLOW-LIST:
 * an unrecognised parameter was once accepted and discarded, so the grid's
 * pager, column headers and Export each got a confident 200 back. `sort` takes
 * the combined `field:direction` spelling a column header emits as well as the
 * pair `sort=email&order=asc`; a direction spelled inside `sort` wins. A column
 * the directory cannot order by is refused rather than ignored.
 */
export const decodeUsersDirectoryQuery = (
  raw: Readonly<Record<string, unknown>>
): AdminReadDecode<UsersDirectoryQuery> => {
  const sortSpec = parseSortSpec(typeof raw['sort'] === 'string' ? raw['sort'] : undefined)
  return Option.match(
    Schema.decodeUnknownOption(adminUsersDirectoryQuerySchema)({
      q: raw['q'],
      page: raw['page'],
      limit: raw['limit'],
      sort: sortSpec?.field,
      order: sortSpec?.direction ?? raw['order'],
    }),
    {
      onNone: () => ({
        _tag: 'InvalidInput',
        reason: 'malformed',
        message: 'Invalid query parameters',
      }),
      onSome: ({ q, page, limit, sort, order }) => ({
        _tag: 'Ok',
        input: {
          ...(q !== undefined ? { q } : {}),
          ...(sort !== undefined ? { sort, order } : {}),
          page,
          limit,
        },
      }),
    }
  )
}

const usersDirectory = defineAdminRead<UsersDirectoryQuery>({
  id: 'users.list',
  method: 'get',
  path: '/api/admin/users',
  pathParams: [],
  queryParams: ['q', 'page', 'limit', 'sort', 'order'],
  tool: {
    suffix: 'users_list',
    description:
      'Search and page the account directory — id, email, name, role and whether banned — as GET /api/admin/users answers it in JSON (admin-only, read-only).',
    inputSchema: {
      type: 'object',
      properties: {
        q: { type: 'string', description: 'Case-insensitive search over email and name.' },
        sort: {
          type: 'string',
          enum: ['id', 'email', 'name', 'role', 'banned'],
          description: 'The column to order by; or field:direction.',
        },
        order: { type: 'string', enum: ['asc', 'desc'], description: 'Sort direction.' },
        page: { type: 'integer', minimum: 1, description: '1-based page (default 1).' },
        limit: { type: 'integer', minimum: 1, maximum: 200, description: 'Accounts per page.' },
      },
    },
  },
  openapi: {
    summary: 'List the accounts',
    description:
      'The secret-free account directory, searched over email and name, ordered and paged; ' +
      '`q` is echoed back as `appliedQuery`. `?format=csv` downloads every matching account ' +
      'instead of the page. Admin only.',
    operationIdBase: 'listAdminUsers',
    querySchema: adminUsersDirectoryQuerySchema,
    responseSchema: adminUsersDirectoryResponseSchema,
    responseDescription: 'One page of accounts',
  },
  subject: 'users directory',
  decode: decodeUsersDirectoryQuery,
  // No admin audit event: the directory route has never written one.
  read: (_app, query) => BuildUsersDirectory(query),
})

// ─── Invitations ─────────────────────────────────────────────────────────────

const invitationsList = defineAdminRead<undefined>({
  id: 'invitations.list',
  method: 'get',
  path: '/api/admin/invitations',
  pathParams: [],
  queryParams: [],
  tool: {
    suffix: 'invitations_list',
    description:
      'List the outstanding invitations — address, role, issuer, pending or expired — and never the token the invitee received, as GET /api/admin/invitations answers them (admin-only, read-only).',
    inputSchema: { type: 'object', properties: {} },
  },
  openapi: {
    summary: 'List the outstanding invitations',
    description:
      'Every invitation not yet accepted, pending or expired, with its role and issuer. ' +
      'The bearer token an invitee received is never part of the answer. Admin only.',
    operationIdBase: 'listAdminInvitations',
    responseSchema: adminInvitationsListResponseSchema,
    responseDescription: 'The outstanding invitations',
  },
  subject: 'invitations list',
  decode: () => ({ _tag: 'Ok', input: undefined }),
  // No admin audit event: the invitations route has never written one.
  read: () =>
    Effect.gen(function* () {
      const rows = yield* (yield* InvitationTokenRepository).listPending
      const now = DateTime.toDateUtc(yield* DateTime.now)
      return answerWithSchema(adminInvitationsListResponseSchema, {
        items: projectInvitations(rows, now),
      })
    }),
})

// ─── Organisation ────────────────────────────────────────────────────────────

const organisationGraph = defineAdminRead<AdminOrganisationGraphQuery>({
  id: 'organisation.graph',
  method: 'get',
  path: '/api/admin/organisation/graph',
  pathParams: [],
  queryParams: ['node'],
  tool: {
    suffix: 'organisation_graph',
    description:
      'Who can reach which resource, through which role or grant, with the findings derived from it, as GET /api/admin/organisation/graph answers it (admin-only, read-only).',
    inputSchema: {
      type: 'object',
      properties: {
        node: { type: 'string', description: 'Narrow the graph to one node id.' },
      },
    },
  },
  openapi: {
    summary: 'Read the organisation graph',
    description:
      'The resolved access graph — people and roles, the grants between them and the ' +
      'resources they reach — with the findings derived from it and the narrowings a ' +
      'matrix cell cannot show. `node` narrows it to one subject. Admin only.',
    operationIdBase: 'getAdminOrganisationGraph',
    querySchema: adminOrganisationGraphQuerySchema,
    responseSchema: adminOrganisationGraphResponseSchema,
    responseDescription: 'The organisation graph',
  },
  subject: 'organisation graph',
  decode: (raw) =>
    Option.match(
      Schema.decodeUnknownOption(adminOrganisationGraphQuerySchema)({ node: raw['node'] }),
      {
        onNone: () => ({ _tag: 'InvalidInput', reason: 'malformed' }) as const,
        onSome: (query) => ({ _tag: 'Ok', input: query }) as const,
      }
    ),
  // No admin audit event: the organisation route has never written one.
  read: (app, query) =>
    Effect.map(buildAdminOrganisationGraph(app, query), (graph) =>
      answerWithSchema(adminOrganisationGraphResponseSchema, graph)
    ),
})

// ─── Audit log ───────────────────────────────────────────────────────────────

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

const auditLogList = defineAdminRead<AuditListFilter>({
  id: 'audit-log.list',
  method: 'get',
  path: '/api/admin/audit-log',
  pathParams: [],
  queryParams: ['actorId', 'action', 'resourceType', 'transport', 'cursor', 'limit'],
  tool: {
    suffix: 'audit_log_list',
    description:
      'Read the admin audit trail newest first, filtered by actor, action, transport or resource type, as GET /api/admin/audit-log answers it (admin-only, read-only; reading it records nothing).',
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
      },
    },
  },
  openapi: {
    summary: 'Read the admin audit log',
    description:
      'The admin audit trail, newest first, optionally filtered by actor, action, transport ' +
      'and resource type (all exact, combined conjunctively). An unrecognised value matches ' +
      'nothing and answers an empty page. Reading the trail writes no audit event. Admin only.',
    operationIdBase: 'listAdminAuditLog',
    querySchema: auditLogQuerySchema,
    responseSchema: auditLogListResponseSchema,
    responseDescription: 'The matching audit entries',
  },
  subject: 'audit-log response',
  decode: (raw) => ({ _tag: 'Ok', input: decodeAuditLogFilter(raw) }),
  // No admin audit event: reading the trail must not grow it.
  read: (_app, filter) =>
    Effect.map(ListAuditEvents(filter), (items) =>
      answerWithSchema(auditLogListResponseSchema, { items: [...items], nextCursor: null })
    ),
})

// ─── Area ────────────────────────────────────────────────────────────────────

/** The account reads (overview and directory), the invitations and the assignable roles. */
export const USERS_READ_OPERATIONS: ReadonlyArray<AdminReadOperation> = [
  usersOverview,
  usersDirectory,
  invitationsList,
  ...ROLES_READ_OPERATIONS,
]

/** The organisation graph. */
export const ORGANISATION_READ_OPERATIONS: ReadonlyArray<AdminReadOperation> = [organisationGraph]

/** The admin audit log. */
export const AUDIT_LOG_READ_OPERATIONS: ReadonlyArray<AdminReadOperation> = [auditLogList]

/** The people and access admin reads, in the order the registry lists them. */
export const PEOPLE_READ_OPERATIONS: ReadonlyArray<AdminReadOperation> = [
  ...USERS_READ_OPERATIONS,
  ...ORGANISATION_READ_OPERATIONS,
  ...AUDIT_LOG_READ_OPERATIONS,
]
