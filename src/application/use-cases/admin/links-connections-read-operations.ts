/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The link and connection admin reads, as registry entries.
 *
 * Each entry is the whole of one read: the admin route, the MCP admin tool and
 * the OpenAPI operation are derived from it. The reads are the existing
 * use-cases — the links catalog union and the connection roster — and the
 * bodies are the existing projections.
 *
 * Audit: the two connection reads write `connection.{list,detail}.queried` on
 * success; the two link reads write none, exactly as their routes never have.
 *
 * Redaction is the use-cases' own: the connection bodies are a hard allow-list
 * validated against strict schemas, so a credential, an access token or a
 * refresh token can never be serialised — on HTTP or over MCP. The link bodies
 * carry no password and no hash of one.
 *
 * NOT here: `GET /api/admin/connections/:name/callback`. It is a GET only because
 * OAuth redirects the browser there; it exchanges a code and stores a token, so
 * it is an action, and it stays a hand-written route.
 */

import { DateTime, Effect, Option, Schema } from 'effect'
import {
  adminReadPathParams,
  defineAdminRead,
  answerWithSchema,
} from '@/application/use-cases/admin/admin-read-operation'
import {
  BuildConnectionDetail,
  BuildConnectionsList,
} from '@/application/use-cases/admin/connections'
import {
  listLinkCatalog,
  readLinkEntry,
  toAdminLink,
  toAdminLinkDetail,
  type LinkCatalogQuery,
} from '@/application/use-cases/links'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import {
  connectionDetailResponseSchema,
  connectionsListResponseSchema,
} from '@/domain/models/api/admin/connections/connections'
import {
  adminLinkDetailResponseSchema,
  adminLinksListQuerySchema,
  adminLinksListResponseSchema,
} from '@/domain/models/api/admin/links'
import type { AdminReadOperation } from '@/application/use-cases/admin/admin-read-operation'

/**
 * The resource id the connection-list audit event carries — the list has no
 * single connection id; the canonical `resource.type` comes from the action.
 */
const CONNECTION_LIST_RESOURCE_ID = 'connections'

const nowAsDate = Effect.map(DateTime.now, DateTime.toDateUtc)

// ─── Links ───────────────────────────────────────────────────────────────────

/** A flag spelled as the console sends it (`true`/`1`) or as a JSON boolean. */
const isTrueFlag = (value: unknown): boolean => value === true || value === 'true' || value === '1'

/**
 * Decode the catalog query. `include_archived` is read from the RAW value rather
 * than from the schema's coercion, which is `Boolean("false") === true` — the
 * coercion would turn an explicit opt-OUT into an opt-in and quietly surface
 * deleted links.
 */
const decodeLinksQuery = (raw: Readonly<Record<string, unknown>>) =>
  Option.match(Schema.decodeOption(adminLinksListQuerySchema)(raw), {
    onNone: () =>
      ({
        _tag: 'InvalidInput',
        reason: 'malformed',
        message: 'Invalid query parameters',
      }) as const,
    onSome: (query) =>
      ({
        _tag: 'Ok',
        input: {
          cursor: query.cursor,
          limit: query.limit,
          q: query.q === undefined || query.q === '' ? undefined : query.q,
          tag: query.tag,
          source: query.source,
          state: query.state,
          includeArchived: isTrueFlag(raw['include_archived']),
        } satisfies LinkCatalogQuery,
      }) as const,
  })

const linksList = defineAdminRead<LinkCatalogQuery>({
  id: 'links.list',
  method: 'get',
  path: '/api/admin/links',
  pathParams: [],
  queryParams: ['cursor', 'limit', 'q', 'tag', 'source', 'state', 'include_archived'],
  tool: {
    suffix: 'links_list',
    description:
      'List the short links — the ones declared in config and the ones minted in the console — each with its operational state, as GET /api/admin/links answers them (admin-only, read-only).',
    inputSchema: {
      type: 'object',
      properties: {
        q: { type: 'string', description: 'Free-text narrowing over slug, title and destination.' },
        tag: { type: 'string', description: 'Only links carrying this tag.' },
        source: {
          type: 'string',
          enum: ['config', 'db'],
          description: 'Only config-declared or console-minted links.',
        },
        state: { type: 'string', description: 'Only links in this operational state.' },
        include_archived: {
          type: 'boolean',
          description: 'Include soft-deleted links (default false).',
        },
        limit: { type: 'integer', minimum: 1, maximum: 200, description: 'Links per page.' },
        cursor: { type: 'string', description: 'The nextCursor of the previous page.' },
      },
    },
  },
  openapi: {
    summary: 'List the short links',
    description:
      'The links catalog: the links `app.links[]` declares and the ones minted at runtime, ' +
      'each in the state its lifecycle gives it. `q` narrows server-side and is echoed back ' +
      'as `appliedQuery`. Revalidatable with `If-None-Match`. Admin only.',
    operationIdBase: 'listAdminLinks',
    querySchema: adminLinksListQuerySchema,
    responseSchema: adminLinksListResponseSchema,
    responseDescription: 'One page of links',
  },
  subject: 'links catalog',
  http: { conditional: {} },
  decode: decodeLinksQuery,
  // No admin audit event: the links catalog route has never written one.
  read: (app, query) =>
    Effect.gen(function* () {
      const now = yield* nowAsDate
      const page = yield* listLinkCatalog({ app, query, now })
      return answerWithSchema(adminLinksListResponseSchema, {
        items: page.items.map((row) => toAdminLink(row.entry, row.state)),
        nextCursor: page.nextCursor,
        total: page.total,
        appliedQuery: query.q ?? null,
      })
    }),
})

