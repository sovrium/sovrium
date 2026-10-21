/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The rows of a table a reader may read, with the grants that admit them —
 * the records API's one answer for its list, its single read and the links to
 * many records into the table (`rowReadAdmission` decides; this reads the
 * grants it decides on).
 *
 * The grants are read only on a table listed in `auth.scopeTables`, for a
 * signed-in reader who is not admin-equivalent: everyone else's answer comes
 * from the schema alone, at no query.
 */

import { Effect } from 'effect'
import { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import { NotFoundError } from '@/domain/errors'
import { isGuestSession } from '@/domain/models/app/auth/guest-session'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import {
  admitsRow,
  readsEveryRow,
  rowReadAdmission,
  signedOutRowAdmission,
  type RowGrants,
  type RowReadAdmission,
} from '@/domain/models/app/tables/row-read-admission-service'
import { logError } from '@/infrastructure/logging/logger'
import { getUserAccessRoles } from './user-groups'
import type { LinkReader } from './linked-row-visibility'
import type { QueryFilter } from '@/application/ports/repositories/tables/table-repository'
import type { App } from '@/domain/models/app'

/** What a read of `tableName` admits its reader, and the grants behind it. */
export interface ReaderRows {
  readonly admission: RowReadAdmission
  readonly grants: RowGrants
}

const EVERY_ROW: ReaderRows = { admission: { kind: 'every-row' }, grants: new Map() }

/**
 * The rows of `tableName` the reader's grants name, each with the roles
 * granted on it. A lookup fault fails CLOSED — the reader holds no grant — and
 * is logged: a grant can only widen what is read.
 */
const loadRowGrants = (
  tableName: string,
  userId: string
): Effect.Effect<RowGrants, never, DataSourceRepository> =>
  Effect.gen(function* () {
    const repo = yield* DataSourceRepository
    const roles = yield* getUserAccessRoles(userId)
    const byRole = yield* Effect.forEach(roles, (role) =>
      repo.fetchUserAssignments(userId, tableName, role).pipe(
        Effect.tapCause((cause) =>
          Effect.sync(() =>
            logError('[PERMISSIONS] Scope grant lookup failed; reading without it', cause, {
              tableSlug: tableName,
              userId,
            })
          )
        ),
        // effect-swallow: failing closed — without the grant the reader reads fewer rows, never more.
        Effect.orElseSucceed(() => [] as readonly string[]),
        Effect.map((ids) => ids.map((id) => [String(id), role] as const))
      )
    )
    return byRole
      .flat()
      .reduce<ReadonlyMap<string, readonly string[]>>(
        (grants, [id, role]) => new Map([...grants, [id, [...(grants.get(id) ?? []), role]]]),
        new Map()
      )
  })

/**
 * The rows of `tableName` `reader` may read ({@link RowReadAdmission}) and
 * the grants that admit them. Asked once the table's read rule has let her in.
 */
export const readerRowsOf = (
  app: App | undefined,
  tableName: string,
  reader: LinkReader
): Effect.Effect<ReaderRows, never, DataSourceRepository> =>
  Effect.gen(function* () {
    if (app?.auth === undefined) return EVERY_ROW
    // A visitor who is not signed in holds no grant and reads as the one
    // signed-out principal, whatever role her caller carried: one answer for
    // her, shared with the reads that have no request to ask (a sitemap).
    if (isGuestSession(reader.session.userId)) {
      return { admission: signedOutRowAdmission(app, tableName), grants: new Map() }
    }
    if (isAdminEquivalent(reader.role, app)) return EVERY_ROW
    const scoped = (app.auth.scopeTables ?? []).includes(tableName)
    const grants = scoped ? yield* loadRowGrants(tableName, reader.session.userId) : new Map()
    const related = { role: reader.role, groups: reader.groups ?? [], signedOut: false }
    return { admission: rowReadAdmission(app, tableName, related, grants), grants }
  }).pipe(Effect.withSpan('tables.reader-rows-of'))

/**
 * A list's filter narrowed to the rows its reader may read: unchanged for
 * every row, `id IN` the granted rows, and refused as a table that does not
 * exist when she may read none.
 */
export const filterToReaderRows = (
  filter: QueryFilter | undefined,
  admission: RowReadAdmission
): Effect.Effect<QueryFilter | undefined, NotFoundError> => {
  if (admission.kind === 'no-row') {
    return Effect.fail(new NotFoundError('Table not found')).pipe(
      Effect.withSpan('tables.narrow-list-to-reader-rows')
    )
  }
  const narrowed = (ids: readonly string[]): QueryFilter => ({
    and: [...(filter?.and ?? []), { field: 'id', operator: 'in', value: ids }],
  })
  return Effect.succeed(admission.kind === 'every-row' ? filter : narrowed(admission.ids)).pipe(
    Effect.withSpan('tables.narrow-list-to-reader-rows')
  )
}

/**
 * The grants a single read of the row `id` is shaped with, or the refusal of a
 * row its reader may not read — answered exactly as a row that does not exist.
 */
export const grantsForReadableRow = (
  app: App | undefined,
  tableName: string,
  reader: LinkReader,
  id: unknown
): Effect.Effect<RowGrants, NotFoundError, DataSourceRepository> =>
  readerRowsOf(app, tableName, reader).pipe(
    Effect.flatMap(({ admission, grants }) =>
      admitsRow(admission, String(id))
        ? Effect.succeed(grants)
        : Effect.fail(new NotFoundError('Record not found'))
    ),
    Effect.withSpan('tables.grants-for-readable-row')
  )

/**
 * Whether `reader`'s list of `tableName` admits every row whatever grants she
 * holds (`readsEveryRow`) — decided on the schema, so her grants are never
 * read to learn it.
 */
export const readerListsEveryRow = (
  app: App | undefined,
  tableName: string,
  reader: LinkReader
): boolean =>
  app === undefined ||
  readsEveryRow(app, tableName, {
    role: reader.role,
    groups: reader.groups ?? [],
    signedOut: isGuestSession(reader.session.userId),
  })

/**
 * The ids among `ids` that `reader`'s list of `tableName` does not admit. To
 * every write — an update, a delete, a batch of either, an upsert, a locked
 * form prefill — such a row is a row that does not exist: it is refused or
 * skipped exactly as a missing id is, and nothing is written to it.
 */
export const rowsReaderMayNotList = (
  app: App | undefined,
  tableName: string,
  reader: LinkReader,
  ids: readonly (string | number)[]
): Effect.Effect<readonly string[], never, DataSourceRepository> =>
  // A reader whose list admits every row lists every id, at no query.
  (readerListsEveryRow(app, tableName, reader)
    ? Effect.succeed(EVERY_ROW)
    : readerRowsOf(app, tableName, reader)
  ).pipe(
    Effect.map(({ admission }) => ids.map(String).filter((id) => !admitsRow(admission, id))),
    Effect.withSpan('tables.rows-reader-may-not-list')
  )

/** A person judged on a row as herself: her account id, her role, her groups. */
export interface RowPerson {
  readonly id: string
  readonly role: string
  readonly groups: readonly string[]
}

/** A grant lookup that fails CLOSED — no grant — and says so in the log. */
const orNoGrant = <E>(
  lookup: Effect.Effect<ReadonlyMap<string, readonly string[]>, E>,
  tableName: string
): Effect.Effect<ReadonlyMap<string, readonly string[]>> =>
  lookup.pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() =>
        logError('[PERMISSIONS] Scope grant lookup failed; judging without it', cause, {
          tableSlug: tableName,
        })
      )
    ),
    // effect-swallow: failing closed — without the grant a person reads fewer rows, never more.
    Effect.orElseSucceed((): ReadonlyMap<string, readonly string[]> => new Map())
  )

