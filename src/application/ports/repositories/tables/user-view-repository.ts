/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * UserViewRepository port — data-access contract for the Personal Saved
 * Views feature (PG-03 / [internal ref]).
 *
 * Phase 9 Cycle 5 — extracted from the use-case programs that previously
 * injected the `Database` Context.Tag directly and ran inline Drizzle
 * queries. The live implementation
 * (`@/infrastructure/database/repositories/tables/user-view-repository-live`) now
 * owns ALL Drizzle queries plus the dialect-aware `config` JSONB codec and
 * the DB-row → wire-response transform; the use-cases became thin
 * orchestrators that consume this port.
 *
 * The repository returns the JSON-serializable `UserViewResponse` wire shape
 * directly (the DB-row mapping is a persistence concern). Use-cases map only
 * application-level state (e.g. permission decisions) on top of it; the route
 * layer validates the result through `userViewResponseSchema` for OpenAPI
 * contract enforcement (S4: never return raw DB rows).
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

/**
 * Wire representation of a saved view — the JSON-serializable shape that
 * routes return. The `config` JSONB blob is decoded into the flat
 * filters/sorts/fields/groupBy/baseViewId fields the client expects.
 */
export interface UserViewResponse {
  readonly id: string
  readonly name: string
  readonly tableName: string
  readonly isDefault: boolean
  readonly filters?: unknown
  readonly sorts?: unknown
  readonly fields?: unknown
  readonly groupBy?: unknown
  readonly baseViewId?: string | number | null
  /**
   * Presentation state — the shape the view was captured in, plus the
   * layout it expresses an opinion about. Absent means "this view said
   * nothing", which the client resolves against the user's own
   * `user-preferences` row rather than overriding it.
   */
  readonly viewType?: unknown
  readonly rowDensity?: unknown
  readonly columnWidths?: unknown
  readonly createdAt: string
  readonly updatedAt: string
}

/**
 * Payload accepted by `create`. Validation happens at the route boundary
 * (the existing `parseCreatePayload` shape check); this type is the
 * post-validation contract.
 */
export interface CreateUserViewInput {
  readonly userId: string
  readonly tableName: string
  readonly name: string
  readonly filters?: unknown
  readonly sorts?: unknown
  readonly fields?: unknown
  readonly groupBy?: unknown
  /** Presentation state — see {@link UserViewResponse}. */
  readonly viewType?: unknown
  readonly rowDensity?: unknown
  readonly columnWidths?: unknown
  readonly baseViewId?: string | number
  readonly isDefault?: boolean
}

/**
 * Payload accepted by `update`. Every field is optional (PATCH semantics);
 * the repository loads the existing row and merges.
 */
export interface UpdateUserViewInput {
  readonly userId: string
  readonly tableName: string
  readonly viewId: string
  readonly name?: string
  readonly isDefault?: boolean
  readonly filters?: unknown
  readonly sorts?: unknown
  readonly fields?: unknown
  readonly groupBy?: unknown
  /** Presentation state — see {@link UserViewResponse}. */
  readonly viewType?: unknown
  readonly rowDensity?: unknown
  readonly columnWidths?: unknown
  readonly baseViewId?: string | number | null
}

/** Lookup payload for `getShared` — by view id only (cross-table by design). */
export interface GetSharedViewRow {
  readonly viewId: string
}

/** View was not found OR caller does not own it (404 surface). */
export class UserViewNotFoundError extends Data.TaggedError('UserViewNotFoundError')<{
  readonly viewId?: string
}> {}

/**
 * Unique-name violation on `(user_id, table_name, name)` — translated to
 * HTTP 409 by the route handler.
 */
export class UserViewConflictError extends Data.TaggedError('UserViewConflictError')<{
  readonly message: string
}> {}

/**
 * Catch-all infrastructure failure (DB connection / unexpected SQL error).
 * Route handler maps to HTTP 500.
 */
export class UserViewDbError extends Data.TaggedError('UserViewDbError')<{
  readonly cause: unknown
}> {}

/**
 * UserViewRepository port.
 *
 * Backs `system.user_saved_views`. Saved views are strictly per-user for the
 * CRUD operations — `list/create/update/delete` all scope to `userId`.
 * `getShared` is the exception: it resolves a view by id only (the share
 * endpoint is callable by any authenticated user) and leaves table-level
 * permission enforcement to the use-case orchestrator.
 */
export class UserViewRepository extends Context.Tag('UserViewRepository')<
  UserViewRepository,
  {
    /** List the caller's saved views for `tableName`, ordered oldest-first. */
    readonly list: (input: {
      readonly userId: string
      readonly tableName: string
    }) => Effect.Effect<readonly UserViewResponse[], UserViewDbError>

    /**
     * Insert a saved view. A unique-name collision on
     * `(user_id, table_name, name)` surfaces as `UserViewConflictError`;
     * a zero-row insert surfaces as `UserViewNotFoundError`.
     */
    readonly create: (
      input: CreateUserViewInput
    ) => Effect.Effect<
      UserViewResponse,
      UserViewConflictError | UserViewDbError | UserViewNotFoundError
    >

    /**
     * Update an existing saved view the caller owns (scoped to
     * `(viewId, userId, tableName)`). A missing/unowned row surfaces as
     * `UserViewNotFoundError`; a duplicate-name collision as
     * `UserViewConflictError`.
     */
    readonly update: (
      input: UpdateUserViewInput
    ) => Effect.Effect<
      UserViewResponse,
      UserViewConflictError | UserViewDbError | UserViewNotFoundError
    >

    /**
     * Delete a saved view the caller owns (scoped to
     * `(viewId, userId, tableName)`). A non-deleting query surfaces as
     * `UserViewNotFoundError`.
     */
    readonly delete: (input: {
      readonly userId: string
      readonly tableName: string
      readonly viewId: string
    }) => Effect.Effect<void, UserViewDbError | UserViewNotFoundError>

    /**
     * Resolve a saved view by id WITHOUT ownership scoping (shared-view
     * lookup). Returns the wire-response shape — the use-case reads
     * `view.tableName` to run table-level permission enforcement. A missing
     * row surfaces as `UserViewNotFoundError`.
     */
    readonly getShared: (
      input: GetSharedViewRow
    ) => Effect.Effect<UserViewResponse, UserViewDbError | UserViewNotFoundError>
  }
>() {}