const linkRead = defineAdminRead<string>({
  id: 'links.read',
  method: 'get',
  path: '/api/admin/links/:slug',
  pathParams: ['slug'],
  queryParams: [],
  tool: {
    suffix: 'link_read',
    description:
      'Read one short link with its targets and tracking parameters, as GET /api/admin/links/:slug answers it (admin-only, read-only).',
    inputSchema: {
      type: 'object',
      properties: { slug: { type: 'string', description: 'The link slug.' } },
      required: ['slug'],
    },
  },
  openapi: {
    summary: 'Read one short link',
    description:
      'One link with its weighted targets, its UTM parameters, its notes and its QR URL. ' +
      'An unknown slug is answered 404. Admin only.',
    operationIdBase: 'getAdminLink',
    paramsSchema: adminReadPathParams({ slug: 'The link slug' }),
    responseSchema: adminLinkDetailResponseSchema,
    responseDescription: 'The link',
  },
  subject: 'link detail',
  decode: (raw) =>
    typeof raw['slug'] === 'string' ? { _tag: 'Ok', input: raw['slug'] } : { _tag: 'NotFound' },
  // No admin audit event: the link detail route has never written one.
  read: (app, slug) =>
    Effect.gen(function* () {
      const now = yield* nowAsDate
      const found = yield* readLinkEntry({ app, slug, now })
      if (found === undefined) return { _tag: 'NotFound' } as const
      return answerWithSchema(adminLinkDetailResponseSchema, {
        link: toAdminLinkDetail(found.entry, found.state),
      })
    }),
})

// ─── Connections ─────────────────────────────────────────────────────────────

const connectionsList = defineAdminRead<undefined>({
  id: 'connections.list',
  method: 'get',
  path: '/api/admin/connections',
  pathParams: [],
  queryParams: [],
  tool: {
    suffix: 'connections_list',
    description:
      'List the runtime connections with their token count, nearest expiry and status — never a credential or a token — as GET /api/admin/connections answers them (admin-only, read-only).',
    inputSchema: { type: 'object', properties: {} },
  },
  openapi: {
    summary: 'List the runtime connections',
    description:
      'One row per stored connection with its per-connection token summary and derived ' +
      'status. A hard allow-list: no credential, access token or refresh token is ever ' +
      'serialised. Admin only.',
    operationIdBase: 'listAdminConnections',
    responseSchema: connectionsListResponseSchema,
    responseDescription: 'The connections',
  },
  subject: 'connections list',
  decode: () => ({ _tag: 'Ok', input: undefined }),
  read: () => BuildConnectionsList,
  audit: {
    action: AUDIT_ACTIONS.CONNECTION_LIST_QUERIED,
    resourceId: () => CONNECTION_LIST_RESOURCE_ID,
  },
})

const connectionRead = defineAdminRead<string>({
  id: 'connections.read',
  method: 'get',
  path: '/api/admin/connections/:id',
  pathParams: ['id'],
  queryParams: [],
  tool: {
    suffix: 'connection_read',
    description:
      'Read one runtime connection with its per-user token status — never the token itself — as GET /api/admin/connections/:id answers it (admin-only, read-only).',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'The connection id.' } },
      required: ['id'],
    },
  },
  openapi: {
    summary: 'Read one runtime connection',
    description:
      'The connection header and its per-user token roster (user id, expiry, status). An ' +
      'unknown id and a malformed one are both answered 404 and write no audit event. ' +
      'Admin only.',
    operationIdBase: 'getAdminConnection',
    paramsSchema: adminReadPathParams({ id: 'The connection id' }),
    responseSchema: connectionDetailResponseSchema,
    responseDescription: 'The connection and its token roster',
  },
  subject: 'connection detail',
  decode: (raw) =>
    typeof raw['id'] === 'string' && raw['id'].length > 0
      ? { _tag: 'Ok', input: raw['id'] }
      : { _tag: 'NotFound' },
  read: (_app, id) => BuildConnectionDetail(id),
  audit: {
    action: AUDIT_ACTIONS.CONNECTION_DETAIL_QUERIED,
    resourceId: (_app, id) => id,
  },
})

/** The two link reads — mounted beside the link mutations. */
export const LINKS_READ_OPERATIONS: ReadonlyArray<AdminReadOperation> = [linksList, linkRead]

/** The two connection reads — mounted beside the connection actions. */
export const CONNECTIONS_READ_OPERATIONS: ReadonlyArray<AdminReadOperation> = [
  connectionsList,
  connectionRead,
]

/** The link and connection admin reads, in the order the registry lists them. */
export const LINKS_CONNECTIONS_READ_OPERATIONS: ReadonlyArray<AdminReadOperation> = [
  ...LINKS_READ_OPERATIONS,
  ...CONNECTIONS_READ_OPERATIONS,
]
