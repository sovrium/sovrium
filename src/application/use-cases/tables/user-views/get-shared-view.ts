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
 * enforced at the table layer: the response is only returned when the records
 * route of the view's table admits the caller (`tableReadAdmits` — her role,
 * her groups and, on a table with row-level rules, her assignment roles).
 *
 * The definition handed back is masked to the caller's field read grants: a
 * filter condition, sort, column, grouping or column width on a field the
 * caller may not read is left out.
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
import { tableReadAdmits } from '@/application/use-cases/tables/table-operations'
import { getUserAccessRoles, getUserGroups } from '@/application/use-cases/tables/user-groups'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { isFieldReadableByCaller } from '@/domain/models/app/tables/field-read-filter-service'
import { maskSavedViewDefinition } from '@/domain/models/app/tables/views/view-read-service'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
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
  UserViewRepository | AuthRepository | DataSourceRepository
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
    // The records route's own table gate: role, groups and — on a table with
    // row-level rules, and only there — the roles the caller's assignments give
    // her. Read on a table without such rules, assignments would not count.
    const accessRoles =
      targetTable.rowLevelPermissions === undefined ? [] : yield* getUserAccessRoles(input.userId)
    const caller = { role: userRole, groups: userGroups, accessRoles }
    if (!tableReadAdmits(input.app, targetTable, caller)) {
      return yield* new UserViewForbiddenError({ viewId: input.viewId })
    }

    // The view is the reader's to open, but its definition was drawn by its
    // owner: its filter conditions, sorts, columns, grouping and widths name
    // fields — and values filtered on them — the reader may not read. Each part
    // keeps only the fields the reader's role and groups read, as a config
    // view's definition does on the views routes.
    return maskSavedViewDefinition(view, (field) =>
      isFieldReadableByCaller(input.app, targetTable.name, caller, field)
    )
  }).pipe(Effect.withSpan('tables.get-shared-view'))
