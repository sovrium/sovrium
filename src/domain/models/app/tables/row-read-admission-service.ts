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
 * rules, scope or write-only fields decide what she reads, judged from what
 * she would receive once every trim has run — is not a row she may read: it
 * is not listed
 * nor counted, it answers as a row that does not exist, and a link to many
 * records does not name it. So a reader whose own role reads no field
 * of the table reads only the rows a grant admits with a role that reads one,
 * and a reader with neither reads no row at all. A granted row answers with
 * every field she may read under her role or under a role a grant gives her on
 * that row.
 */

import {
  declaresFieldRules,
  isFieldReadableByCaller,
  isSystemField,
} from './field-read-filter-service'
import { relatedFieldsWithheldFrom } from './lookup-link-service'
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

/**
 * Whether a row of `tableName` with no field its reader may read is closed to
 * her: the table declares a field a record could show, and something beyond
 * the built-in role defaults decides what she reads — its own field rules
 * (`permissions.fields`), a scope grant, or a write-only field. Once it does,
 * the record is judged from what she would receive after every trim, the
 * defaults included. The defaults alone trim a record; they never hide it.
 */
const emptyRowCloses = (app: App, tableName: string): boolean => {
  const table = app.tables?.find((candidate) => candidate.name === tableName)
  const fields = (table?.fields ?? []).filter((field) => !isSystemField(field.name))
  if (fields.length === 0) return false
  return (
    declaresFieldRules(app, tableName) ||
    isScopeTable(app, tableName) ||
    fields.some(declaresWriteOnly)
  )
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
  if (!emptyRowCloses(app, tableName)) return { kind: 'every-row' }
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
