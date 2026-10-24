/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Which rows of a table a reader may read, once its table read rule has let
 * her in — decided in one order: the table, then the grants a table listed in
 * `auth.scopeTables` holds for her, then the field rules.
 *
 * A row in which a reader may read no field — on a table whose own field
 * rules, scope or write-only fields decide what she reads, or whose every field
 * is read through a table she may not read — judged from what
 * she would receive once every trim has run — is not a row she may read: it
 * is not listed
 * nor counted, it answers as a row that does not exist, and a link to many
 * records does not name it. So a reader whose own role reads no field
 * of the table reads only the rows a grant admits with a role that reads one,
 * and a reader with neither reads no row at all. A granted row answers with
 * every field she may read under her role or under a role a grant gives her on
 * that row.
 */

import { SIGNED_OUT_VISITOR_ROLE } from '@/domain/models/app/auth/permission-evaluation'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import {
  declaresFieldRules,
  isFieldReadableByCaller,
  isSystemField,
} from './field-read-filter-service'
import { countLinksOf, relatedFieldsWithheldFrom, withFormulasOver } from './lookup-link-service'
import { declaresWriteOnly } from './write-only-field-service'
import type { RelatedReader } from './related-field-read-service'
import type { App } from '@/domain/models/app'

/** The rows a reader may read: every row, the rows a grant admits, or none. */
export type RowReadAdmission =
  | { readonly kind: 'every-row' }
  | { readonly kind: 'granted-rows'; readonly ids: readonly string[] }
  | { readonly kind: 'no-row' }

/** Each row a grant names, keyed by its id, with the roles granted on it. */
export type RowGrants = ReadonlyMap<string, readonly string[]>

/**
 * The declared fields of `tableName` a record shows `reader` under `fields`:
 * those her field rules let her read, less those a related-value rule
 * withholds ({@link relatedFieldsWithheldFrom}). System columns, answered
 * beside `fields` to every reader, are not counted.
 */
export const recordFieldsReadableBy = (
  app: App,
  tableName: string,
  reader: RelatedReader
): readonly string[] => {
  const table = app.tables?.find((candidate) => candidate.name === tableName)
  const withheld = relatedFieldsWithheldFrom(app, tableName, reader)
  const caller = { role: reader.role, groups: reader.groups ?? [] }
  return (table?.fields ?? [])
    .map((field) => field.name)
    .filter((name) => !isSystemField(name) && !withheld.has(name))
    .filter((name) => isFieldReadableByCaller(app, tableName, caller, name))
}

/** The fields of `tableName` a record could show: every declared field but the system columns. */
const userFieldsOf = (app: App, tableName: string): readonly { readonly name: string }[] =>
  (app.tables?.find((candidate) => candidate.name === tableName)?.fields ?? []).filter(
    (field) => !isSystemField(field.name)
  )

/**
 * Whether `tableName` itself decides, for every reader alike, that a record
 * is judged from the fields she would receive: it declares field rules
 * (`permissions.fields`), is a scope table, or holds a write-only field.
 */
const declaresReadTrim = (app: App, tableName: string): boolean => {
  const table = app.tables?.find((candidate) => candidate.name === tableName)
  return (
    declaresFieldRules(app, tableName) ||
    isScopeTable(app, tableName) ||
    (table?.fields ?? []).some(declaresWriteOnly)
  )
}

/** Field types whose value is read from another table: a lookup, a rollup or a count. */
const RELATED_VALUE_TYPES: ReadonlySet<string> = new Set(['lookup', 'rollup', 'count'])

/** Whether `field` is a link to many records: one-to-many or many-to-many. */
const isToManyLink = (field: { readonly type: string }): boolean => {
  const { relationType } = field as { readonly relationType?: unknown }
  return (
    field.type === 'relationship' &&
    (relationType === 'one-to-many' || relationType === 'many-to-many')
  )
}

/**
 * The fields of `tableName` a related-value rule could withhold from SOME
 * reader: each link to many records, each lookup, rollup and count, and every
 * formula built over one. Judged on the schema alone — a superset of what
 * {@link relatedFieldsWithheldFrom} withholds from any one reader.
 */
const relatedValueFieldsOf = (app: App, tableName: string): ReadonlySet<string> => {
  const table = app.tables?.find((candidate) => candidate.name === tableName)
  const names = (table?.fields ?? [])
    .filter((field) => RELATED_VALUE_TYPES.has(field.type) || isToManyLink(field))
    .map((field) => field.name)
  return withFormulasOver(app, tableName, new Set(names))
}

