/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  AuthRepository,
  type AuthDatabaseError,
} from '@/application/ports/repositories/auth/auth-repository'
import {
  UserPresenceRepository,
  type UserPresenceDatabaseError,
} from '@/application/ports/repositories/auth/user-presence-repository'

/** Date her last-seen time to now: her last realtime connection has just closed. */
export const recordLastSeenProgram = (
  userId: string
): Effect.Effect<void, UserPresenceDatabaseError, UserPresenceRepository> =>
  Effect.gen(function* () {
    const repo = yield* UserPresenceRepository
    yield* repo.recordLastSeen(userId, new Date())
  }).pipe(Effect.withSpan('auth.record-last-seen'))

/** When each of these people was last seen, by user id; a person never seen is absent. */
export const lastSeenOfProgram = (
  userIds: readonly string[]
): Effect.Effect<ReadonlyMap<string, Date>, UserPresenceDatabaseError, UserPresenceRepository> =>
  Effect.gen(function* () {
    const repo = yield* UserPresenceRepository
    const seen = yield* repo.lastSeenOf(userIds)
    return new Map(seen.map((entry) => [entry.userId, entry.lastSeenAt]))
  }).pipe(Effect.withSpan('auth.last-seen-of'))

/**
 * The display name a typing indicator shows for her: her account's own name,
 * `undefined` when it is empty or she has no account — the indicator then
 * names nobody rather than an id.
 */
export const typingNameOfProgram = (
  userId: string
): Effect.Effect<string | undefined, AuthDatabaseError, AuthRepository> =>
  Effect.gen(function* () {
    const repo = yield* AuthRepository
    const contact = yield* repo.findUserContactById(userId)
    const name = contact?.name.trim() ?? ''
    return name === '' ? undefined : name
  }).pipe(Effect.withSpan('auth.typing-name-of'))
