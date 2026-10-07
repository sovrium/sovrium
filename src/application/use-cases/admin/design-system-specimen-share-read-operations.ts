/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Two design-system admin reads that are not projections of the token
 * document, as registry entries: the catalog's specimen rows and the list of
 * live public shares. Their siblings — the exports and the facets — are
 * `design-system-read-operations.ts`.
 *
 *   - **Specimen rows** (`GET /api/admin/design-system/specimen-rows`) — the
 *     platform fixture the catalog's data specimens are drawn from, capped by
 *     `rows` and paged by `page` + `limit`. `total` describes the CAPPED
 *     fixture rather than the page, so a pager can say `1-10 of 30`; `rows=0`
 *     answers no rows above a total of zero. An unusable cap or page is
 *     ignored rather than refused. No audit event: the fixture is a platform
 *     constant identical on every instance, so a row for it would record
 *     nothing about the operator.
 *   - **Shares** (`GET /api/admin/design-system/shares`) — the live public
 *     share links of this app, newest first, METADATA ONLY: `{ id, createdAt }`.
 *     Never the token, the share URL (which IS the token) or its digest — the
 *     plaintext is emitted once, by the mint, and an operator who lost a link
 *     revokes it and mints another. No audit event, as the route never wrote
 *     one; the mint and the revoke are actions and stay hand-mounted.
 */

import { DateTime, Effect } from 'effect'
import {
  answerWithSchema,
  decodeAdminReadQuery,
  defineAdminRead,
  type AdminReadOperation,
} from '@/application/use-cases/admin/admin-read-operation'
import { listDesignSystemShares } from '@/application/use-cases/admin/design-system-share'
import { parseOptionalCap, parseOptionalPositive } from '@/domain/kernel/format/query-cap-parsers'
import {
  designSystemSharesResponseSchema,
  specimenRowsQuerySchema,
  specimenRowsResponseSchema,
  type SpecimenRowsQuery,
} from '@/domain/models/api/admin/design-system'
import { windowSpecimenRows } from '@/domain/models/app/design/specimen-fixture'

const specimenRows = defineAdminRead<SpecimenRowsQuery>({
  id: 'design-system.specimen-rows',
  method: 'get',
  path: '/api/admin/design-system/specimen-rows',
  pathParams: [],
  queryParams: ['rows', 'page', 'limit'],
  tool: {
    suffix: 'design_system_specimen_rows',
    description:
      'The platform fixture rows the design-system catalog draws its data specimens from, capped and paged, as GET /api/admin/design-system/specimen-rows answers them (admin-only, read-only).',
    inputSchema: {
      type: 'object',
      properties: {
        rows: {
          type: 'integer',
          minimum: 0,
          description: 'Cap the fixture at this many rows; 0 serves the empty state.',
        },
        page: { type: 'integer', minimum: 1, description: '1-based page of the capped fixture.' },
        limit: { type: 'integer', minimum: 1, description: 'Rows per page.' },
      },
    },
  },
  openapi: {
    summary: 'Read the design-system specimen rows',
    description:
      'The platform fixture rows the catalog draws its data specimens from. `rows` caps the ' +
      'fixture (`0` serves the empty state), `page` and `limit` page the capped fixture, and ' +
      '`total` describes the capped fixture rather than the page. A value that is not usable ' +
      'is ignored. Admin only.',
    operationIdBase: 'getAdminDesignSpecimenRows',
    querySchema: specimenRowsQuerySchema,
    responseSchema: specimenRowsResponseSchema,
    responseDescription: 'One page of the capped fixture',
  },
  subject: 'specimen rows',
  decode: (raw) => decodeAdminReadQuery(specimenRowsQuerySchema, raw),
  // No admin audit event: a platform constant records nothing about the operator.
  read: (_app, { rows, page, limit }) =>
    Effect.map(DateTime.now, (now) =>
      answerWithSchema(
        specimenRowsResponseSchema,
        windowSpecimenRows(
          {
            cap: parseOptionalCap(rows),
            page: parseOptionalPositive(page),
            limit: parseOptionalPositive(limit),
          },
          DateTime.toDateUtc(now)
        )
      )
    ),
})

const sharesList = defineAdminRead<undefined>({
  id: 'design-system.shares.list',
  method: 'get',
  path: '/api/admin/design-system/shares',
  pathParams: [],
  queryParams: [],
  tool: {
    suffix: 'design_system_shares_list',
    description:
      'The live public share links of the design system, newest first, by id and creation time and never the link itself, as GET /api/admin/design-system/shares answers them (admin-only, read-only).',
    inputSchema: { type: 'object', properties: {} },
  },
  openapi: {
    summary: 'List the live design-system shares',
    description:
      'Every unrevoked public share of this app, newest first, as `{ id, createdAt }`. ' +
      'Metadata only: the token and the share URL are returned once, by the mint, and never ' +
      'again. Admin only.',
    operationIdBase: 'listAdminDesignSystemShares',
    responseSchema: designSystemSharesResponseSchema,
    responseDescription: 'The live shares',
  },
  subject: 'design-system shares',
  decode: () => ({ _tag: 'Ok', input: undefined }),
  // No admin audit event: the share list route has never written one.
  read: (app) =>
    Effect.map(listDesignSystemShares(app.name), (shares) => {
      const items = shares.map((share) => ({
        id: share.id,
        createdAt: share.createdAt.toISOString(),
      }))
      return answerWithSchema(designSystemSharesResponseSchema, { items, total: items.length })
    }),
})

/** The specimen rows and the share list, in the order the registry lists them. */
export const DESIGN_SYSTEM_SPECIMEN_SHARE_READ_OPERATIONS: ReadonlyArray<AdminReadOperation> = [
  specimenRows,
  sharesList,
]
