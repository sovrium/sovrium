/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Read/write access to the caller's own `auth.user.image`.
 *
 * ## Why this port exists at all
 *
 * `auth.user` is Better Auth's table, and the avatar column has to be written
 * through Better Auth's own user-update path rather than by a Sovrium-side
 * `UPDATE`: that path runs the library's update hooks and refreshes the sessions
 * it is holding, so a raw SQL write would leave whatever Better Auth has cached
 * for the caller disagreeing with the row.
 *
 * The obvious way to reach that path — calling the public `/update-user`
 * endpoint — is closed by design. `applyAvatarUrlGuard` refuses every non-null
 * client-supplied `image`, and `auth.api.updateUser` traverses the same
 * request pipeline the guard sits in, so it is refused too. That is the boundary
 * doing its job rather than an obstacle: "the server issued this URL" is a claim
 * only a server-side path can make. The implementation therefore uses Better
 * Auth's INTERNAL adapter, which is below the endpoint layer and thus below the
 * guard.
 *
 * ## Why it is a port and not an import
 *
 * The account routes are `presentation-api-route`, and `infrastructure-auth` is
 * not on that element's boundaries allow-list. Injecting this two-method object
 * from the composition root keeps the route depending on an application-layer
 * type while the Better Auth instance stays where it belongs.
 *
 * Both methods are scoped to a `userId` the caller already proved they own (it
 * comes from the session, never from a request body), so there is no
 * cross-account surface here to gate.
 */
export interface AvatarProfileStore {
  /**
   * The user's current `image` value, verbatim and unvalidated.
   *
   * Unvalidated on purpose: a row written before the guard existed can hold
   * anything, and the callers need to see the real value to decide whether it
   * names a local object worth deleting. `avatarStorageKeyFromUrl` is what
   * applies the judgement.
   */
  readonly readImage: (userId: string) => Promise<string | null>
  /** Set (or, with `null`, clear) the user's avatar. */
  readonly writeImage: (userId: string, image: string | null) => Promise<void>
}
