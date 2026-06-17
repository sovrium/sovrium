/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import { isPredicateGroup, type CurrentUserContext } from '@/domain/validators/row-level-evaluator'
import type { Session } from '@/application/ports/models/user-session'
import type { RowLevelPermissions, RowLevelWhen } from '@/domain/models/app/tables/permissions'

export interface SessionProjection {
  readonly userId: string
  readonly email?: string
  readonly role: string
  readonly isUnrestricted: boolean
}

export const loadCurrentUserContext = (
  session: SessionProjection,
  scopeTables: readonly string[]
): Effect.Effect<CurrentUserContext, never, DataSourceRepository> =>
  Effect.gen(function* () {
    const repo = yield* DataSourceRepository

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

export const collectAssignmentScopeTables = (
  rlp: RowLevelPermissions | undefined
): readonly string[] => {
  if (!rlp) return []
  const predicates = [
    rlp.read?.when,
    rlp.write?.when,
    rlp.create?.when,
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
  predicate: RowLevelWhen | undefined
): readonly string[] => {
  if (!predicate) return []
  if (isPredicateGroup(predicate)) {
    return predicate.conditions.flatMap(extractScopeTablesFromPredicate)
  }
  const { value } = predicate
  const slug = extractTypedAssignmentSlug(value) ?? extractTemplateAssignmentSlug(value)
  return slug ? [slug] : []
}

export const toSessionProjection = (
  session: Pick<Session, 'userId'>,
  extras: { readonly email?: string; readonly role: string; readonly isUnrestricted: boolean }
): SessionProjection => ({
  userId: session.userId,
  email: extras.email,
  role: extras.role,
  isUnrestricted: extras.isUnrestricted,
})
