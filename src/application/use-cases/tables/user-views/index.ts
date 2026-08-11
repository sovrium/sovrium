/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Barrel — Personal Saved Views use-case programs.
 *
 * Phase 9 Cycle 5 — each program returns an
 * `Effect.Effect<Result, TaggedError, UserViewRepository>` that the
 * presentation layer consumes through `Effect.runPromise` with the
 * `UserViewRepositoryLive` Layer provided at the composition boundary.
 *
 * The wire-response type + tagged errors are re-exported from the
 * `UserViewRepository` port so the route layer's existing imports stay
 * stable; `UserViewForbiddenError` is an application-orchestration concern
 * and lives with `getSharedView`.
 */

export { createUserView } from './create-view'
export { deleteUserView, type DeleteUserViewInput } from './delete-view'
export { getSharedView, UserViewForbiddenError, type GetSharedViewInput } from './get-shared-view'
export { listUserViews, type ListUserViewsInput } from './list-views'
export { updateUserView } from './update-view'

export {
  UserViewConflictError,
  UserViewDbError,
  UserViewNotFoundError,
  type CreateUserViewInput,
  type UpdateUserViewInput,
  type UserViewResponse,
} from '@/application/ports/repositories/tables/user-view-repository'
