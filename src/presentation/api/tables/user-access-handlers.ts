/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  UserAccessRepository,
  type UserAccessRow,
} from '@/application/ports/repositories/auth/user-access-repository'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import { validateUserAccessInput } from '@/domain/models/app/tables/user-access-validation'
import { runUserAccessProgram } from '@/infrastructure/layers/table-layer'
import { logError } from '@/infrastructure/logging/logger'
import { runDomainPromise } from '@/infrastructure/logging/request-effect'
import { closeUserConnections } from '@/infrastructure/realtime/connection-counter'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import { toErrorResponse } from '@/presentation/api/runtime/run-effect'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * HTTP handlers for the multi-tenant `user_access` junction (Z-2).
 *
 * The DDL for the table is created at startup by `schema-initializer.ts`
 * whenever `auth.scopeTables` is configured. These handlers are mounted at
 * `/api/tables/user_access/records` BEFORE `validateTable` middleware so
 * the table-name lookup against `app.tables[]` does not reject the request
 * (user_access is an engine-managed junction, not a user-defined table).
 *
 * Insert-time validation enforces:
 *
 *   * `table_slug` ∈ `auth.scopeTables`
 *   * `role` ∈ `auth.roles[].name`
 *   * `record_ids` is non-empty
 *
 * Audit columns (`created_at`, `created_by`) are auto-populated.
 *
 * Implementation note (R-1 follow-up): all DB access flows through the
 * `UserAccessRepository` Effect port. The previous implementation read
 * `process.env.DATABASE_URL` and used `bun:sql` directly, breaking the
 * "presentation routes go through Effect Layer / Repository Tag" pattern
 * established everywhere else in src/presentation/.
 */

interface UserAccessFieldsResponse {
  readonly id: string
  readonly fields: {
    readonly user_id: string
    readonly table_slug: string
    readonly record_ids: readonly string[]
    readonly role: string
    readonly created_at: string
    readonly created_by?: string
  }
}

const toFieldsResponse = (row: Readonly<UserAccessRow>): UserAccessFieldsResponse => ({
  id: row.id,
  fields: {
    user_id: row.userId,
    table_slug: row.tableSlug,
    record_ids: row.recordIds,
    role: row.role,
    created_at: row.createdAt.toISOString(),
    ...(row.createdBy !== undefined ? { created_by: row.createdBy } : {}),
  },
})

const collectRoleNames = (app: App): readonly string[] => app.auth?.roles?.map((r) => r.name) ?? []

const collectScopeTables = (app: App): readonly string[] => app.auth?.scopeTables ?? []

const isMultiTenantConfigured = (app: App): boolean => collectScopeTables(app).length > 0

interface ContextLike {
  readonly json: (body: unknown, status?: number) => Response
}

/**
 * 404 response for apps that have not enabled `auth.scopeTables`.
 *
 * The DDL is only created when scopeTables is configured (per
 * schema-initializer step 11.5), so requests against this junction must
 * also be rejected at the API layer rather than 500-ing on a missing
 * relation.
 */
const respondNotFound = (c: ContextLike) =>
  c.json(
    { success: false, error: 'Not Found', message: 'Resource not found', code: 'NOT_FOUND' },
    404
  )

/**
 * Authorize an ADMIN caller for the grant junction.
 *
 * `user_access` decides who may see which rows of every scoped table, so
 * writing to it is privilege assignment and reading it is an enumeration of
 * the whole tenancy map. Both handlers previously checked only that a session
 * existed: any authenticated account could mint itself a grant over any record
 * id it could guess, and list every other tenant's grants.
 *
 * These routes are registered BEFORE `.use(enrichUserRole)` (`tables/index.ts`)
 * so that `validateTable` does not reject the engine-managed junction — which
 * means `c.get('userRole')` is deliberately absent here. The role is therefore
 * fetched directly rather than by rewiring the middleware order.
 *
 * Denial is **404, not 403** — the S1 anti-enumeration rule this file already
 * applies to the not-configured case, and the shape `authorizeAdminCaller`
 * (`presentation/api/routes/auth.ts`) established.
 *
 * Returns a Response when the caller is refused, or `undefined` to proceed.
 */
const authorizeUserAccessAdmin = async (
  c: Context,
  app: App,
  userId: string
): Promise<Response | undefined> => {
  const callerRole = await runDomainPromise(c, getUserRole(userId))
  // Admin-equivalent: the built-in `admin` and the app's top role.
  if (!isAdminEquivalent(callerRole, app)) return respondNotFound(c)
  return undefined
}

