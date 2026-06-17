/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { ConnectionRepository } from '@/application/ports/repositories/connections/connection-repository'
import { ConnectionTokenRepository } from '@/application/ports/repositories/connections/connection-token-repository'
import { notFound, requireSession, unauthorized } from '@/presentation/api/utils/auth-helpers'
import { provideConnectionLive } from './effect-runner'
import { connectionError } from './error-envelopes'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

class UsersHandlerError extends Data.TaggedError('UsersHandlerError')<{
  readonly operation: string
  readonly cause: unknown
}> {}

interface ConnectionDef {
  readonly name: string
  readonly type: string
}

const findConnection = (app: App, name: string): ConnectionDef | undefined => {
  const list = (app as { connections?: readonly ConnectionDef[] }).connections ?? []
  return list.find((conn) => conn.name === name)
}

const resolveUserRole = async (userId: string): Promise<string> => {
  const { getUserRole } = await import('@/application/use-cases/tables/user-role')
  return getUserRole(userId)
}

const deriveAdminStatus = (expiresAt: Date | undefined): 'connected' | 'expired' => {
  if (expiresAt !== undefined && expiresAt.getTime() < Date.now()) return 'expired'
  return 'connected'
}

const dropAdminUsers = async <T extends { readonly userId: string }>(
  entries: readonly T[]
): Promise<readonly T[]> => {
  const roles = await Promise.all(entries.map((entry) => resolveUserRole(entry.userId)))
  return entries.filter((_, index) => roles[index] !== 'admin')
}

export async function handleListUsers(c: Context, app: App) {
  const session = requireSession(c)
  if (session === undefined) return unauthorized(c)
  const name = c.req.param('name')
  if (name === undefined) return connectionError(c, 400, 'connection_name_required')
  const conn = findConnection(app, name)
  if (conn === undefined) return notFound(c, 'Connection not found')

  const role = await resolveUserRole(session.userId)
  if (role !== 'admin') return notFound(c, 'Connection not found')

  if (conn.type !== 'oauth2') {
    return connectionError(c, 400, 'connection_not_oauth2', {
      message: 'This endpoint applies only to OAuth2 connections.',
    })
  }

  const program = Effect.gen(function* () {
    const connRepo = yield* ConnectionRepository
    const row = yield* connRepo
      .findByName(name)
      .pipe(Effect.mapError((cause) => new UsersHandlerError({ operation: 'findByName', cause })))
    if (row === undefined) return []
    const tokenRepo = yield* ConnectionTokenRepository
    return yield* tokenRepo
      .listUsersForConnection({ connectionId: String(row['id']) })
      .pipe(
        Effect.mapError(
          (cause) => new UsersHandlerError({ operation: 'listUsersForConnection', cause })
        )
      )
  })

  const result = await Effect.runPromise(provideConnectionLive(program).pipe(Effect.either))
  if (result._tag === 'Left') {
    console.error('[connections] list users failed', result.left)
    return connectionError(c, 500, 'list_users_failed')
  }
  const memberEntries = await dropAdminUsers(result.right)
  const users = memberEntries.map((entry) => ({
    userId: entry.userId,
    status: deriveAdminStatus(entry.expiresAt),
    expiresAt: entry.expiresAt?.toISOString() ?? null,
  }))
  return c.json({ users }, 200)
}
