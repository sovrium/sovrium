/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Look up a saved view by id with TABLE-level permission enforcement.
 *
 * Phase 9 Cycle 5 — the DB lookup moved to the `UserViewRepository` port
 * (`getShared`); this program keeps the application-layer orchestration:
 * resolving the caller's effective roles and gating on the bound table's
 * read permission.
 *
 * Unlike `listUserViews` / `updateUserView` (per-user-scoped), the share
 * endpoint must be callable by any authenticated user. Authorisation is
 * enforced at the table layer: the response is only returned when the
 * session's effective roles satisfy `app.tables[view.tableName].permissions.read`.
 *
 * Anti-enumeration: missing view AND permission denial BOTH surface as
 * `UserViewNotFoundError` / `UserViewForbiddenError`; the route maps either
 * to HTTP 404 so callers cannot probe whether the view or the bound table
 * exists.
 */

import { Data, Effect } from 'effect'
import {
  UserViewDbError,
  UserViewNotFoundError,
  UserViewRepository,
  type UserViewResponse,
} from '@/application/ports/repositories/tables/user-view-repository'
import { buildEffectiveRoles, getUserGroups } from '@/application/use-cases/tables/user-groups'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { hasReadPermissionForRoles } from '@/domain/models/app/auth/permission-evaluator-service'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { App } from '@/domain/models/app'

/**
 * Permission denial for shared-view lookup — the caller's effective roles
 * do not satisfy the table's read permission. The route maps this to 404
 * (anti-enumeration: never confirm the view exists).
 */
export class UserViewForbiddenError extends Data.TaggedError('UserViewForbiddenError')<{
  readonly viewId: string
}> {}

export interface GetSharedViewInput {
  readonly userId: string
  readonly viewId: string
  readonly app: App
}

/**
 * Resolve a shared saved view by id. Surfaces `UserViewNotFoundError` when:
 *  - the view row does not exist
 *  - the view's bound table is no longer part of the live app
 *
 * Surfaces `UserViewForbiddenError` when the caller's effective roles fail
 * the table's read permission (the route layer also maps this to 404 for
 * anti-enumeration symmetry).
 */
export const getSharedView = (
  input: GetSharedViewInput
): Effect.Effect<
  UserViewResponse,
  UserViewDbError | UserViewForbiddenError | UserViewNotFoundError,
  UserViewRepository | AuthRepository
> =>
  Effect.gen(function* () {
    const repo = yield* UserViewRepository
    const view = yield* repo.getShared({ viewId: input.viewId })

    const targetTable = (input.app.tables ?? []).find((t) => t.name === view.tableName)
    if (!targetTable) {
      return yield* new UserViewNotFoundError({ viewId: input.viewId })
    }

    // The shared-views path is NOT mounted under `/api/tables/*`, so the
    // `enrichUserRole` middleware that normally hydrates the role/groups
    // onto the context never runs here — resolve them inline so the
    // permission gate can evaluate `group:<name>` predicates the same way
    // the record handlers do. `getUserRole` / `getUserGroups` are async
    // (Promise-returning) so each is wrapped in its own `Effect.tryPromise`.
    //
    // FAN-OUT WIDTH: 2, and structurally so — this is a fixed two-element
    // tuple, not a `.map()` over a collection, so no caller input and no
    // config can widen it. Both reads hit the SHARED connection pool through
    // the `AuthRepository` this use case declares, which is why the width is
    // stated rather than left to a
    // raw `Promise.all`: expressed as `Effect.all` the ceiling is a required,
    // reviewable argument. See the QUERY BUDGET note in
    // `infrastructure/database/repositories/tables/tables-overview-repository-live.ts`
    // for the 2026-07-25 pool-exhaustion incident this discipline comes from.
    const [userRole, userGroups] = yield* Effect.all(
      [
        getUserRole(input.userId).pipe(Effect.mapError((cause) => new UserViewDbError({ cause }))),
        getUserGroups(input.userId),
      ],
      { concurrency: 2 }
    )
    const effectiveRoles = buildEffectiveRoles(userRole, userGroups)
    if (!hasReadPermissionForRoles(targetTable, effectiveRoles, input.app.tables)) {
      return yield* new UserViewForbiddenError({ viewId: input.viewId })
    }

    return view
  }).pipe(Effect.withSpan('tables.get-shared-view'))
