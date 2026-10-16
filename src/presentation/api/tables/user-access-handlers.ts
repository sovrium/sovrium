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
import {
  listReadableGrants,
  type ReadableGrant,
} from '@/application/use-cases/tables/list-readable-grants'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { decodeOrThrow } from '@/domain/models/api/combinators/decode'
import {
  userAccessListResponseSchema,
  userAccessRecordSchema,
  type UserAccessListedRecord,
} from '@/domain/models/api/tables'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import { validateUserAccessInput } from '@/domain/models/app/tables/user-access-validation'
import { runUserAccessProgram } from '@/infrastructure/layers/table-layer'
import { logError } from '@/infrastructure/logging/logger'
import { runDomainPromise } from '@/infrastructure/logging/request-effect'
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

export const toFieldsResponse = (row: Readonly<UserAccessRow>): UserAccessFieldsResponse => ({
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

export const collectRoleNames = (app: App): readonly string[] =>
  app.auth?.roles?.map((r) => r.name) ?? []

export const collectScopeTables = (app: App): readonly string[] => app.auth?.scopeTables ?? []

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
export const respondNotFound = (c: ContextLike) =>
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

export const respondValidationError = (c: ContextLike, message: string, field?: string) =>
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
export const respondServerError = (c: Context, error: unknown) => {
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

export const parseJsonBody = async (c: Context): Promise<ParsedJsonBody> => {
  try {
    const value = await c.req.json()
    return { success: true, value }
  } catch {
    return { success: false }
  }
}

export const extractFields = (body: unknown): Record<string, unknown> => {
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
  // A new grant changes what the account may read: the repository closed its
  // live subscriptions, which are judged again at the handshake.
  return c.json(decodeOrThrow(userAccessRecordSchema)(toFieldsResponse(result.success)), 201)
}

/** One listing criterion read from the query string, absent when not given. */
const queryFilter = <K extends string>(
  c: Context,
  parameter: string,
  key: K
): Partial<Record<K, string>> => {
  const value = c.req.query(parameter)
  return value === undefined ? {} : ({ [key]: value } as Partial<Record<K, string>>)
}

/**
 * Refuse a caller who may not manage grants, before anything about the request
 * is read: 401 without a session, 404 when the app declares no scope tables or
 * the caller is not admin-equivalent (S1). `undefined` lets the caller through.
 */
export const gateUserAccessAdmin = async (c: Context, app: App): Promise<Response | undefined> => {
  const session = getSessionContext(c)
  if (!session) {
    return c.json({ success: false, message: 'Authentication required', code: 'UNAUTHORIZED' }, 401)
  }
  if (!isMultiTenantConfigured(app)) return respondNotFound(c)
  return authorizeUserAccessAdmin(c, app, session.userId)
}

/** One listed grant, shaped to its published contract. */
const toListedResponse = ({
  grant,
  account,
  recordLabels,
}: Readonly<ReadableGrant>): UserAccessListedRecord => {
  const { id, fields } = toFieldsResponse(grant)
  return {
    id,
    fields: {
      ...fields,
      ...(account === undefined ? {} : { user_email: account.email, user_name: account.name }),
      record_labels: recordLabels,
    },
  }
}

/**
 * GET /api/tables/user_access/records?user_id=...&user_email=...&table_slug=...&record_id=...
 *
 * Returns `{ records: [{ id, fields: {...} }] }`, each grant naming its account
 * by address and name and its records by their labels.
 */
export async function handleListUserAccessRecords(c: Context, app: App): Promise<Response> {
  const session = getSessionContext(c)

  if (!session) {
    return c.json({ success: false, message: 'Authentication required', code: 'UNAUTHORIZED' }, 401)
  }

  // Reading the junction enumerates the whole tenancy map — admins only. The
  // `?user_id=` filter is not a substitute: it is caller-supplied, so a
  // non-admin could simply point it at somebody else. Judged BEFORE the
  // scope-table check, so a non-admin gets the same 404 on every app.
  const denied = await authorizeUserAccessAdmin(c, app, session.userId)
  if (denied) return denied

  // An app that declares no scope tables holds no grant: to an admin, that is
  // an empty list, the true state, rather than an error to interpret.
  if (!isMultiTenantConfigured(app)) return c.json({ records: [] }, 200)

  // Each filter given narrows the listing: an account's grants (by id or by
  // address), a table's, or — with `record_id` — the grants naming one record,
  // i.e. who holds access to it.
  const filter = {
    ...queryFilter(c, 'user_id', 'userId'),
    ...queryFilter(c, 'user_email', 'userEmail'),
    ...queryFilter(c, 'table_slug', 'tableSlug'),
    ...queryFilter(c, 'record_id', 'recordId'),
  }

  const result = await runUserAccessProgram(listReadableGrants(app, filter))

  if (result._tag === 'Failure') {
    return respondServerError(c, result.failure.cause)
  }
  return c.json(
    decodeOrThrow(userAccessListResponseSchema)({
      records: result.success.map((grant) => toListedResponse(grant)),
    }),
    200
  )
}
