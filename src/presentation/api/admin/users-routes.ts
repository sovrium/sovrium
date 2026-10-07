/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Admin endpoints for the people of the instance:
 *
 *   - GET /api/admin/users/overview — the users dashboard tile.
 *   - GET /api/admin/users          — the account directory (JSON), plus its
 *     `?format=csv` download.
 *   - GET /api/admin/invitations    — the outstanding invitations.
 *
 * The three reads are admin read-registry entries
 * (`application/use-cases/admin/people-read-operations.ts`), mounted here
 * through `chainAdminReadRoutes`: the route, its OpenAPI operation and its MCP
 * admin tool are one entry. Only the overview writes an admin audit event.
 *
 * The directory's CSV download is a FORMAT of the directory read, not another
 * read, so it is the one HTTP-only branch below: it decodes the same query
 * through the same decoder, and exports every account that MATCHES rather than
 * the page the grid happens to show.
 *
 * Anti-enumeration 404 (S1) is wired upstream by `authMiddleware` +
 * `requireAdminTier()` on `/api/admin/users`, `/api/admin/users/overview` and
 * the `/api/admin/*` catch-all, which answer 404 for both missing-session and
 * wrong-role callers.
 */

import { USERS_READ_OPERATIONS } from '@/application/use-cases/admin/admin-read-registry'
import { decodeUsersDirectoryQuery } from '@/application/use-cases/admin/people-read-operations'
import { BuildUsersDirectory } from '@/application/use-cases/admin/users-directory'
import { buildCsvAttachmentDisposition } from '@/domain/kernel/url/csv-attachment'
import { exportRecordsToCsv } from '@/infrastructure/export/csv-exporter'
import { logError } from '@/infrastructure/logging/logger'
import { provideDomain, runRequestEffect } from '@/infrastructure/logging/request-effect'
import { chainAdminReadRoutes } from '@/presentation/api/admin/read-operation-routes'
import { requestLogAttributes } from '@/presentation/api/runtime/context-helpers'
import type { App } from '@/domain/models/app'
import type { Context, Hono, Next } from 'hono'

/** The columns a directory CSV export carries, in the order the grid shows them. */
const DIRECTORY_CSV_COLUMNS = ['id', 'email', 'name', 'role', 'banned'] as const

/**
 * Project one directory row for CSV.
 *
 * `banned` is spelled out rather than left as a boolean: the serialiser writes
 * `1` for true and an EMPTY cell for false, so a spreadsheet column of blanks
 * would read as "no data" for exactly the accounts that are in good standing.
 */
const csvRow = (user: {
  readonly id: string
  readonly email: string
  readonly name: string
  readonly role: string
  readonly banned: boolean
}): Readonly<Record<string, unknown>> => ({ ...user, banned: String(user.banned) })

const badRequest = (c: Context, message: string): Response =>
  c.json({ success: false, message, code: 'BAD_REQUEST' }, 400)

/**
 * `GET /api/admin/users?format=…` — the directory as a CSV download.
 *
 * Runs ahead of the registry's JSON read and yields to it when no `format` is
 * asked for. An export is of everything that MATCHES, not of the page: the
 * page and limit are dropped. Without `Content-Disposition` the Export button,
 * which navigates the whole browser, would land the operator on raw data.
 */
async function handleUsersDirectoryFormat(c: Context, next: Next): Promise<Response | void> {
  const format = c.req.query('format')
  if (format === undefined) return next()
  const decoded = decodeUsersDirectoryQuery({
    q: c.req.query('q'),
    page: c.req.query('page'),
    limit: c.req.query('limit'),
    sort: c.req.query('sort'),
    order: c.req.query('order'),
  })
  if (decoded._tag !== 'Ok') return badRequest(c, 'Invalid query parameters')
  if (format !== 'csv') return badRequest(c, 'Only csv format is supported')

  const { page: _page, limit: _limit, ...matching } = decoded.input
  const outcome = await runRequestEffect(c, provideDomain(c, BuildUsersDirectory(matching)))
  if (outcome._tag === 'ValidationFailed') {
    logError(
      '[admin] users directory response validation failed',
      outcome.error,
      requestLogAttributes(c)
    )
    return c.json(
      { success: false, message: 'Failed to build users directory', code: 'INTERNAL_ERROR' },
      500
    )
  }
  return new Response(exportRecordsToCsv(outcome.body.users.map(csvRow), DIRECTORY_CSV_COLUMNS), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': buildCsvAttachmentDisposition('users', new Date()),
      'Cache-Control': 'no-store',
    },
  })
}

/**
 * Chain the people routes onto a Hono app: the CSV branch first, as a
 * middleware on the path, so it can answer before the registry's JSON read.
 */
export function chainAdminUsersRoutes<T extends Hono>(honoApp: T, resolveApp: () => App): T {
  return chainAdminReadRoutes(
    // A middleware, not a second GET handler: the registry's binding stays the
    // one GET route the path has, and this branch only answers `?format=`.
    honoApp.use('/api/admin/users', (c, next) =>
      c.req.method === 'GET' ? handleUsersDirectoryFormat(c, next) : next()
    ) as T,
    resolveApp,
    USERS_READ_OPERATIONS
  )
}
