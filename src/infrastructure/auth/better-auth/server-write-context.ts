/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { AuthContext } from '@better-auth/core'

/**
 * Run one of the server's own writes through Better Auth's internal adapter
 * inside the engine's endpoint context.
 *
 * Better Auth's `user.validateUserInfo` gate refuses a user creation that runs
 * outside any endpoint context, so a write the server makes on its own (seeding
 * an account at boot, a directory provisioning one over SCIM) must carry one.
 * The context handed in is the engine's own and carries no request, no path and
 * no body: every create hook reads that exactly as it read the absent context
 * before the gate existed, as the server's own write, and the gate judges only
 * linking a social identity, which no server write does.
 *
 * Generic over the context so a caller passes its instance's own, whose type is
 * specialised to that instance's options.
 *
 * Better Auth's context module is imported when the write runs, never when this
 * module loads: the SCIM routes import this helper on every boot, and an app
 * with no `auth:` block must boot without loading any Better Auth module (the
 * lazy-load invariant held by `app-layer.test.ts`).
 */
export const runAsServerWrite = async <Context extends object, Result>(
  context: Context,
  write: () => Promise<Result>
): Promise<Result> => {
  const { runWithEndpointContext } = await import('@better-auth/core/context')
  return await runWithEndpointContext(
    // The instance's own context, which Better Auth's endpoints run with; its
    // type is specialised to the instance's options, the helper's to the
    // generic ones, and the two do not overlap enough for a single `as`.
    // eslint-disable-next-line sovrium/no-double-assertion -- same runtime object, only the options' type parameter differs
    { context: context as unknown as AuthContext },
    write
  )
}
