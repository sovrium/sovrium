/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { count } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import { type Hono, type Context } from 'hono'
import { claimBootstrapToken } from '@/application/use-cases/auth/bootstrap-token'
import { db } from '@/infrastructure/database'
import { authUsersTable } from '@/infrastructure/database/drizzle/dialect-schema'
import { AuthRepositoryLive } from '@/infrastructure/database/repositories/auth-repository-live'
import { BootstrapTokenRepositoryLive } from '@/infrastructure/database/repositories/bootstrap-token-repository-live'
import { logError } from '@/infrastructure/logging/logger'
import type { App } from '@/domain/models/app'

interface ClaimRequestBody {
  readonly email?: unknown
  readonly password?: unknown
  readonly name?: unknown
}

const isBootstrapMode = async (): Promise<boolean> => {
  if (process.env.AUTH_ADMIN_EMAIL) return false
  try {
    const users = authUsersTable()
    const rows = await db.select({ value: count() }).from(users)
    const userCount = Number(rows[0]?.value ?? 0)
    return userCount === 0
  } catch {
    return false
  }
}

const extractBearer = (header: string | undefined): string | undefined => {
  if (!header || !header.toLowerCase().startsWith('bearer ')) return undefined
  return header.slice(7).trim() || undefined
}

const isString = (v: unknown): v is string => typeof v === 'string' && v.length > 0

const parseClaimBody = async (
  request: Readonly<Request>
): Promise<ClaimRequestBody | undefined> => {
  try {
    return (await request.json()) as ClaimRequestBody
  } catch {
    return undefined
  }
}

interface ValidatedBody {
  readonly token: string
  readonly email: string
  readonly password: string
  readonly name: string
}

const runClaim = (validated: ValidatedBody, authConfig: NonNullable<App['auth']>) =>
  Effect.gen(function* () {
    const { createAuthLayer } = yield* Effect.promise(
      () => import('@/infrastructure/auth/better-auth/layer')
    )
    const combined = Layer.mergeAll(
      BootstrapTokenRepositoryLive,
      AuthRepositoryLive,
      createAuthLayer(authConfig)
    )
    return yield* claimBootstrapToken(validated).pipe(Effect.provide(combined))
  })

const handleClaim = async (c: Context, app: App) => {
  if (!app.auth) {
    return c.json({ error: 'Bootstrap not available' }, 404)
  }

  if (!(await isBootstrapMode())) {
    return c.json({ error: 'Bootstrap not available' }, 404)
  }

  const token = extractBearer(c.req.header('authorization'))
  if (!token) {
    return c.json({ error: 'Missing bootstrap token' }, 401)
  }

  const body = await parseClaimBody(c.req.raw)
  if (body === undefined) {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  if (!isString(body.email) || !isString(body.password) || !isString(body.name)) {
    return c.json({ error: 'Missing required fields: email, password, name' }, 400)
  }

  const result = await Effect.runPromise(
    runClaim({ token, email: body.email, password: body.password, name: body.name }, app.auth).pipe(
      Effect.either
    )
  )

  if (result._tag === 'Left') {
    const err = result.left
    switch (err._tag) {
      case 'BootstrapTokenNotFoundError':
      case 'BootstrapTokenExpiredError':
      case 'BootstrapTokenAlreadyUsedError':
        return c.json({ error: 'Invalid or expired bootstrap token' }, 401)
      case 'BootstrapAdminCreationError':
        logError('[bootstrap] admin creation failed', err.cause as Error)
        return c.json({ error: 'Failed to create admin user' }, 500)
      default:
        logError('[bootstrap] database error', err as unknown as Error)
        return c.json({ error: 'Internal server error' }, 500)
    }
  }

  return c.json({ success: true, userId: result.right.userId, email: result.right.email }, 200)
}

export const setupBootstrapRoutes = (honoApp: Readonly<Hono>, app: App): Readonly<Hono> =>
  honoApp.post('/api/admin/bootstrap/claim', (c) => handleClaim(c, app))
