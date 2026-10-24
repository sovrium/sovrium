/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The comment composer's `@` picker: the people who can read the record, read
 * from the directory a page at a time and narrowed to the record's audience
 * after each page (`selectRecordReaders`, the one rule of who can be mentioned).
 */

import { Effect } from 'effect'
import { UserDirectoryRepository } from '@/application/ports/repositories/auth/user-directory-repository'
import { NO_GRANT_ROLE } from '@/domain/models/app/auth/permission-evaluation'
import { hasReadPermissionForRoles } from '@/domain/models/app/auth/permission-evaluator-service'
import { assignableRoleNames } from '@/domain/models/app/auth/roles/role'
import {
  selectRecordReaders,
  type AudienceError,
  type AudienceRequirements,
  type MentionAudienceScope,
} from './comment-mention-programs'
import type {
  UserDirectoryEntry,
  UserDirectoryQuery,
} from '@/application/ports/repositories/auth/user-directory-repository'

/** How many directory rows the picker reads per page before narrowing to readers. */
const MENTIONABLE_PAGE = 100

/**
 * How many directory rows one picker search reads at most. A performance bound,
 * not a boundary — the narrowing to readers is — set well above any page so a
 * crowd of people who cannot read the record never hides the ones who can.
 */
const MENTIONABLE_SCAN_CAP = 2000

/** How many people the picker is offered at most. */
const MENTIONABLE_LIMIT = 20

/**
 * Who could be in the record's audience, as a condition the directory query
 * applies itself: a stored role that reads the table, or — when the app declares
 * groups — any group member, whose groups may widen her role. `undefined` when
 * the query cannot narrow: an app with no `auth` block (everyone reads), a
 * table whose row-level rule lets `user_access` roles widen the role, or a
 * table even an account with no granting role reads. Each candidate is still
 * judged by {@link selectRecordReaders}; this only keeps the people whose role
 * cannot read out of the scan, so a large directory costs one bounded query.
 */
const directoryAudienceOf = (
  scope: MentionAudienceScope
): UserDirectoryQuery['audience'] | undefined => {
  const { app, table } = scope
  if (app.auth === undefined || table.rowLevelPermissions !== undefined) return undefined
  if (hasReadPermissionForRoles(table, [NO_GRANT_ROLE], app)) return undefined
  return {
    roles: [...assignableRoleNames(app)].filter((role) =>
      hasReadPermissionForRoles(table, [role], app)
    ),
    teamMembers: (app.auth.groups ?? []).length > 0,
  }
}

/**
 * Read the directory page after `after`, keep its readers, and go on until
 * {@link MENTIONABLE_LIMIT} readers are found, the directory runs out, or
 * {@link MENTIONABLE_SCAN_CAP} rows have been read.
 */
const collectMentionableReaders = (
  scope: MentionAudienceScope & { readonly term: string | undefined },
  found: readonly UserDirectoryEntry[],
  after: UserDirectoryEntry | undefined,
  scanned: number
): Effect.Effect<readonly UserDirectoryEntry[], AudienceError, AudienceRequirements> =>
  Effect.gen(function* () {
    const directory = yield* UserDirectoryRepository
    const audience = directoryAudienceOf(scope)
    const page = yield* directory.listPickableUsers({
      term: scope.term,
      limit: MENTIONABLE_PAGE,
      after,
      ...(audience === undefined ? {} : { audience }),
    })
    const candidates = page
      .map((user) => user.id)
      .filter((userId) => userId !== scope.session.userId)
    const readers = [...found, ...(yield* selectRecordReaders(scope, candidates))]
    const read = scanned + page.length
    const exhausted = page.length < MENTIONABLE_PAGE || read >= MENTIONABLE_SCAN_CAP
    if (readers.length >= MENTIONABLE_LIMIT || exhausted) return readers
    return yield* collectMentionableReaders(scope, readers, page.at(-1), read)
  })

/**
 * The people the comment composer offers when its writer types `@`: those who
 * can read the record, other than the writer, whose name matches `term`.
 *
 * The directory is read in name order a page at a time, already narrowed to
 * the people whose role could read the record ({@link directoryAudienceOf}),
 * and narrowed to the record's readers after each page, so readers are found
 * however many people who cannot read the record sort before them, and a large
 * directory costs the same queries as a small one.
 */
export const listMentionableUsersProgram = (
  scope: MentionAudienceScope & { readonly term: string | undefined }
): Effect.Effect<readonly UserDirectoryEntry[], AudienceError, AudienceRequirements> =>
  collectMentionableReaders(scope, [], undefined, 0).pipe(
    Effect.map((readers) => readers.slice(0, MENTIONABLE_LIMIT)),
    Effect.withSpan('tables.list-mentionable-users')
  )
