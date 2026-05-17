/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Z-3 row-level permission enforcement orchestration.
 *
 * Bridges the pure domain evaluator (src/domain/validators/row-level-evaluator)
 * with the infrastructure-backed `user_access` lookup, returning a context
 * object the presentation handlers can use both for SQL filter projection
 * (list queries) and per-record evaluation (GET-by-id, PATCH, DELETE,
 * create.when).
 *
 * Centralising the orchestration here keeps the handlers thin: they call
 * `loadCurrentUserContext` once per request, then delegate to the pure
 * evaluator for projection/checks. The handler is responsible for
 * mapping evaluation outcomes to HTTP status codes (404 for read/write/delete
 * predicate misses, 403 for create.when violations) per the spec contract.
 */

import { Effect } from 'effect'
import { DataSourceRepository } from '@/application/ports/repositories/data-source-repository'
import { type CurrentUserContext } from '@/domain/validators/row-level-evaluator'
import type { Session } from '@/application/ports/models/user-session'
import type { RowLevelPermissions, RowLevelPredicate } from '@/domain/models/app/tables/permissions'

/**
 * Lightweight projection of a Better Auth session that the row-level
 * evaluator needs. Avoids leaking the full Better Auth user shape into
 * the domain layer.
 */
export interface SessionProjection {
  readonly userId: string
  readonly email?: string
  readonly role: string
  readonly isUnrestricted: boolean
}

/**
 * Build a `CurrentUserContext` for predicate evaluation by fetching the
 * user's `user_access` rows for every scope-table referenced in the
 * predicates.
 *
 * `scopeTables` should be the union of every `assignments.<tableSlug>`
 * referenced in the row-level predicates of the active table; passing the
 * full `auth.scopeTables` list is also fine (the cost is one extra small
 * query per scope).
 */
export const loadCurrentUserContext = (
  session: SessionProjection,
  scopeTables: readonly string[]
): Effect.Effect<CurrentUserContext, never, DataSourceRepository> =>
  Effect.gen(function* () {
    const repo = yield* DataSourceRepository

    // Fetch assignments for every requested scope-table in parallel. Errors
    // collapse to "no assignments" so a missing user_access table cannot
    // crash an unrelated read of a scoped table (the eventual filter
    // projection then yields zero rows for non-admin users).
    const entries = yield* Effect.all(
      scopeTables.map((slug) =>
        repo.fetchUserAssignments(session.userId, slug).pipe(
          Effect.catchAll(() => Effect.succeed([] as readonly string[])),
          Effect.map((ids) => [slug, ids] as const)
        )
      ),
      { concurrency: 'unbounded' }
    )

    return {
      userId: session.userId,
      email: session.email,
      role: session.role,
      isUnrestricted: session.isUnrestricted,
      assignments: new Map(entries),
    }
  })

/**
 * Extract every `assignments.<tableSlug>` referenced inside a
 * `RowLevelPermissions` block. Used to pre-fetch the right user_access
 * rows in a single batched call.
 */
export const collectAssignmentScopeTables = (
  rlp: RowLevelPermissions | undefined
): readonly string[] => {
  if (!rlp) return []
  const predicates = [
    rlp.read?.when,
    rlp.write?.when,
    rlp.create?.when,
    // eslint-disable-next-line drizzle/enforce-delete-with-where -- `delete` is a property of the RowLevelPermissions struct, not a Drizzle query.
    rlp.delete?.when,
  ]
  const slugs = predicates.flatMap(extractScopeTablesFromPredicate)
  return [...new Set(slugs)]
}

const extractTypedAssignmentSlug = (value: unknown): string | undefined => {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    !('kind' in value) ||
    (value as { kind?: string }).kind !== 'currentUser' ||
    !('path' in value)
  ) {
    return undefined
  }
  const { path } = value as { path: { kind?: string; tableSlug?: string } }
  if (path.kind === 'assignment' && typeof path.tableSlug === 'string') {
    return path.tableSlug
  }
  return undefined
}

const extractTemplateAssignmentSlug = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  if (!value.startsWith('$currentUser.assignments.')) return undefined
  const slug = value.slice('$currentUser.assignments.'.length)
  return slug.length > 0 ? slug : undefined
}

const extractScopeTablesFromPredicate = (
  predicate: RowLevelPredicate | undefined
): readonly string[] => {
  if (!predicate) return []
  const { value } = predicate
  const slug = extractTypedAssignmentSlug(value) ?? extractTemplateAssignmentSlug(value)
  return slug ? [slug] : []
}

/**
 * Convert a Better Auth `Session` to the lightweight `SessionProjection`
 * the evaluator works with. The presentation layer does this once per
 * request to keep the application boundary clean.
 */
export const toSessionProjection = (
  session: Pick<Session, 'userId'>,
  extras: { readonly email?: string; readonly role: string; readonly isUnrestricted: boolean }
): SessionProjection => ({
  userId: session.userId,
  email: extras.email,
  role: extras.role,
  isUnrestricted: extras.isUnrestricted,
})
