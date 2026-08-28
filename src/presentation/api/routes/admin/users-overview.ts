/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Admin endpoint for the users domain: `GET /api/admin/users/overview`.
 *
 * Second overview-shape endpoint after `[internal ref]`
 * (story #1). Period-aware operator dashboard tile producing:
 *
 *   - totals.users           — live user count (excluding soft-deleted rows)
 *   - totals.active_24h      — distinct users with a session row in last 24h
 *   - totals.new_in_period   — users created within the requested period
 *   - totals.by_role         — exhaustive admin / operator / member breakdown
 *   - series.interval/points — dense bucketed signups + sessions_started rollup
 *
 * Anti-enumeration 404 (keystone §6.4 / S1) is wired upstream by
 * `requireAdminTier()` in `infrastructure/server/route-setup/api-routes.ts`,
 * which returns 404 for both missing-session and wrong-role callers. The
 * handler therefore only needs to honour the success path + the response
 * validation gate.
 *
 * Emits `user.overview.queried` once per successful read; the failure path
 * does NOT emit (the unknown / unauthorized path never reaches this handler
 * because the middleware short-circuits before it runs).
 *
 * Data access (the dialect-aware auth.user / auth.session reads) lives in the
 * `users-overview` use case + repository; this handler keeps only HTTP, auth,
 * query validation, the response-validation gate, and the audit emit, then calls
 * the use case via the effect runner.
 */

import { emitAuditEvent } from '@/application/use-cases/admin/audit-log/emit'
import { resolveActor } from '@/application/use-cases/admin/resolve-actor'
import { BuildUsersDirectory } from '@/application/use-cases/admin/users-directory'
import { BuildUsersOverview } from '@/application/use-cases/admin/users-overview'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import {
  adminUsersDirectoryQuerySchema,
  usersOverviewQuerySchema,
} from '@/domain/models/api/admin/users'
import { buildCsvAttachmentDisposition } from '@/domain/utils/csv-attachment'
import { parseSortSpec } from '@/domain/utils/sort-spec'
// eslint-disable-next-line boundaries/dependencies -- CSV serialization legitimately crosses presentation-api-route → infrastructure-export, the same way the records and form-submission exports do. The csv-exporter is a thin utility, not a domain feature.
import { exportRecordsToCsv } from '@/infrastructure/export/csv-exporter'
import { logError } from '@/infrastructure/logging/logger'
import { runRequestEffect } from '@/infrastructure/logging/request-effect'
import { provideUsersDirectoryLive } from '@/presentation/api/routes/admin/users-directory/effect-runner'
import { provideUsersOverviewLive } from '@/presentation/api/routes/admin/users-overview/effect-runner'
import { requestLogAttributes } from '@/presentation/api/utils/context-helpers'
import type { ContextWithSession } from '@/presentation/api/middleware/auth'
import type { Context, Hono } from 'hono'

/* eslint-disable functional/no-expression-statements -- request-handler code: the audit emit + response-header set + error log are intentional side-effects in a Hono handler, matching the sibling admin overview handlers. */

// ─── Overview handler ────────────────────────────────────────────────────────

async function handleUsersOverview(c: Context): Promise<Response> {
  const session = (c as ContextWithSession).var.session!

  // Parse period preset (default '24h' enforced at the Zod layer).
  const parsedQuery = usersOverviewQuerySchema.safeParse({
    period: c.req.query('period'),
  })
  if (!parsedQuery.success) {
    return c.json({ success: false, message: 'Invalid query', code: 'BAD_REQUEST' }, 400)
  }
  const { period } = parsedQuery.data

  // Build the overview body (data access + pure bucketing) via the use case.
  const outcome = await runRequestEffect(
    c,
    BuildUsersOverview(period).pipe(provideUsersOverviewLive)
  )

  if (outcome._tag === 'ValidationFailed') {
    logError(
      '[admin] users overview response validation failed',
      outcome.error,
      requestLogAttributes(c)
    )
    return c.json(
      { success: false, message: 'Failed to build users overview', code: 'INTERNAL_ERROR' },
      500
    )
  }

  // Emit audit entry — single emit per successful HTTP call. The catalog row
  // (`user.overview.queried` → resource.type `user`) is the canonical pairing;
  // resourceId is the caller's user id so the audit log can be filtered to
  // "every overview read this operator performed".
  const actor = await resolveActor(session.userId)
  await emitAuditEvent({
    action: AUDIT_ACTIONS.USER_OVERVIEW_QUERIED,
    actor,
    resourceId: session.userId,
    severity: 'info',
    result: 'success',
  })

  c.header('Cache-Control', 'no-store')
  return c.json(outcome.body, 200)
}

// ─── Directory handler ───────────────────────────────────────────────────────

/**
 * `GET /api/admin/users` — the Data-tab **Utilisateurs** account directory
 *.
 *
 * Reads the Better Auth `user` table DIRECTLY (via the dialect-aware
 * `authUsersTable()` selector inside the repository), decoupled from the Better
 * Auth admin-plugin's literal-`admin` gate, so EVERY admin-tier operator —
 * including a custom top role like the partner app's `engineer` — reaches it.
 * Returns the secret-free `{ users: [{ id, email, name, role, banned }] }`
 * directory subset the `EndUserRow` table renders.
 *
 * `?q=` narrows that body server-side over `email` + `name`. Before it existed
 * the parameter was ACCEPTED and discarded — Hono drops an unknown query param
 * silently — so every search answered 200-with-everything, and an operator
 * looking for a colleague by name got "no user matches" for an account sitting
 * in the table. An over-length term is a 400 rather than a silent truncation.
 *
 * Anti-enumeration 404 (S1) is wired upstream by `authMiddleware` +
 * `requireAdminTier()` on the bare `/api/admin/users` path in
 * `infrastructure/server/route-setup/api-routes.ts`, so the handler only honours
 * the success path + the response-validation gate.
 *
 * NO audit emit: the audit action catalog has no fitting `user.directory.*`
 * action (only the overview-specific `user.overview.queried`), and per the
 * implementation contract a new catalog entry must NOT be invented here. A
 * future `user.directory.queried` catalog row would let this read emit one
 * audit entry on success, mirroring the overview handler — flagged in the
 * follow-ups.
 */
/**
 * Parse the directory's query knobs.
 *
 * The literal below is an explicit ALLOW-LIST, and an unlisted key is how every
 * one of these controls came to be inert: Hono drops an unrecognised query
 * parameter without complaint, so the grid's pager, column headers and Export
 * button each sent a parameter that was accepted and discarded, and each got a
 * confident 200 back.
 *
 * `sort` takes the combined `field:direction` spelling a column header emits;
 * {@link parseSortSpec} splits it so the two halves meet their own enums, and a
 * column the directory cannot order by is refused rather than ignored.
 */
function parseDirectoryQuery(c: Context) {
  const sortSpec = parseSortSpec(c.req.query('sort'))
  return adminUsersDirectoryQuerySchema.safeParse({
    q: c.req.query('q'),
    page: c.req.query('page'),
    limit: c.req.query('limit'),
    sort: sortSpec?.field,
    // A direction spelled inside `sort` wins over a separate `?order=`: it is
    // the more specific statement, and the only one a header click sends.
    order: sortSpec?.direction ?? c.req.query('order'),
  })
}

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

async function handleUsersDirectory(c: Context): Promise<Response> {
  // The directory's query surface. Parsing it through the shared schema is what
  // turns an over-length term or an unsupported sort column into a 400 instead
  // of an answer to a question the operator never asked.
  const parsedQuery = parseDirectoryQuery(c)
  if (!parsedQuery.success) {
    return c.json({ success: false, message: 'Invalid query parameters', code: 'BAD_REQUEST' }, 400)
  }
  const { q, page, limit, sort, order } = parsedQuery.data
  const format = c.req.query('format')
  if (format !== undefined && format !== 'csv') {
    return c.json(
      { success: false, message: 'Only csv format is supported', code: 'BAD_REQUEST' },
      400
    )
  }
  const wantsCsv = format === 'csv'

  const outcome = await runRequestEffect(
    c,
    BuildUsersDirectory({
      ...(q !== undefined ? { q } : {}),
      ...(sort !== undefined ? { sort, order } : {}),
      // An export is of everything that MATCHES, not of the page the grid
      // happens to be showing — an operator who exports while on page 2 means
      // the directory, not rows 26 to 33.
      ...(wantsCsv ? {} : { page, limit }),
    }).pipe(provideUsersDirectoryLive)
  )

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

  if (wantsCsv) {
    // A `text/csv` body with no `Content-Disposition` is rendered in the tab
    // rather than saved, and the Export button navigates the whole browser —
    // so without this header the operator leaves the console and lands on raw
    // data. `exportRecordsToCsv` emits the header row even for zero matches,
    // which keeps "nobody matched" distinct from "the export broke".
    return new Response(exportRecordsToCsv(outcome.body.users.map(csvRow), DIRECTORY_CSV_COLUMNS), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': buildCsvAttachmentDisposition('users', new Date()),
        'Cache-Control': 'no-store',
      },
    })
  }

  c.header('Cache-Control', 'no-store')
  return c.json(outcome.body, 200)
}

// ─── Route registration ──────────────────────────────────────────────────────

/**
 * Chain the admin/users routes onto a Hono app.
 *
 * Auth gating is wired upstream in `createApiRoutes` (authMiddleware +
 * requireAdminTier on both `/api/admin/users/overview` AND the bare
 * `/api/admin/users` directory path). No live-App resolver needed: both
 * handlers read exclusively from auth.user / auth.session and never touch the
 * schema-author-controlled App config.
 */
export function chainAdminUsersRoutes<T extends Hono>(honoApp: T): T {
  return honoApp
    .get('/api/admin/users/overview', handleUsersOverview)
    .get('/api/admin/users', handleUsersDirectory) as T
}

/* eslint-enable functional/no-expression-statements */
