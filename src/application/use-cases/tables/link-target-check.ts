/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The one check of every row a write links to, run before the first write.
 *
 * A relationship value names a row of ANOTHER table, and that table has its own
 * read rules. The database's foreign key only asks whether the row exists, so a
 * link to a row the writer may not read was written while a link to a missing
 * row was refused — two answers that tell a hidden row from a missing one, and a
 * record filed under a row its author cannot see. Here a target is judged by the
 * writer's read rules on the related table, and a target they may not read is
 * refused exactly as a missing one: the same failure, raised before anything is
 * written.
 *
 * - A related table whose read grant refuses the writer admits no row at all.
 * - A related table with a row-level `read.when` admits the rows that rule shows
 *   the writer — the same `readableKeys` test the reads apply, so what a writer
 *   may link is exactly what they may read back. A missing row is not among
 *   them, so it gets the very same answer.
 * - A many-to-many value is judged whole, even an id already linked: a set that
 *   could name a hidden row only when it is already linked would answer the
 *   probe this closes. Its ids are also checked for EXISTENCE whoever writes,
 *   because the junction rows are written after the record, and a missing id
 *   refused only there would leave the record behind.
 * - A many-to-one value equal to the key the record already holds is not a new
 *   link: the reader already receives that key, so sending it back discloses
 *   nothing. The held row is read only when such a value would be refused.
 *
 * Cost: one `id IN (…)` read per related table the check must look into, for
 * the whole write (a batch included), and none for a related table that hides
 * nothing from this writer.
 */

