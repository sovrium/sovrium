/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Who a comment on one record can mention: the people who can READ that record.
 *
 * One rule, three readers of it — the composer's `@` picker (who is offered),
 * the create path (which mentions survive to the comment trigger) and every
 * thread read (which tokens render as a name). Deciding it once here is what
 * stops the three from disagreeing about who is in a record's audience.
 *
 * "Can read the record" is the same two gates a direct read of the record
 * applies to that person, evaluated FOR them rather than for the caller:
 *
 *  1. **table read** — `hasReadPermissionForRoles` over their role and, only
 *     when the role alone is refused, their groups (when the app declares any)
 *     and — on a table with a row-level rule — their `user_access` roles, the
 *     same overlay the records API's guard counts;
 *  2. **row-level read** — the table's `rowLevelPermissions.read.when`, judged
 *     by the shared `rowPassesRule` against their own context (id, role,
 *     assignments). An unrestricted role passes, as it does on the records API.
 *
 * Accounts a user picker would never offer (agents, banned accounts) and ids
 * naming no account at all are nobody's audience, so they resolve to nothing.
 */

import { Effect } from 'effect'
import { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import { UserDirectoryRepository } from '@/application/ports/repositories/auth/user-directory-repository'
import { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import { findUserEmailsByIds } from '@/application/use-cases/auth/find-user-email'
import { hasReadPermissionForRoles } from '@/domain/models/app/auth/permission-evaluator-service'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import { extractMentionIds } from '@/domain/models/app/tables/comment-mention-markup-service'
import { rulesNameCurrentUser } from '@/domain/models/app/tables/row-level-evaluator-service'
import { rowPassesRule } from '@/domain/models/app/tables/row-level-write-decision-service'
import { readStoredValues } from '@/domain/models/app/tables/stored-value-service'
import { logError } from '@/infrastructure/logging/logger'
import { loadContextsWithKnownEmails } from './permissions/row-level-enforcement'
import { buildEffectiveRoles } from './user-groups'
import { getUserRoles } from './user-role'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { AuthDatabaseError } from '@/application/ports/repositories/auth/auth-repository'
import type {
  UserDirectoryDatabaseError,
  UserDirectoryEntry,
} from '@/application/ports/repositories/auth/user-directory-repository'
import type { DatabaseError } from '@/domain/errors'
import type { App, Table } from '@/domain/models/app'

/** The record whose audience is asked about, and the caller asking. */
export interface MentionAudienceScope {
  readonly app: App
  readonly table: Table
  readonly recordId: string
  /** The caller's session — used only to read the record for a row-level rule. */
  readonly session: Readonly<UserSession>
}

type AudienceRequirements =
  UserDirectoryRepository | AuthRepository | TableRepository | DataSourceRepository

type AudienceError = UserDirectoryDatabaseError | AuthDatabaseError | DatabaseError

/** Each person's values from one batched lookup; a person it does not name has none. */
type ByPerson = ReadonlyMap<string, readonly string[]>

const NOBODY: ByPerson = new Map()

/**
 * The groups of every one of `userIds`, in ONE query — and none read when the
 * app declares no group. Absent team tables mean "no memberships", as for
 * `getUserGroups`.
 */
const groupsOf = (
  app: App,
  userIds: readonly string[]
): Effect.Effect<ByPerson, never, AuthRepository> =>
  Effect.gen(function* () {
    if ((app.auth?.groups ?? []).length === 0 || userIds.length === 0) return NOBODY
    const auth = yield* AuthRepository
    return yield* auth.getUsersGroups(userIds).pipe(
      // effect-swallow: team tables absent (auth not configured) means "no memberships" — the ordinary case `getUserGroups` keeps total too; without groups the audience can only NARROW.
      Effect.orElseSucceed(() => NOBODY)
    )
  })

/**
 * The `user_access` roles every one of `userIds` holds, in ONE query, counted
 * on a table with a row-level rule exactly as the records API's guard counts
 * them, and on no other table.
 */
const accessRolesOf = (
  table: Table,
  userIds: readonly string[]
): Effect.Effect<ByPerson, never, DataSourceRepository> =>
  Effect.gen(function* () {
    if (table.rowLevelPermissions === undefined || userIds.length === 0) return NOBODY
    const data = yield* DataSourceRepository
    return yield* data.fetchUsersAccessRoles(userIds).pipe(
      Effect.tapCause((cause) =>
        Effect.sync(() =>
          logError('[comments] user_access roles could not be read for a mention audience', cause)
        )
      ),
      // effect-swallow: without the `user_access` overlay only the account role and groups grant — a failed read can only NARROW the audience.
      Effect.orElseSucceed(() => NOBODY)
    )
  })

/**
 * The people among `people` who read the table: by role alone, else widened by
 * their groups and `user_access` roles as the records API widens it. The
 * widening is read for the people the role alone refuses, all at once.
 */
const selectTableReaders = (
  scope: MentionAudienceScope,
  people: readonly UserDirectoryEntry[],
  roleOf: (userId: string) => string
): Effect.Effect<readonly UserDirectoryEntry[], never, AuthRepository | DataSourceRepository> =>
  Effect.gen(function* () {
    const { app, table } = scope
    const byRole = (user: UserDirectoryEntry): boolean =>
      hasReadPermissionForRoles(table, [roleOf(user.id)], app)
    const refused = people.filter((user) => !byRole(user)).map((user) => user.id)
    const groups = yield* groupsOf(app, refused)
    const accessRoles = yield* accessRolesOf(table, refused)
    const widened = (userId: string): boolean => {
      const extras = accessRoles.get(userId) ?? []
      const memberships = groups.get(userId) ?? []
      if (memberships.length === 0 && extras.length === 0) return false
      return hasReadPermissionForRoles(
        table,
        [...buildEffectiveRoles(roleOf(userId), memberships), ...extras],
        app
      )
    }
    return people.filter((user) => byRole(user) || widened(user.id))
  })

/**
 * The people among `readers` the row-level read rule admits to `record`, each
 * judged against their own context. Their emails are read in ONE query, and
 * only when a rule names `$currentUser.email`; their assignments in one query
 * per scope table the rules name.
 */
const selectRowReaders = (
  scope: MentionAudienceScope,
  record: Readonly<Record<string, unknown>>,
  readers: readonly UserDirectoryEntry[],
  roleOf: (userId: string) => string
): Effect.Effect<readonly UserDirectoryEntry[], never, AuthRepository | DataSourceRepository> =>
  Effect.gen(function* () {
    const rlp = scope.table.rowLevelPermissions
    const restricted = readers.filter((user) => !isAdminEquivalent(roleOf(user.id), scope.app))
    const emails = yield* emailsForRules(
      scope,
      restricted.map((user) => user.id)
    )
    const contexts = yield* loadContextsWithKnownEmails(
      restricted.map((user) => ({
        userId: user.id,
        role: roleOf(user.id),
        email: emails.get(user.id),
        isUnrestricted: false,
      })),
      rlp
    )
    // Judged as the records API reads the row (SQLite `1`/`0` read as booleans).
    const row = readStoredValues(scope.table, record)
    return readers.filter((user) => {
      const context = contexts.get(user.id)
      // An unrestricted role passes, as it does on the records API.
      return context === undefined || rowPassesRule(rlp, 'read', row, context)
    })
  })

/**
 * The address of each of `userIds`, read in ONE query — and not read at all
 * when no rule of the table names `$currentUser.email`.
 */
const emailsForRules = (
  scope: MentionAudienceScope,
  userIds: readonly string[]
): Effect.Effect<ReadonlyMap<string, string>, never, AuthRepository> =>
  rulesNameCurrentUser(scope.table.rowLevelPermissions, 'email') && userIds.length > 0
    ? findUserEmailsByIds(userIds)
    : Effect.succeed(new Map<string, string>())

/**
 * The people among `ids` who can read the record, as directory entries
 * (`{ id, name, image }`, never an email), in the order of `ids`.
 */
const selectRecordReaders = (
  scope: MentionAudienceScope,
  ids: readonly string[]
): Effect.Effect<readonly UserDirectoryEntry[], AudienceError, AudienceRequirements> =>
  Effect.gen(function* () {
    if (ids.length === 0) return []
    const directory = yield* UserDirectoryRepository
    const found = yield* directory.findPickableUsersByIds(ids)
    const byId = new Map(found.map((user) => [user.id, user]))
    const people = [...new Set(ids)].flatMap((id) => {
      const user = byId.get(id)
      return user === undefined ? [] : [user]
    })
    // An app with no `auth` block is the full-access model: everyone reads.
    if (scope.app.auth === undefined || people.length === 0) return people

    const roles = yield* getUserRoles(people.map((user) => user.id))
    const roleOf = (userId: string): string => roles.get(userId) ?? 'member'
    const tableReaders = yield* selectTableReaders(scope, people, roleOf)
    if (scope.table.rowLevelPermissions?.read?.when === undefined) return tableReaders
    if (tableReaders.length === 0) return tableReaders

    const repo = yield* TableRepository
    const record = yield* repo.getRecord(scope.session, scope.table.name, scope.recordId)
    if (record === null) return []
    return yield* selectRowReaders(scope, record, tableReaders, roleOf)
  }).pipe(Effect.withSpan('tables.select-record-readers'))

/** A person a comment names, as a thread reads it. */
export interface CommentMention {
  readonly id: string
  readonly name: string
}

/**
 * The body's mention tokens that name one of `readers`, with that reader's
 * current name, in first-mention order. A token for anyone else is dropped —
 * the thread renders it as the unknown-user placeholder.
 */
const namedMentions = (
  content: string,
  readers: readonly UserDirectoryEntry[]
): readonly CommentMention[] => {
  const nameOf = new Map(readers.map((reader) => [reader.id, reader.name]))
  return extractMentionIds(content).flatMap((id) => {
    const name = nameOf.get(id)
    return name === undefined ? [] : [{ id, name }]
  })
}

/**
 * The people a freshly posted comment mentions, kept only where they can read
 * the record — once as the ids the comment trigger receives, once as the names
 * the create response carries.
 *
 * The body's `@[<user id>]` markup is the mention; `extraIds` (the create
 * request's optional `mentions` array) is merged after it. Anyone outside the
 * record's audience is not a mention at all, so they never reach the trigger's
 * `mentions` or `mentionedEmails`. The response lists the markup's people only:
 * it is what the thread renders, and an array-only mention has no token in the
 * body to render.
 */
export const resolveCreatedCommentMentions = (
  scope: MentionAudienceScope,
  content: string,
  extraIds: readonly string[]
): Effect.Effect<
  { readonly ids: readonly string[]; readonly mentions: readonly CommentMention[] },
  AudienceError,
  AudienceRequirements
> =>
  Effect.gen(function* () {
    const markupIds = extractMentionIds(content)
    const readers = yield* selectRecordReaders(scope, [...markupIds, ...extraIds])
    return {
      ids: readers.map((reader) => reader.id),
      mentions: namedMentions(content, readers),
    }
  }).pipe(Effect.withSpan('tables.resolve-created-comment-mentions'))

/**
 * Each comment with the people its markup mentions, resolved to their CURRENT
 * names, among those who can read the record. A token for anyone else is left
 * out, and the thread renders it as the unknown-user placeholder.
 *
 * One directory read and one audience check for the whole page of comments,
 * never one per comment.
 *
 * Total: a failed lookup resolves every token to the placeholder rather than
 * failing the thread, and is logged with its cause. Failing closed is the safe
 * direction — it can hide a name, never show one to a reader it should not.
 */
export const attachCommentMentions = <C extends { readonly content: string }>(
  scope: MentionAudienceScope,
  comments: readonly C[]
): Effect.Effect<
  readonly (C & { readonly mentions: readonly CommentMention[] })[],
  never,
  AudienceRequirements
> =>
  Effect.gen(function* () {
    const ids = comments.flatMap((comment) => extractMentionIds(comment.content))
    const readers = yield* selectRecordReaders(scope, ids)
    return comments.map((comment) => ({
      ...comment,
      mentions: namedMentions(comment.content, readers),
    }))
  }).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() => logError('[comments] mention names could not be resolved', cause))
    ),
    // effect-swallow: a thread must still read when the audience lookup fails; every token then renders as the unknown-user placeholder, which hides a name rather than exposing one.
    Effect.orElseSucceed(() => comments.map((comment) => ({ ...comment, mentions: [] }))),
    Effect.withSpan('tables.attach-comment-mentions')
  )

