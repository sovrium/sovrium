/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Use case for the admin Data-tab **Utilisateurs** account directory
 * (`GET /api/admin/users`).
 *
 * The application layer owns the pure projection:
 *   - reading every `auth.user` row via {@link UsersDirectoryRepository},
 *   - coalescing a null / empty `role` to the app default role
 *     (`DEFAULT_DIRECTORY_ROLE`) so the response schema's non-empty-role
 *     invariant always holds — WITHOUT collapsing the app's role vocabulary
 *     (a custom top role like `engineer` is preserved verbatim, unlike the
 *     overview tile which buckets into admin/operator/member),
 *   - coercing the nullable `banned` flag to a strict boolean,
 *   - assembling + response-schema-validating the `{ users }` body.
 *
 * Only the single raw read lives in the infrastructure repository. Unlike the
 * sibling overview endpoint, the directory read has NO fitting audit-catalog
 * action (`user.overview.queried` is overview-specific), so the route emits no
 * audit entry — see the route handler note.
 */

import { Effect, Layer } from 'effect'
import {
  UsersDirectoryRepository,
  type UsersDirectoryDatabaseError,
  type DirectoryUserRow,
} from '@/application/ports/repositories/tables/users-directory-repository'
import {
  adminUsersDirectoryResponseSchema,
  type AdminUsersDirectoryResponse,
} from '@/domain/models/api/admin/users'
import { UsersDirectoryRepositoryLive } from '@/infrastructure/database/repositories/tables/users-directory-repository-live'

/**
 * The fallback role for an account whose `auth.user.role` column is NULL or
 * empty. Mirrors the platform default registration role (auth `defaultRole`
 * defaults to `member`) and the directory island's existing client-side
 * `?? 'member'` fallback. An account with a real role (including a custom top
 * role like `engineer`) keeps its own role string — this only fills the gap so
 * the response schema's `role.min(1)` invariant always holds.
 */
const DEFAULT_DIRECTORY_ROLE = 'member'

/**
 * Project one raw `auth.user` row into a secret-free directory row: keep
 * `id` / `email` verbatim, coalesce a null / empty `role` to the app default,
 * and coerce the nullable `banned` flag to a strict boolean.
 */
const projectRow = (
  row: DirectoryUserRow
): Readonly<AdminUsersDirectoryResponse['users'][number]> => ({
  id: row.id,
  email: row.email,
  role: typeof row.role === 'string' && row.role.length > 0 ? row.role : DEFAULT_DIRECTORY_ROLE,
  banned: row.banned === true,
})

/**
 * Outcome of the directory build. `Ok` carries the response-schema-validated
 * body; `ValidationFailed` signals the assembled body failed the response gate
 * (the route maps this to a 500 + logs the Zod error).
 */
export type UsersDirectoryOutcome =
  | { readonly _tag: 'Ok'; readonly body: AdminUsersDirectoryResponse }
  | { readonly _tag: 'ValidationFailed'; readonly error: unknown }

/**
 * Build the `{ users }` directory body — every `auth.user` account projected to
 * the secret-free row the directory table renders, response-schema-validated.
 *
 * Returns `Ok` with the validated body or `ValidationFailed` when the assembled
 * body does not match `adminUsersDirectoryResponseSchema`.
 */
export const BuildUsersDirectory = (): Effect.Effect<
  UsersDirectoryOutcome,
  UsersDirectoryDatabaseError,
  UsersDirectoryRepository
> =>
  Effect.gen(function* () {
    const repo = yield* UsersDirectoryRepository

    const rows = yield* repo.listAllUsers()
    const body = { users: rows.map(projectRow) } satisfies AdminUsersDirectoryResponse

    const parsed = adminUsersDirectoryResponseSchema.safeParse(body)
    if (!parsed.success) {
      return { _tag: 'ValidationFailed', error: parsed.error } as const
    }
    return { _tag: 'Ok', body: parsed.data } as const
  })

/**
 * Application layer for the users-directory use case.
 */
export const UsersDirectoryLayer = Layer.mergeAll(UsersDirectoryRepositoryLive)
