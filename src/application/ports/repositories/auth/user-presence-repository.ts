/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data, type Effect } from 'effect'

/** Database error for last-seen operations. */
export class UserPresenceDatabaseError extends Data.TaggedError('UserPresenceDatabaseError')<{
  readonly cause: unknown
}> {}

/** When one person was last seen. */
export interface LastSeen {
  readonly userId: string
  readonly lastSeenAt: Date
}

/**
 * `system.user_presence` port — when each person's last realtime connection
 * closed, kept under `auth.presence.lastSeen`.
 */
export class UserPresenceRepository extends Context.Service<
  UserPresenceRepository,
  {
    /** Record that her last connection closed at `at`. */
    readonly recordLastSeen: (
      userId: string,
      at: Date
    ) => Effect.Effect<void, UserPresenceDatabaseError>

    /** When each of these people was last seen; a person never seen is absent. */
    readonly lastSeenOf: (
      userIds: readonly string[]
    ) => Effect.Effect<readonly LastSeen[], UserPresenceDatabaseError>
  }
>()('UserPresenceRepository') {}
