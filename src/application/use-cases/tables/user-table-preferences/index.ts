/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Barrel — Personal Table Preferences use-case programs.
 *
 * Phase 9 Cycle 5 — each program returns an
 * `Effect.Effect<Result, TaggedError, UserTablePreferencesRepository>`
 * provided with `UserTablePreferencesRepositoryLive` at the composition
 * boundary. Wire types, tagged errors, and the `emptyPreferencesResponse`
 * helper are re-exported from the port so the route layer's existing
 * imports stay stable.
 */

export { deleteUserTablePreferences, type DeleteUserPreferencesInput } from './delete-preferences'
export { getUserTablePreferences, type GetUserPreferencesInput } from './get-preferences'
export { updateUserTablePreferences } from './update-preferences'
export {
  emptyPreferencesResponse,
  UserPreferencesDbError,
  UserPreferencesWriteError,
  type UpdatePreferencesResult,
  type UpdateUserTablePreferencesInput,
  type UserTablePreferencesResponse,
} from '@/application/ports/repositories/tables/user-table-preferences-repository'
