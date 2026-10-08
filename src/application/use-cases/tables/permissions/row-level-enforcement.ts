/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Z-3 row-level permission enforcement orchestration.
 *
 * Bridges the pure domain evaluator (src/domain/models/app/tables/row-level-evaluator-service)
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
import { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import { findUserEmailById } from '@/application/use-cases/auth/find-user-email'
import { isGuestSession } from '@/domain/models/app/auth/guest-session'
import {
  isPredicateGroup,
  rulesNameCurrentUser,
  signedOutContext,
  type CurrentUserContext,
} from '@/domain/models/app/tables/row-level-evaluator-service'
import { SHARED_POOL_FANOUT_CONCURRENCY } from '@/infrastructure/database/sql/db-effect'
import { logError } from '@/infrastructure/logging'
import { withChainMatches, type RowRuleScope } from './row-rule-chain-matches'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { RowLevelPermissions, RowLevelWhen } from '@/domain/models/app/tables/permissions'

export { rowRuleScopeOf, type RowRuleScope } from './row-rule-chain-matches'

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
 * Build a `CurrentUserContext` for predicate evaluation against the table's
 * row-level rules `rlp`: the reader's `user_access` rows for every scope table
 * the rules name, and her email when — and only when — a rule names
 * `$currentUser.email` and the door that asks did not already know it.
 *
 * A visitor with no session gets the signed-out context and NO lookup at all:
 * nothing about her resolves, and a rule naming the signed-in person admits no
 * row for her (`signedOutContext`).
 */
export const loadCurrentUserContext = (
  session: SessionProjection,
  rlp: RowLevelPermissions | undefined,
  scope?: RowRuleScope
): Effect.Effect<CurrentUserContext, never, DataSourceRepository | AuthRepository> =>
  Effect.gen(function* () {
    if (isGuestSession(session.userId)) {
      return yield* withChainMatches(signedOutContext(session.userId, session.role), rlp, scope)
    }
    const email =
      session.email ??
      (rulesNameCurrentUser(rlp, 'email') ? yield* findUserEmailById(session.userId) : undefined)
    const ctx = yield* loadContextWithKnownEmail({ ...session, email }, rlp)
    // A rule reading through a relationship (`app_ref.created_by`) needs the
    // related rows it admits; without `scope` such a rule admits no row.
    return yield* withChainMatches(ctx, rlp, scope)
  }).pipe(Effect.withSpan('tables.load-current-user-context'))

/**
 * {@link loadCurrentUserContext} for a reader whose email the caller has
 * ALREADY resolved — `undefined` meaning she has none — so nothing is looked up
 * for it here. A door judging many people at once (the comment mention picker)
 * reads every address in one query, then builds each context through this.
 */
export const loadContextWithKnownEmail = (
  session: SessionProjection,
  rlp: RowLevelPermissions | undefined
): Effect.Effect<CurrentUserContext, never, DataSourceRepository> =>
  Effect.gen(function* () {
    if (isGuestSession(session.userId)) return signedOutContext(session.userId, session.role)
    const repo = yield* DataSourceRepository
    const scopeTables = collectAssignmentScopeTables(rlp)

    // Fetch assignments for every requested scope-table in parallel. Errors
    // collapse to "no assignments" so a missing user_access table cannot
    // crash an unrelated read of a scoped table (the eventual filter
    // projection then yields zero rows for non-admin users).
    //
    // FAILING CLOSED HERE IS DELIBERATE AND MUST NOT CHANGE: an empty assignment
    // set denies access. Making this permissive on error would convert an
    // availability problem into an authorization bypass.
    //
    // What did need changing is the SILENCE. The repository already absorbs the
    // one expected condition — a `user_access` table that does not exist yet —
    // and returns an empty list for it. So anything reaching this handler is an
    // UNEXPECTED fault (lost connection, permission error, malformed stored
    // JSON), and swallowing it meant a correctly-assigned user silently lost
    // access to every row, with nothing recorded anywhere to explain why.
    const entries = yield* Effect.forEach(
      scopeTables,
      (slug) =>
        repo.fetchUserAssignments(session.userId, slug).pipe(
          Effect.catch((error) => {
            logError(
              '[PERMISSIONS] Row-level scope lookup failed; denying access for this scope table',
              error,
              { tableSlug: slug, userId: session.userId }
            )
            return Effect.succeed([] as readonly string[])
          }),
          Effect.map((ids) => [slug, ids] as const)
        ),
      { concurrency: SHARED_POOL_FANOUT_CONCURRENCY }
    )

    return {
      userId: session.userId,
      email: session.email,
      role: session.role,
      isUnrestricted: session.isUnrestricted,
      assignments: new Map(entries),
    }
  }).pipe(Effect.withSpan('tables.load-context-with-known-email'))

/**
 * {@link loadContextWithKnownEmail} for MANY readers at once: ONE
 * `user_access` read per scope table the rules name, for all of them, never
 * one per reader. Each reader's email is the one the caller already resolved.
 * A lookup fault fails CLOSED for that scope table — every reader gets no
 * assignment there — and is logged, exactly as the single form does.
 */
export const loadContextsWithKnownEmails = (
  readers: readonly SessionProjection[],
  rlp: RowLevelPermissions | undefined
): Effect.Effect<ReadonlyMap<string, CurrentUserContext>, never, DataSourceRepository> =>
  Effect.gen(function* () {
    const repo = yield* DataSourceRepository
    const signedIn = readers.filter((reader) => !isGuestSession(reader.userId))
    const ids = signedIn.map((reader) => reader.userId)
    const bySlug = yield* Effect.forEach(
      ids.length === 0 ? [] : collectAssignmentScopeTables(rlp),
      (slug) =>
        repo.fetchUsersAssignments(ids, slug).pipe(
          Effect.tapCause((cause) =>
            Effect.sync(() =>
              logError(
                '[PERMISSIONS] Row-level scope lookup failed; denying access for this scope table',
                cause,
                { tableSlug: slug, readers: String(ids.length) }
              )
            )
          ),
          // effect-swallow: failing closed — an empty assignment set denies access, so a lookup fault can only NARROW who reads.
          Effect.orElseSucceed(() => new Map<string, readonly string[]>()),
          Effect.map((byUser) => [slug, byUser] as const)
        ),
      { concurrency: SHARED_POOL_FANOUT_CONCURRENCY }
    )
    const contextOf = (reader: SessionProjection): CurrentUserContext =>
      isGuestSession(reader.userId)
        ? signedOutContext(reader.userId, reader.role)
        : {
            userId: reader.userId,
            email: reader.email,
            role: reader.role,
            isUnrestricted: reader.isUnrestricted,
            assignments: new Map(
              bySlug.map(([slug, byUser]) => [slug, byUser.get(reader.userId) ?? []] as const)
            ),
          }
    return new Map(readers.map((reader) => [reader.userId, contextOf(reader)] as const))
  }).pipe(Effect.withSpan('tables.load-contexts-with-known-emails'))

/**
 * Extract every `assignments.<tableSlug>` referenced inside a
 * `RowLevelPermissions` block. Used to pre-fetch the right user_access
 * rows in a single batched call.
 */
export const collectAssignmentScopeTables = (
  rlp: RowLevelPermissions | undefined
): readonly string[] => {
  if (!rlp) return []
  const predicates = [rlp.read?.when, rlp.write?.when, rlp.create?.when, rlp.delete?.when]
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
  // [internal ref]: a composite group references scope tables across ALL its
  // conditions (e.g. `clients` AND `projets` in an OR predicate). Recurse so
  // every assignment slug is pre-fetched into the assignments map.
  if (isPredicateGroup(predicate)) {
    return predicate.conditions.flatMap(extractScopeTablesFromPredicate)
  }
  const { value } = predicate
  const slug = extractTypedAssignmentSlug(value) ?? extractTemplateAssignmentSlug(value)
  return slug ? [slug] : []
}

/**
 * Convert a `UserSession` to the lightweight `SessionProjection`
 * the evaluator works with. The presentation layer does this once per
 * request to keep the application boundary clean.
 */
export const toSessionProjection = (
  session: Pick<UserSession, 'userId'>,
  extras: { readonly email?: string; readonly role: string; readonly isUnrestricted: boolean }
): SessionProjection => ({
  userId: session.userId,
  email: extras.email,
  role: extras.role,
  isUnrestricted: extras.isUnrestricted,
})