import { Effect } from 'effect'
import { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import { DatabaseError, ForeignKeyViolationError } from '@/domain/errors'
import { isGuestSession } from '@/domain/models/app/auth/guest-session'
import { hasReadPermissionForCaller } from '@/domain/models/app/auth/permission-evaluator-service'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import {
  accountIdsOf,
  userListFieldNames,
} from '@/domain/models/app/tables/user-list-field-service'
import { readableKeys, type LinkReader } from './linked-row-visibility'
import { buildEffectiveRoles } from './user-groups'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type { AccountReference } from '@/application/ports/repositories/tables/record-write-accounts'
import type { App, Table } from '@/domain/models/app'

/** One record a write proposes, and the row it changes when it is an update. */
export interface LinkTargetWrite {
  readonly fields: Readonly<Record<string, unknown>>
  /** The row as it stands, read only when a many-to-one value would be refused. */
  readonly held?: Effect.Effect<Readonly<Record<string, unknown>> | null | undefined, DatabaseError>
}

/** A relationship field that names rows by key on a write. */
interface LinkField {
  readonly name: string
  readonly relatedTable: string
  readonly many: boolean
}

/** The keys a related table admits for this write, or `'all'` when it hides none. */
type Admitted = ReadonlySet<string> | 'all'

/**
 * The relationship fields of `tableName` that hold keys: many-to-one and
 * one-to-one hold one, many-to-many a list. A one-to-many holds nothing.
 */
const linkFieldsOf = (app: App, tableName: string): readonly LinkField[] =>
  (app.tables?.find((t) => t.name === tableName)?.fields ?? []).flatMap((field) => {
    const candidate = field as {
      readonly name: string
      readonly type: string
      readonly relatedTable?: unknown
      readonly relationType?: unknown
    }
    if (candidate.type !== 'relationship' || typeof candidate.relatedTable !== 'string') return []
    if (candidate.relationType === 'one-to-many') return []
    return [
      {
        name: candidate.name,
        relatedTable: candidate.relatedTable,
        many: candidate.relationType === 'many-to-many',
      },
    ]
  })

/** The keys a relationship value names; blanks name nothing. */
const keysOf = (value: unknown): readonly string[] =>
  (Array.isArray(value) ? value : [value])
    .filter((key): key is string | number => typeof key === 'string' || typeof key === 'number')
    .map(String)
    .filter((key) => key !== '')

/** The keys `write` names under `field`. */
const keysNamed = (write: LinkTargetWrite, field: LinkField): readonly string[] =>
  Object.hasOwn(write.fields, field.name) ? keysOf(write.fields[field.name]) : []

/** Whether the writer is judged at all: an admin, or no writer identity, is not. */
const isRestricted = (app: App, reader: LinkReader | undefined): reader is LinkReader =>
  reader !== undefined && !isAdminEquivalent(reader.role, app)

/** The rows among `keys` that exist in `related`, whoever asks. */
const existingKeys = (
  related: Table,
  keys: readonly string[],
  session: Readonly<UserSession>
): Effect.Effect<ReadonlySet<string>, DatabaseError, TableRepository> =>
  Effect.gen(function* () {
    const repo = yield* TableRepository
    const rows = yield* repo.listRecords({
      session,
      tableName: related.name,
      filter: { and: [{ field: 'id', operator: 'in', value: [...keys] }] },
    })
    return new Set(rows.map((row) => String(row.id)))
  })

/**
 * The keys `related` admits for `reader` among `keys`. `existence` asks for the
 * keys to be read even when the table hides nothing from this writer.
 */
const admittedKeys = (
  app: App,
  related: Table,
  keys: readonly string[],
  context: {
    readonly session: Readonly<UserSession>
    readonly reader: LinkReader | undefined
    readonly existence: boolean
  }
): Effect.Effect<
  Admitted,
  DatabaseError,
  TableRepository | DataSourceRepository | AuthRepository
> =>
  Effect.gen(function* () {
    const { session, reader, existence } = context
    if (keys.length === 0) return 'all' as const
    if (isRestricted(app, reader)) {
      const caller = {
        effectiveRoles: buildEffectiveRoles(reader.role, reader.groups ?? []),
        signedOut: isGuestSession(reader.session.userId),
      }
      if (!hasReadPermissionForCaller(related, caller, app)) return new Set<string>()
      const readable = yield* readableKeys(app, related, keys, reader)
      if (readable !== undefined) return readable
    }
    return existence ? yield* existingKeys(related, keys, session) : ('all' as const)
  })

/** Every related table the write names, with the keys and whether any list names them. */
const namedTargets = (
  fields: readonly LinkField[],
  writes: readonly LinkTargetWrite[]
): ReadonlyMap<string, { readonly keys: readonly string[]; readonly existence: boolean }> =>
  fields.reduce((targets, field) => {
    const named = writes.flatMap((write) => keysNamed(write, field))
    if (named.length === 0) return targets
    const previous = targets.get(field.relatedTable)
    return new Map([
      ...targets,
      [
        field.relatedTable,
        {
          keys: [...new Set([...(previous?.keys ?? []), ...named])],
          existence: (previous?.existence ?? false) || field.many,
        },
      ],
    ])
  }, new Map<string, { readonly keys: readonly string[]; readonly existence: boolean }>())

/** The first field of `write` naming a key its related table does not admit. */
const refusedField = (
  write: LinkTargetWrite,
  fields: readonly LinkField[],
  admitted: ReadonlyMap<string, Admitted>
): Effect.Effect<LinkField | undefined, DatabaseError> =>
  Effect.gen(function* () {
    const refusedKeys = (field: LinkField): readonly string[] => {
      const verdict = admitted.get(field.relatedTable) ?? 'all'
      return verdict === 'all' ? [] : keysNamed(write, field).filter((key) => !verdict.has(key))
    }
    const refused = fields.filter((field) => refusedKeys(field).length > 0)
    if (refused.length === 0) return undefined
    const needsHeld = refused.some((field) => !field.many)
    const held = needsHeld && write.held !== undefined ? yield* write.held : undefined
    const holds = (field: LinkField): boolean =>
      !field.many &&
      held !== undefined &&
      held !== null &&
      refusedKeys(field).every((key) => String(held[field.name] ?? '') === key)
    return refused.find((field) => !holds(field))
  })

/** The account ids a write's `fields` list under the list field `name`. */
const accountsNamed = (
  fields: Readonly<Record<string, unknown>>,
  name: string
): readonly string[] => (Object.hasOwn(fields, name) ? accountIdsOf(fields[name]) : [])

/**
 * The accounts each list of people names across the written `rows`, by field: what the
 * repository confirms again inside the write's own transaction, after the
 * early check below has refused an unknown account with no work done.
 */
export const namedAccounts = (
  app: App | undefined,
  tableName: string,
  rows: readonly Readonly<Record<string, unknown>>[]
): readonly AccountReference[] =>
  userListFieldNames(app?.tables?.find((t) => t.name === tableName)?.fields).flatMap((field) => {
    const ids = [...new Set(rows.flatMap((row) => accountsNamed(row, field)))]
    return ids.length === 0 ? [] : [{ field, ids }]
  })

/** How many account ids one existence read names, far below both engines' parameter ceilings. */
const ACCOUNT_CHECK_CHUNK = 500

/** The ids among `ids` that name an account, read in bounded chunks. */
const existingAccounts = (
  ids: readonly string[]
): Effect.Effect<ReadonlySet<string>, DatabaseError, AuthRepository> =>
  Effect.gen(function* () {
    const auth = yield* AuthRepository
    const chunks = Array.from({ length: Math.ceil(ids.length / ACCOUNT_CHECK_CHUNK) }, (_, i) =>
      ids.slice(i * ACCOUNT_CHECK_CHUNK, (i + 1) * ACCOUNT_CHECK_CHUNK)
    )
    const found = yield* Effect.forEach(chunks, (chunk) =>
      auth
        .getUserDisplayLabels(chunk)
        .pipe(
          Effect.mapError(
            (error) => new DatabaseError('Failed to check the accounts a list names', error)
          )
        )
    )
    return new Set(found.flatMap((labels) => [...labels.keys()]))
  })

/**
 * Refuse the write when a `user` field holding several people names an account
 * that does not exist. No foreign key can check a list column, so the ids are
 * read here, before the first write, and a list naming one missing account is
 * refused whole — nothing of it is written.
 */
const refuseUnknownAccounts = (
  app: App,
  tableName: string,
  writes: readonly LinkTargetWrite[]
): Effect.Effect<void, ForeignKeyViolationError | DatabaseError, AuthRepository> =>
  Effect.gen(function* () {
    const names = userListFieldNames(app.tables?.find((t) => t.name === tableName)?.fields)
    const ids = [
      ...new Set(
        writes.flatMap((write) => names.flatMap((name) => accountsNamed(write.fields, name)))
      ),
    ]
    if (ids.length === 0) return
    const existing = yield* existingAccounts(ids)
    const refused = names.find((name) =>
      writes.some((write) => accountsNamed(write.fields, name).some((id) => !existing.has(id)))
    )
    if (refused === undefined) return
    return yield* Effect.fail(
      new ForeignKeyViolationError(`referenced ${refused} does not exist`, refused)
    )
  })

/**
 * Refuse the write when any relationship value names a row its writer may not
 * read — or a many-to-many id that does not exist — with the failure a missing
 * row receives. Succeeds without reading anything when the write names no
 * target the writer could be refused.
 */
export const refuseUnreadableLinkTargets = (input: {
  readonly app: App | undefined
  /** The session the write runs as — used to confirm many-to-many ids exist. */
  readonly session: Readonly<UserSession>
  readonly tableName: string
  readonly writes: readonly LinkTargetWrite[]
  readonly reader: LinkReader | undefined
}): Effect.Effect<
  void,
  ForeignKeyViolationError | DatabaseError,
  TableRepository | DataSourceRepository | AuthRepository
> =>
  Effect.gen(function* () {
    const { app, session, tableName, writes, reader } = input
    if (app === undefined || writes.length === 0) return
    yield* refuseUnknownAccounts(app, tableName, writes)
    const fields = linkFieldsOf(app, tableName)
    if (fields.length === 0) return
    const targets = namedTargets(fields, writes)
    const verdicts = yield* Effect.forEach([...targets], ([relatedTable, target]) => {
      const related = app.tables?.find((t) => t.name === relatedTable)
      if (related === undefined) return Effect.succeed([relatedTable, 'all' as Admitted] as const)
      return admittedKeys(app, related, target.keys, {
        session,
        reader,
        existence: target.existence,
      }).pipe(Effect.map((admitted) => [relatedTable, admitted] as const))
    })
    const admitted = new Map(verdicts)
    const refused = yield* Effect.forEach(writes, (write) => refusedField(write, fields, admitted))
    const field = refused.find((candidate) => candidate !== undefined)
    if (field === undefined) return
    return yield* Effect.fail(
      new ForeignKeyViolationError(`referenced ${field.name} does not exist`, field.name)
    )
  }).pipe(Effect.withSpan('tables.refuse-unreadable-link-targets'))
