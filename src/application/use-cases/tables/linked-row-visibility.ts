/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Which linked rows a reader may see through a many-to-many field.
 *
 * A many-to-many field lists the keys of rows in ANOTHER table, and that table
 * has its own row-level read rule. Handing a reader every linked key would
 * confirm that rows they may not read exist, and how they are keyed — and the
 * relationship labels built from those keys would name them. So each link list
 * is narrowed to the rows the related table's `read.when` admits for this
 * reader, the same rule a direct read of those rows applies.
 *
 * The narrowing is a single `id IN (…)` read of the linked rows per related
 * table, judged in memory by the shared domain evaluator; a related table with
 * no read rule, or an unrestricted reader, costs nothing.
 */

import { Effect } from 'effect'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import { isGuestSession } from '@/domain/models/app/auth/guest-session'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import { rowPassesRule } from '@/domain/models/app/tables/row-level-write-decision-service'
import { readStoredValues } from '@/domain/models/app/tables/stored-value-service'
import { loadCurrentUserContext } from './permissions/row-level-enforcement'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type { DatabaseError } from '@/domain/errors'
import type { App, Table } from '@/domain/models/app'
import type { RelatedReader } from '@/domain/models/app/tables/related-field-read-service'

/** Who is reading: the session that asks and the role it holds. */
export interface LinkReader {
  readonly session: Readonly<UserSession>
  readonly role: string
  /**
   * The groups the reader belongs to (un-prefixed), when the caller resolved
   * them. A table whose read grant names a `group:` is readable through them.
   */
  readonly groups?: readonly string[]
}

/**
 * The reader as the related-value rule asks about her: her role and groups,
 * and whether she is a visitor who is not signed in — decided by her session's
 * identity (the guest sentinel), never by the name of her role.
 */
export const relatedReaderOf = (reader: LinkReader): RelatedReader => ({
  role: reader.role,
  groups: reader.groups,
  signedOut: isGuestSession(reader.session.userId),
})

/** The linked rows of one record, by field name. */
type LinkLists = Readonly<Record<string, readonly (string | number)[]>>

/** Linked rows keyed by source record id, then by field name. */
export type LinkMap = Readonly<Record<string, LinkLists>>

/** Every key the map links to under the given field names. */
const linkedKeys = (linkMap: LinkMap, fieldNames: readonly string[]): readonly string[] => [
  ...new Set(
    Object.values(linkMap).flatMap((lists) =>
      fieldNames.flatMap((name) => (lists[name] ?? []).map(String))
    )
  ),
]

/**
 * The rows among `keys` that `reader` may read in `relatedTable`, keyed by id,
 * or `undefined` when the table imposes no read rule on this reader.
 */
export const readableRows = (
  app: App,
  relatedTable: Table,
  keys: readonly string[],
  reader: LinkReader
): Effect.Effect<
  ReadonlyMap<string, Readonly<Record<string, unknown>>> | undefined,
  DatabaseError,
  TableRepository | DataSourceRepository | AuthRepository
> =>
  Effect.gen(function* () {
    const rlp = relatedTable.rowLevelPermissions
    if (rlp?.read?.when === undefined) return undefined
    const isUnrestricted = isAdminEquivalent(reader.role, app)
    if (isUnrestricted) return undefined
    if (keys.length === 0) return new Map<string, Readonly<Record<string, unknown>>>()
    const ctx = yield* loadCurrentUserContext(
      { userId: reader.session.userId, role: reader.role, isUnrestricted },
      rlp
    )
    const repo = yield* TableRepository
    const rows = yield* repo.listRecords({
      session: reader.session,
      tableName: relatedTable.name,
      filter: { and: [{ field: 'id', operator: 'in', value: keys }] },
    })
    return new Map(
      rows
        // Judged as the records API reads the row (SQLite `1`/`0` read as booleans).
        .filter((row) => rowPassesRule(rlp, 'read', readStoredValues(relatedTable, row), ctx))
        .map((row) => [String(row.id), row])
    )
  }).pipe(Effect.withSpan('tables.readable-linked-rows'))

/**
 * The keys among `keys` that `reader` may read in `relatedTable`, or
 * `undefined` when the table imposes no read rule on this reader.
 */
export const readableKeys = (
  app: App,
  relatedTable: Table,
  keys: readonly string[],
  reader: LinkReader
): Effect.Effect<
  ReadonlySet<string> | undefined,
  DatabaseError,
  TableRepository | DataSourceRepository | AuthRepository
> =>
  readableRows(app, relatedTable, keys, reader).pipe(
    Effect.map((rows) => (rows === undefined ? undefined : new Set(rows.keys()))),
    Effect.withSpan('tables.readable-linked-keys')
  )

/**
 * `linkMap` with every link the reader may not read removed. Fields whose
 * related table has no read rule pass through untouched.
 */
export const filterReadableLinks = (
  app: App | undefined,
  specs: readonly { readonly fieldName: string; readonly relatedTable: string }[],
  linkMap: LinkMap,
  reader: LinkReader | undefined
): Effect.Effect<LinkMap, DatabaseError, TableRepository | DataSourceRepository | AuthRepository> =>
  Effect.gen(function* () {
    if (app === undefined || reader === undefined) return linkMap
    const relatedTables = [...new Set(specs.map((spec) => spec.relatedTable))]
    const verdicts = yield* Effect.forEach(relatedTables, (name) => {
      const table = app.tables?.find((t) => t.name === name)
      if (table === undefined) return Effect.succeed([name, undefined] as const)
      const fieldNames = specs.filter((s) => s.relatedTable === name).map((s) => s.fieldName)
      return readableKeys(app, table, linkedKeys(linkMap, fieldNames), reader).pipe(
        Effect.map((readable) => [name, readable] as const)
      )
    })
    const readableByTable = new Map(verdicts)
    const relatedOf = new Map(specs.map((spec) => [spec.fieldName, spec.relatedTable]))
    const keep = (fieldName: string, key: string | number): boolean => {
      const readable = readableByTable.get(relatedOf.get(fieldName) ?? '')
      return readable === undefined || readable.has(String(key))
    }
    return Object.fromEntries(
      Object.entries(linkMap).map(([recordId, lists]) => [
        recordId,
        Object.fromEntries(
          Object.entries(lists).map(([fieldName, keys]) => [
            fieldName,
            keys.filter((key) => keep(fieldName, key)),
          ])
        ),
      ])
    )
  }).pipe(Effect.withSpan('tables.filter-readable-links'))