const respondValidationError = (c: ContextLike, message: string, field?: string) =>
  c.json(
    {
      success: false,
      message,
      code: 'VALIDATION_ERROR',
      ...(field !== undefined ? { field } : {}),
    },
    400
  )

/**
 * A repository failure, answered through `sanitizeError` (rule E5): the full
 * cause is logged server-side, and the client receives the sanitized envelope —
 * never the driver's message, which carries the SQL text and its bound values.
 */
const respondServerError = (c: Context, error: unknown) => {
  logError('[tables] user-access handler failed', error)
  return toErrorResponse(c, error)
}

interface ValidatedRow {
  readonly user_id: string
  readonly table_slug: string
  readonly record_ids: readonly string[]
  readonly role: string
}

interface ParsedJsonBody {
  readonly success: boolean
  readonly value?: unknown
}

const parseJsonBody = async (c: Context): Promise<ParsedJsonBody> => {
  try {
    const value = await c.req.json()
    return { success: true, value }
  } catch {
    return { success: false }
  }
}

const extractFields = (body: unknown): Record<string, unknown> => {
  if (body === null || typeof body !== 'object') return {}
  const obj = body as Record<string, unknown>
  if ('fields' in obj && obj['fields'] !== null && typeof obj['fields'] === 'object') {
    return obj['fields'] as Record<string, unknown>
  }
  return obj
}

/**
 * POST /api/tables/user_access/records
 *
 * Body shape (matches the canonical record envelope):
 *   { fields: { user_id, table_slug, record_ids, role } }
 *
 * Returns 201 with `{ id, fields: {...} }` on success.
 */
export async function handleCreateUserAccessRecord(c: Context, app: App): Promise<Response> {
  const session = getSessionContext(c)

  if (!session) {
    return c.json({ success: false, message: 'Authentication required', code: 'UNAUTHORIZED' }, 401)
  }

  if (!isMultiTenantConfigured(app)) {
    return respondNotFound(c)
  }

  // Minting a grant is privilege assignment — admins only. Checked BEFORE the
  // body is parsed so a non-admin learns nothing from validation feedback.
  const denied = await authorizeUserAccessAdmin(c, app, session.userId)
  if (denied) return denied

  const parsed = await parseJsonBody(c)
  if (!parsed.success) {
    return respondValidationError(c, 'Invalid JSON body')
  }

  const fields = extractFields(parsed.value)
  const validation = validateUserAccessInput(fields, {
    scopeTables: collectScopeTables(app),
    roleNames: collectRoleNames(app),
  })
  if (validation) {
    return respondValidationError(c, validation.message, validation.field)
  }

  // After validation, fields are guaranteed to be the right types.
  const validated = fields as unknown as ValidatedRow
  const result = await runUserAccessProgram(
    Effect.gen(function* () {
      const repo = yield* UserAccessRepository
      return yield* repo.insert(
        {
          userId: validated.user_id,
          tableSlug: validated.table_slug,
          recordIds: validated.record_ids,
          role: validated.role,
        },
        session.userId
      )
    })
  )

  if (result._tag === 'Failure') {
    return respondServerError(c, result.failure.cause)
  }
  // A new grant changes what the account may read: its live subscriptions are
  // closed and judged again at the handshake, with the grant included.
  closeUserConnections(validated.user_id)
  return c.json(toFieldsResponse(result.success), 201)
}

/**
 * GET /api/tables/user_access/records?user_id=...
 *
 * Returns `{ records: [{ id, fields: {...} }] }`.
 */
export async function handleListUserAccessRecords(c: Context, app: App): Promise<Response> {
  const session = getSessionContext(c)

  if (!session) {
    return c.json({ success: false, message: 'Authentication required', code: 'UNAUTHORIZED' }, 401)
  }

  if (!isMultiTenantConfigured(app)) {
    return respondNotFound(c)
  }

  // Reading the junction enumerates the whole tenancy map — admins only. The
  // `?user_id=` filter is not a substitute: it is caller-supplied, so a
  // non-admin could simply point it at somebody else.
  const denied = await authorizeUserAccessAdmin(c, app, session.userId)
  if (denied) return denied

  const userIdFilter = c.req.query('user_id')

  const result = await runUserAccessProgram(
    Effect.gen(function* () {
      const repo = yield* UserAccessRepository
      return yield* repo.list(userIdFilter === undefined ? {} : { userId: userIdFilter })
    })
  )

  if (result._tag === 'Failure') {
    return respondServerError(c, result.failure.cause)
  }
  return c.json(
    {
      records: result.success.map((row) => toFieldsResponse(row)),
    },
    200
  )
}
