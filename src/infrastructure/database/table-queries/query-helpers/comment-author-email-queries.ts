/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { eq } from 'drizzle-orm'
import { Effect } from 'effect'
import { db } from '@/infrastructure/database/drizzle'
import {
  authUsersTable,
  resolveDialectSchema,
} from '@/infrastructure/database/drizzle/dialect-schema'
import { recordComments as recordCommentsPg } from '@/infrastructure/database/drizzle/schema/record-comments'
import { recordComments as recordCommentsSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/record-comments'
import { wrapDatabaseError } from '../shared/error-handling'
import { activeCommentsByRecordId } from './comment-query-predicates'
import type { Session } from '@/infrastructure/auth/better-auth/schema'
import type { SessionContextError } from '@/infrastructure/database'

const recordComments = resolveDialectSchema(recordCommentsPg, recordCommentsSqlite)

export function listCommentAuthorEmailsForRecord(config: {
  readonly session: Readonly<Session>
  readonly recordId: string
}): Effect.Effect<
  readonly { readonly userId: string; readonly email: string }[],
  SessionContextError
> {
  const { recordId } = config
  return Effect.tryPromise({
    try: async () => {
      const users = authUsersTable()
      const rows = await db
        .selectDistinct({ userId: recordComments.userId, email: users.email })
        .from(recordComments)
        .innerJoin(users, eq(recordComments.userId, users.id))
        .where(activeCommentsByRecordId(recordId))
      return rows
        .filter(
          (row): row is { userId: string; email: string } =>
            typeof row.userId === 'string' &&
            row.userId.length > 0 &&
            typeof row.email === 'string' &&
            row.email.length > 0
        )
        .map((row) => ({ userId: row.userId, email: row.email }))
    },
    catch: wrapDatabaseError('Failed to list comment author emails'),
  })
}

export function getUserEmailById(config: {
  readonly session: Readonly<Session>
  readonly userId: string
}): Effect.Effect<string | undefined, SessionContextError> {
  const { userId } = config
  return Effect.tryPromise({
    try: async () => {
      const users = authUsersTable()
      const rows = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
      const email = rows[0]?.email
      return typeof email === 'string' && email.length > 0 ? email : undefined
    },
    catch: wrapDatabaseError('Failed to resolve user email'),
  })
}

export function getUserMetadataById(config: {
  readonly session: Readonly<Session>
  readonly userId: string
}): Effect.Effect<
  { readonly id: string; readonly email: string; readonly name: string } | undefined,
  SessionContextError
> {
  const { userId } = config
  return Effect.tryPromise({
    try: async () => {
      const users = authUsersTable()
      const rows = await db
        .select({ id: users.id, email: users.email, name: users.name })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
      const row = rows[0]
      if (
        !row ||
        typeof row.id !== 'string' ||
        typeof row.email !== 'string' ||
        row.email.length === 0
      ) {
        return undefined
      }
      return {
        id: row.id,
        email: row.email,
        name: typeof row.name === 'string' ? row.name : '',
      }
    },
    catch: wrapDatabaseError('Failed to resolve user metadata'),
  })
}
