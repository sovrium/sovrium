/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import {
  accountDeleteRequestSchema,
  accountDeleteScheduledResponseSchema,
  accountDeleteCancelledResponseSchema,
  accountExportResponseSchema,
} from '@/domain/models/api/account/account'
import { sanitizeTableName } from '@/domain/utils/table-naming'
import { db } from '@/infrastructure/database'
import { purgeDueAccounts } from '@/infrastructure/database/account-purge'
import { authTableRef } from '@/infrastructure/database/drizzle/dialect-schema'
import { executeRaw, executeRawTyped } from '@/infrastructure/database/sql/dialect-execute'
import { AUTHORSHIP_FIELDS } from '@/infrastructure/database/table-queries/mutation-helpers/authorship-helpers'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'


const GRACE_PERIOD_DAYS = 7

const SCHEDULER_TOKEN_ENV = 'INTERNAL_SCHEDULER_TOKEN'

const SCHEDULER_TOKEN_HEADER = 'X-Internal-Scheduler-Token'

const unauthorized = (c: Context) =>
  c.json({ success: false, message: 'Authentication required', code: 'UNAUTHORIZED' }, 401)


interface UserRow {
  readonly id: string
  readonly email: string
  readonly name: string | null
  readonly image: string | null
  readonly emailVerified: boolean
  readonly role: string | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

interface SessionRow {
  readonly id: string
  readonly userId: string
  readonly expiresAt: Date
  readonly ipAddress: string | null
  readonly userAgent: string | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

interface AccountRow {
  readonly id: string
  readonly userId: string
  readonly providerId: string
  readonly accountId: string
  readonly scope: string | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

async function tablesWithCreatedBy(tableNames: readonly string[]): Promise<readonly string[]> {
  const sanitized = [...new Set(tableNames.map(sanitizeTableName))].filter((n) => n.length > 0)
  if (sanitized.length === 0) return []

  const nameList = sql.join(
    sanitized.map((name) => sql`${name}`),
    sql`, `
  )
  const rows = (await db.execute(
    sql`SELECT DISTINCT table_name FROM information_schema.columns
        WHERE table_schema = 'public'
          AND column_name = ${AUTHORSHIP_FIELDS.CREATED_BY}
          AND table_name IN (${nameList})`
  )) as unknown as readonly { table_name: string }[]
  return rows.map((row) => row.table_name)
}

async function collectAuthoredRecords(
  userId: string,
  appTables: readonly { readonly name: string }[]
): Promise<
  readonly {
    tableSlug: string
    recordId: string
    fields: Record<string, unknown>
    createdAt: string
    updatedAt: string
  }[]
> {
  const recordTables = await tablesWithCreatedBy(appTables.map((t) => t.name))

  const perTable = await Promise.all(
    recordTables.map(async (tableName) => {
      const rows = (await db.execute(
        sql`SELECT * FROM ${sql.identifier(tableName)} WHERE ${sql.identifier(AUTHORSHIP_FIELDS.CREATED_BY)} = ${userId}`
      )) as unknown as readonly Record<string, unknown>[]

      return rows.map((row) => {
        const recordId = row['id']
        const createdAt = row['created_at']
        const updatedAt = row['updated_at']
        const fields = Object.fromEntries(
          Object.entries(row).filter(
            ([key]) => key !== 'id' && key !== 'created_at' && key !== 'updated_at'
          )
        )
        return {
          tableSlug: tableName,
          recordId: String(recordId),
          fields,
          createdAt: new Date(String(createdAt)).toISOString(),
          updatedAt: new Date(String(updatedAt ?? createdAt)).toISOString(),
        }
      })
    })
  )

  return perTable.flat()
}

function normalizeRole(role: string | null): 'admin' | 'member' | 'viewer' {
  return role === 'admin' || role === 'viewer' ? role : 'member'
}

function buildExportPayload(
  user: UserRow,
  sessionRows: readonly SessionRow[],
  accountRows: readonly AccountRow[],
  authoredRecords: Awaited<ReturnType<typeof collectAuthoredRecords>>
) {
  return {
    exportedAt: new Date().toISOString(),
    format: 'json' as const,
    schemaVersion: '1.0' as const,
    profile: {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      emailVerified: user.emailVerified,
      role: normalizeRole(user.role),
      createdAt: new Date(user.createdAt).toISOString(),
      updatedAt: new Date(user.updatedAt).toISOString(),
    },
    sessions: sessionRows.map((s) => ({
      id: s.id,
      userId: s.userId,
      expiresAt: new Date(s.expiresAt).toISOString(),
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      createdAt: new Date(s.createdAt).toISOString(),
      updatedAt: new Date(s.updatedAt).toISOString(),
    })),
    accounts: accountRows.map((a) => ({
      id: a.id,
      userId: a.userId,
      providerId: a.providerId,
      accountId: a.accountId,
      scope: a.scope,
      createdAt: new Date(a.createdAt).toISOString(),
      updatedAt: new Date(a.updatedAt).toISOString(),
    })),
    authoredRecords,
  }
}

async function handleExport(c: Context, app: App): Promise<Response> {
  const session = getSessionContext(c)
  if (session === undefined) return unauthorized(c)
  const { userId } = session

  const userRows = await executeRawTyped<UserRow>(
    db,
    sql`SELECT id, email, name, image, email_verified AS "emailVerified",
               role, created_at AS "createdAt", updated_at AS "updatedAt"
        FROM ${authTableRef('user')} WHERE id = ${userId}`
  )

  const user = userRows[0]
  if (user === undefined) return unauthorized(c)

  const sessionRows = await executeRawTyped<SessionRow>(
    db,
    sql`SELECT id, user_id AS "userId", expires_at AS "expiresAt",
               ip_address AS "ipAddress", user_agent AS "userAgent",
               created_at AS "createdAt", updated_at AS "updatedAt"
        FROM ${authTableRef('session')} WHERE user_id = ${userId}`
  )

  const accountRows = await executeRawTyped<AccountRow>(
    db,
    sql`SELECT id, user_id AS "userId", provider_id AS "providerId",
               account_id AS "accountId", scope,
               created_at AS "createdAt", updated_at AS "updatedAt"
        FROM ${authTableRef('account')} WHERE user_id = ${userId}`
  )

  const authoredRecords = await collectAuthoredRecords(userId, app.tables ?? [])

  const validated = accountExportResponseSchema.parse(
    buildExportPayload(user, sessionRows, accountRows, authoredRecords)
  )
  return c.json(validated, 200)
}


async function handleDelete(c: Context): Promise<Response> {
  const session = getSessionContext(c)
  if (session === undefined) return unauthorized(c)
  const { userId } = session

  const rawBody = await c.req.json().catch(() => undefined)
  const parsed = accountDeleteRequestSchema.safeParse(rawBody)
  if (!parsed.success) {
    return c.json(
      { success: false, message: 'A confirm or cancel flag is required', code: 'BAD_REQUEST' },
      400
    )
  }

  if ('cancel' in parsed.data) {
    await executeRaw(
      db,
      sql`UPDATE ${authTableRef('user')} SET "scheduledErasureAt" = NULL WHERE id = ${userId}`
    )
    return c.json(accountDeleteCancelledResponseSchema.parse({ status: 'cancelled' }), 200)
  }

  const scheduledErasureAt = new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000)