/**
 * One comment, inside its `{ comment }` envelope, with the people its markup
 * mentions — resolved exactly as {@link attachCommentMentions} resolves a
 * thread's. Total, for the same reason.
 */
export const attachSingleCommentMentions = <C extends { readonly content: string }>(
  scope: MentionAudienceScope,
  envelope: { readonly comment: C }
): Effect.Effect<
  { readonly comment: C & { readonly mentions: readonly CommentMention[] } },
  never,
  AudienceRequirements
> =>
  attachCommentMentions(scope, [envelope.comment]).pipe(
    Effect.map(([withMentions]) => ({
      comment: withMentions ?? { ...envelope.comment, mentions: [] },
    })),
    Effect.withSpan('tables.attach-single-comment-mentions')
  )

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
    const page = yield* directory.listPickableUsers({
      term: scope.term,
      limit: MENTIONABLE_PAGE,
      after,
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
 * The directory is read in name order a page at a time and narrowed to the
 * record's readers after each page, so readers are found however many people
 * who cannot read the record sort before them, and a large directory still
 * costs a bounded scan.
 */
export const listMentionableUsersProgram = (
  scope: MentionAudienceScope & { readonly term: string | undefined }
): Effect.Effect<readonly UserDirectoryEntry[], AudienceError, AudienceRequirements> =>
  collectMentionableReaders(scope, [], undefined, 0).pipe(
    Effect.map((readers) => readers.slice(0, MENTIONABLE_LIMIT)),
    Effect.withSpan('tables.list-mentionable-users')
  )
