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
import { isIssuedAvatarUrl } from '@/domain/models/app/auth/avatar-url'

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

/** What a presence entry shows of her: a display name, and an avatar URL when she has one. */
export interface PresenceProfile {
  readonly name: string
  readonly avatarUrl: string | undefined
}

/**
 * Her presence profile: her account's name, or `'User'` when it is empty or
 * she has no account — presence never blanks out a connected colleague.
 *
 * The avatar is kept only when it is a URL this instance issued. Presence is
 * the one reader whose value reaches an actual `<img src>` in somebody ELSE's
 * browser (`presence-indicator-island.tsx`), so an off-origin URL here is a
 * tracking pixel that leaks every viewer's IP and user-agent to whoever the
 * pictured user named. New writes can no longer set one — the auth `before`
 * hook refuses them — but a row written before that guard existed can still
 * hold anything, so the render path checks rather than trusts. An
 * unrecognised value degrades to the initials avatar, which is what a user
 * with no avatar already gets.
 */
export const presenceProfileOfProgram = (
  userId: string
): Effect.Effect<PresenceProfile, AuthDatabaseError, AuthRepository> =>
  Effect.gen(function* () {
    const repo = yield* AuthRepository
    const row = yield* repo.findUserProfileById(userId)
    const name = row?.name ?? ''
    return {
      name: name.length > 0 ? name : 'User',
      avatarUrl: isIssuedAvatarUrl(row?.image) ? row.image : undefined,
    }
  }).pipe(Effect.withSpan('auth.presence-profile-of'))