/**
 * Whether a row of `tableName` could be closed to ANY reader for showing her
 * no field ({@link emptyRowCloses} for some reader) — decided on the schema
 * alone. When it is false every reader the table's read rule lets in reads
 * every row, so a question about many readers at once needs no reader's
 * answer.
 */
export const emptyRowMayClose = (app: App, tableName: string): boolean => {
  const fields = userFieldsOf(app, tableName)
  if (fields.length === 0) return false
  if (declaresReadTrim(app, tableName)) return true
  const related = relatedValueFieldsOf(app, tableName)
  return fields.every((field) => related.has(field.name))
}

/**
 * Whether a row of `tableName` with no field its reader may read is closed to
 * her: the table declares a field a record could show, and something beyond
 * the built-in role defaults decides what she reads — its own field rules
 * (`permissions.fields`), a scope grant, a write-only field, or a rule on a
 * related value that withholds every field from her (a table whose fields are
 * all read through a table she may not read: the link to it, and the counts,
 * rollups, lookups and formulas over it). Once it does, the record is judged
 * from what she would receive after every trim, the defaults included. The
 * defaults alone trim a record; they never hide it.
 */
const emptyRowCloses = (app: App, tableName: string, reader: RelatedReader): boolean => {
  if (!emptyRowMayClose(app, tableName)) return false
  if (declaresReadTrim(app, tableName)) return true
  const withheld = relatedFieldsWithheldFrom(app, tableName, reader)
  return userFieldsOf(app, tableName).every((field) => withheld.has(field.name))
}

/** Whether `tableName` is listed in `auth.scopeTables`. */
const isScopeTable = (app: App, tableName: string): boolean =>
  (app.auth?.scopeTables ?? []).includes(tableName)

/** `reader` holding `role` in place of her own, her groups kept. */
const asGrantRole = (reader: RelatedReader, role: string): RelatedReader => ({
  ...reader,
  role,
  signedOut: false,
})

/**
 * The rows of `tableName` `reader` may read, given the rows her grants name
 * on it ({@link RowGrants}; empty off a scope table). A table where an empty
 * row does not close ({@link emptyRowCloses}) is read row for row.
 */
export const rowReadAdmission = (
  app: App,
  tableName: string,
  reader: RelatedReader,
  grants: RowGrants
): RowReadAdmission => {
  if (!emptyRowCloses(app, tableName, reader)) return { kind: 'every-row' }
  if (recordFieldsReadableBy(app, tableName, reader).length > 0) return { kind: 'every-row' }
  const reads = (role: string): boolean =>
    recordFieldsReadableBy(app, tableName, asGrantRole(reader, role)).length > 0
  const ids = [...grants].filter(([, roles]) => roles.some(reads)).map(([id]) => id)
  return ids.length === 0 ? { kind: 'no-row' } : { kind: 'granted-rows', ids }
}

/**
 * Whether `field` is shown to `reader` on EVERY row `admission` admits her:
 * under her own role, or — when she reads only the rows a grant admits —
 * under a role a grant gives her on each of those rows. A figure over the
 * field then describes values she could read on every row she lists; a field
 * only some of her rows show her is not one a figure may run over.
 */
export const fieldReadOnEveryAdmittedRow = (
  read: { readonly app: App; readonly tableName: string; readonly reader: RelatedReader },
  rows: { readonly admission: RowReadAdmission; readonly grants: RowGrants },
  field: string
): boolean => {
  const { app, tableName, reader } = read
  if (recordFieldsReadableBy(app, tableName, reader).includes(field)) return true
  const { admission, grants } = rows
  // No admitted row shows her the field: `every` over none would say it does.
  if (admission.kind !== 'granted-rows' || admission.ids.length === 0) return false
  return admission.ids.every((id) =>
    (grants.get(id) ?? []).some((role) =>
      recordFieldsReadableBy(app, tableName, asGrantRole(reader, role)).includes(field)
    )
  )
}

/**
 * The fields a per-record grant opens, one field at a time: the rows `admission`
 * admits on which `field` is shown to `reader` ONLY because a grant gives her a
 * role that reads it there — or `'own-role'` when her own role reads it on
 * every row. A figure, filter or sort over such a field runs over exactly those
 * rows, the ones her list shows it on; an empty list means no row shows it.
 */