  await db.transaction(async (tx) => {
    await executeRaw(
      tx,
      sql`UPDATE ${authTableRef('user')} SET "scheduledErasureAt" = ${scheduledErasureAt} WHERE id = ${userId}`
    )
    await executeRaw(tx, sql`DELETE FROM ${authTableRef('session')} WHERE user_id = ${userId}`)
  })

  return c.json(
    accountDeleteScheduledResponseSchema.parse({
      status: 'scheduled',
      scheduledErasureAt: scheduledErasureAt.toISOString(),
      gracePeriodDays: GRACE_PERIOD_DAYS,
      cancellable: true,
    }),
    202
  )
}


function tokensMatch(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false
  let mismatch = 0
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= provided.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return mismatch === 0
}

async function handlePurgeDue(c: Context, app: App): Promise<Response> {
  const expectedToken = process.env[SCHEDULER_TOKEN_ENV]
  if (expectedToken === undefined || expectedToken.length === 0) {
    return c.json({ success: false, message: 'Not Found', code: 'NOT_FOUND' }, 404)
  }

  const providedToken = c.req.header(SCHEDULER_TOKEN_HEADER)
  if (providedToken === undefined || !tokensMatch(providedToken, expectedToken)) {
    return c.json({ success: false, message: 'Not Found', code: 'NOT_FOUND' }, 404)
  }

  const purgedCount = await purgeDueAccounts((app.tables ?? []).map((t) => t.name))
  return c.json({ status: 'ok', purgedCount }, 200)
}

export function chainAccountRoutes<T extends Hono>(honoApp: T, app: App): T {
  return honoApp
    .get('/api/account/export', async (c) => handleExport(c, app))
    .post('/api/account/delete', async (c) => handleDelete(c))
    .post('/api/account/purge-due', async (c) => handlePurgeDue(c, app)) as T
}