/**
 * The roles each of `people` holds a grant under on the row `id` of
 * `tableName` — {@link loadRowGrants} for many people at once: one query for
 * their roles, then one per role, never one per person.
 */
const loadPeopleRowGrants = (
  tableName: string,
  people: readonly RowPerson[],
  id: string
): Effect.Effect<ReadonlyMap<string, readonly string[]>, never, DataSourceRepository> =>
  Effect.gen(function* () {
    const repo = yield* DataSourceRepository
    const userIds = people.map((person) => person.id)
    const rolesOf = yield* orNoGrant(repo.fetchUsersAccessRoles(userIds), tableName)
    const roles = [...new Set([...rolesOf.values()].flat())]
    const byRole = yield* Effect.forEach(roles, (role) =>
      orNoGrant(repo.fetchUsersAssignments(userIds, tableName, role), tableName).pipe(
        Effect.map((assigned) => ({ role, assigned }))
      )
    )
    return new Map(
      userIds.map((userId) => [
        userId,
        byRole
          .filter(({ assigned }) => (assigned.get(userId) ?? []).map(String).includes(id))
          .map(({ role }) => role),
      ])
    )
  })

/** A person read as a signed-in reader of her own. */
const asReader = (person: RowPerson) => ({ ...person, signedOut: false })

/**
 * The ids of the people among `people` the records list admits to the row
 * `id` of `tableName`, each judged as herself — exactly the question
 * {@link grantsForReadableRow} asks for the caller. Off a table listed in
 * `auth.scopeTables` it costs no query; on one, a fixed number per call.
 */
export const peopleAdmittedToRow = (
  app: App,
  tableName: string,
  people: readonly RowPerson[],
  id: string
): Effect.Effect<ReadonlySet<string>, never, DataSourceRepository> =>
  Effect.gen(function* () {
    if (app.auth === undefined) return new Set(people.map((person) => person.id))
    const unrestricted = (person: RowPerson): boolean =>
      readsEveryRow(app, tableName, asReader(person))
    const open = people.filter(unrestricted).map((person) => person.id)
    const closed = people.filter((person) => !unrestricted(person))
    const scoped = closed.length > 0 && (app.auth.scopeTables ?? []).includes(tableName)
    const grants = scoped ? yield* loadPeopleRowGrants(tableName, closed, id) : new Map()
    const granted = closed.filter((person) => {
      const roles: readonly string[] = grants.get(person.id) ?? []
      const admission = rowReadAdmission(app, tableName, asReader(person), new Map([[id, roles]]))
      return admitsRow(admission, id)
    })
    return new Set([...open, ...granted.map((person) => person.id)])
  }).pipe(Effect.withSpan('tables.people-admitted-to-row'))
