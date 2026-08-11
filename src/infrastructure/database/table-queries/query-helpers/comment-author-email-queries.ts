/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * GAP-13 email-resolution queries for the comment-posted trigger.
 *
 * Split from `comment-queries.ts` (which is at the 400-line cap) so the
 * email-addressable `threadParticipants` derivation lives next to the other
 * comment query helpers without breaching the size budget.
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
import type { DatabaseError } from '@/infrastructure/database'

const recordComments = resolveDialectSchema(recordCommentsPg, recordCommentsSqlite)

/**
 * Distinct EMAIL ADDRESSES of every comment author on a given record
 * (excluding soft-deleted comments and guest authors). Powers GAP-13: the
 * comment-posted trigger's `threadParticipants` must be email-addressable so
 * `{{trigger.threadParticipants}}` is usable directly as an `email.send`
 * `to`. JOINs `recordComments.userId` → `auth.user.email`; the resulting
 * list is filtered to drop the newly-created comment's own author by the
 * trigger so the notification fans out to the OTHER participants only.
 */
export function listCommentAuthorEmailsForRecord(config: {
  readonly session: Readonly<Session>
  readonly recordId: string
}): Effect.Effect<readonly { readonly userId: string; readonly email: string }[], DatabaseError> {
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

/**
 * Resolve a single user id to their email address (GAP-13 owner fallback).
 * Used when a record's FIRST comment yields no prior-author thread
 * participants — the trigger falls back to the record OWNER's email so a
 * notify-thread automation still has a recipient. Returns `undefined` when
 * the user row is missing.
 */
export function getUserEmailById(config: {
  readonly session: Readonly<Session>
  readonly userId: string
}): Effect.Effect<string | undefined, DatabaseError> {
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

/**
 * Resolve a single user id to `{ id, email, name }` (GAP-20 record-event
 * trigger USER-field hydration). Reuses the same `auth.user` lookup
 * mechanism as `getUserEmailById`, just projecting the display `name`
 * alongside the email so a record-event envelope can hydrate `user`-typed
 * fields — `{{trigger.data.record.<userField>.email}}` / `.name` / `.id`
 * resolve against the returned object instead of the bare id string.
 * Returns `undefined` when the user row is missing or has no email.
 */
export function getUserMetadataById(config: {
  readonly session: Readonly<Session>
  readonly userId: string
}): Effect.Effect<
  { readonly id: string; readonly email: string; readonly name: string } | undefined,
  DatabaseError
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