export const rowsGrantOpensField = (
  read: { readonly app: App; readonly tableName: string; readonly reader: RelatedReader },
  rows: { readonly admission: RowReadAdmission; readonly grants: RowGrants },
  field: string
): 'own-role' | readonly string[] => {
  const { app, tableName, reader } = read
  if (recordFieldsReadableBy(app, tableName, reader).includes(field)) return 'own-role'
  const { admission, grants } = rows
  if (admission.kind === 'no-row') return []
  const opens = (role: string): boolean =>
    recordFieldsReadableBy(app, tableName, asGrantRole(reader, role)).includes(field)
  return [...grants]
    .filter(([id, roles]) => admitsRow(admission, id) && roles.some(opens))
    .map(([id]) => id)
}

/**
 * A visitor who is not signed in, as a read judges her: the signed-out visitor
 * principal the records API judges her as (`SIGNED_OUT_VISITOR_ROLE`), in no
 * group — never the `guest` role name, which an app may declare and which
 * would satisfy an `'authenticated'` field rule.
 */
export const SIGNED_OUT_READER: RelatedReader = {
  role: SIGNED_OUT_VISITOR_ROLE,
  groups: [],
  signedOut: true,
}

/**
 * The reader a related-value rule judges for a caller holding `caller`'s role
 * and groups, or — with none — the visitor who is not signed in
 * ({@link SIGNED_OUT_READER}).
 */
export const relatedReaderFor = (
  caller: { readonly role: string; readonly groups?: readonly string[] } | undefined
): RelatedReader =>
  caller === undefined
    ? SIGNED_OUT_READER
    : { role: caller.role, groups: caller.groups ?? [], signedOut: false }

/**
 * The rows of `tableName` a visitor who is not signed in may read: every row
 * in an app without auth, else {@link rowReadAdmission} for her — she holds no
 * grant, so a table showing her no field admits her no row. The one answer for
 * her: the records list (`readerRowsOf`) returns it for every signed-out reader.
 */
export const signedOutRowAdmission = (app: App, tableName: string): RowReadAdmission =>
  app.auth === undefined
    ? { kind: 'every-row' }
    : rowReadAdmission(app, tableName, SIGNED_OUT_READER, new Map())

/** Whether a row with this id is one {@link rowReadAdmission} admits. */
export const admitsRow = (admission: RowReadAdmission, id: string): boolean =>
  admission.kind === 'every-row' ||
  (admission.kind === 'granted-rows' && admission.ids.includes(id))

/**
 * The callers a row is read under: the reader, then the reader holding each
 * role a grant gives her on that row, her groups kept.
 */
export const callersOfRow = <Caller extends { readonly role: string }>(
  caller: Caller,
  grants: RowGrants | undefined,
  id: unknown
): readonly Caller[] => [
  caller,
  ...(grants?.get(String(id)) ?? []).map((role) => ({ ...caller, role })),
]

/**
 * Whether `reader`'s list of `tableName` admits every row whatever grants she
 * holds — an app without auth, an admin-equivalent role, or a table where she
 * reads a field of her own or an empty row does not close. Judged on the
 * schema alone: only a reader for whom this is false has her grants read.
 */
export const readsEveryRow = (app: App, tableName: string, reader: RelatedReader): boolean =>
  app.auth === undefined ||
  isAdminEquivalent(reader.role, app) ||
  rowReadAdmission(app, tableName, reader, new Map()).kind === 'every-row'

/**
 * The counts of `tableName` — with every formula built over one — that
 * `reader` does not read as the database counts them: each over a related
 * table whose list admits her less than every row, whatever grants she holds
 * there (with no grant it admits her none, with one only the granted rows).
 * Judged on the schema alone, so a change stream can withhold them in memory
 * and a query can read them as empty wherever it names them.
 */
export const countsNarrowedFor = (
  app: App,
  tableName: string,
  reader: RelatedReader
): ReadonlySet<string> => {
  const counts = new Set(
    countLinksOf(app, tableName)
      .filter((link) => !readsEveryRow(app, link.relatedTable.name, reader))
      .map((link) => link.lookup)
  )
  return counts.size === 0 ? counts : withFormulasOver(app, tableName, counts)
}
