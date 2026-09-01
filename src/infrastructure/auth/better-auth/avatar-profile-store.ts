/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { createAuthInstance } from './auth'
import type { AvatarProfileStore } from '@/application/ports/models/avatar-profile-store'

type AuthInstance = Readonly<ReturnType<typeof createAuthInstance>>

/**
 * {@link AvatarProfileStore} over Better Auth's INTERNAL adapter.
 *
 * ## Why the internal adapter, and not `auth.api.updateUser`
 *
 * `applyAvatarUrlGuard` is a `before` hook on `/update-user`, and `auth.api.*`
 * calls traverse the same endpoint pipeline as an HTTP request — so persisting
 * through the public API would be refused by Sovrium's own guard. The internal
 * adapter sits BELOW the endpoint layer, which is exactly the distinction the
 * guard encodes: a client may only clear the column, while setting it is a
 * server-side act performed by code that just wrote the bytes and therefore
 * knows what URL it issued.
 *
 * This is not a way around the guard. Reaching this function at all requires
 * having already uploaded and decoded an image on the server, which is the fact
 * the guard exists to insist on.
 *
 * ## Why not a plain `UPDATE auth.user SET image = …`
 *
 * `internalAdapter.updateUser` runs Better Auth's own update hooks and then
 * `refreshUserSessions`, which re-writes the user snapshot the library holds for
 * every live session of that user. A raw SQL write skips both, so anything
 * Better Auth had cached would keep serving the OLD avatar until the session
 * expired. Sovrium configures neither `session.cookieCache` nor a secondary
 * store today, so that refresh is currently a no-op — but it becomes load-bearing
 * the moment either is enabled, and going through the library's own path means
 * this code does not have to be revisited then.
 *
 * `$context` is a promise resolved once per auth instance and memoised by Better
 * Auth, so awaiting it per call costs nothing after the first.
 */
export function createAvatarProfileStore(auth: AuthInstance): AvatarProfileStore {
  return {
    readImage: async (userId) => {
      const { internalAdapter } = await auth.$context
      const user = await internalAdapter.findUserById(userId)
      // eslint-disable-next-line unicorn/no-null -- `null` is this column's own "no avatar" value, and the port's declared contract
      return user?.image ?? null
    },
    writeImage: async (userId, image) => {
      const { internalAdapter } = await auth.$context
      // eslint-disable-next-line functional/no-expression-statements -- persistence side effect
      await internalAdapter.updateUser(userId, { image })
    },
  }
}
