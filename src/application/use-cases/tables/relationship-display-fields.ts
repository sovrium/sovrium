/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Pure derivation of which relationship columns can show a human label, and of
 * the label block a read surface renders from.
 *
 * A relationship column stores the related row's identifier. A field declaring
 * `displayField` has already named the column that identifies that row to a
 * person, so a read surface has everything it needs — except the join. This
 * module says which columns qualify, which identifiers a page of records
 * references, and how the resolved labels attach to each record.
 *
 * The stored identifier is never replaced. It stays exactly where it was, so
 * filters, sorting, the editors and every write path keep seeing the key they
 * store; the labels ride alongside under `_display`, which read surfaces
 * consult and everything else ignores.
 */

import { isOpenToEveryone, toPermissionValue } from '@/domain/models/app/auth/permission-evaluation'
import { hasReadPermissionForRoles } from '@/domain/models/app/auth/permission-evaluator-service'
import { isFieldReadableByCaller } from '@/domain/models/app/tables/field-read-filter-service'
import { buildEffectiveRoles } from './user-groups'
import type { App } from '@/domain/models/app'

type SchemaField = {
  readonly name?: unknown
  readonly type?: unknown
  readonly relatedTable?: unknown
  readonly displayField?: unknown
}

/** A relationship column that declared the column identifying its target. */
export interface RelationshipDisplaySpec {
  readonly fieldName: string
  readonly relatedTable: string
  readonly displayField: string
}

/** Per-record labels: field name → the label(s) behind its stored key(s). */
export type RecordDisplayLabels = Record<string, string | readonly string[]>

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0

/** Does `table` declare a field called `fieldName`? */
const tableDeclares = (tables: App['tables'], table: string, fieldName: string): boolean =>
  tables?.find((t) => t.name === table)?.fields.some((f) => f.name === fieldName) === true

/**
 * The reader a label is resolved FOR.
 *
 * A label is a value read from the RELATED table, so it is shown only to a
 * caller who could read that value there directly. `groups` are un-prefixed
 * group names, matched by `group:<name>` grants exactly as the record read
 * itself matches them.
 */
export interface LabelReader {
  readonly role: string
  readonly groups?: readonly string[]
}

/**
 * A label a REQUEST asks for — `?labels=<field>:<relatedField>` — rather than
 * one the table declared.
 */
export interface RequestedLabel {
  readonly fieldName: string
  readonly displayField: string
}

/**
 * Turn one relationship field into a spec, or nothing.
 *
 * A column is included only when the table it points at really declares the
 * named column. A typo therefore falls back to showing the identifier — the
 * behaviour before any of this existed — instead of failing the whole list
 * request, which is the wrong price for a misspelling in config or in a URL.
 */
const toSpec = (
  tables: App['tables'],
  raw: unknown,
  displayField: unknown
): readonly RelationshipDisplaySpec[] => {
  const field = raw as SchemaField
  if (field.type !== 'relationship') return []
  if (!isNonEmptyString(field.name)) return []
  if (!isNonEmptyString(field.relatedTable)) return []
  if (!isNonEmptyString(displayField)) return []
  if (!tableDeclares(tables, field.relatedTable, displayField)) return []
  return [{ fieldName: field.name, relatedTable: field.relatedTable, displayField }]
}

/**
 * The declared specs with the requested ones laid over them.
 *
 * A requested pair REPLACES the declared label of the same field for this read:
 * a page column naming the field it shows is the more specific instruction, and
 * the table-level `displayField` stays the default wherever nothing asks.
 */
const mergeSpecs = (
  tables: App['tables'],
  fields: readonly unknown[],
  requested: readonly RequestedLabel[]
): readonly RelationshipDisplaySpec[] => {
  const declared = fields.flatMap((raw) => toSpec(tables, raw, (raw as SchemaField).displayField))
  const asked = requested.flatMap((pair) => {
    const field = fields.find((raw) => (raw as SchemaField).name === pair.fieldName)
    return field === undefined ? [] : toSpec(tables, field, pair.displayField)
  })
  const byField = new Map([...declared, ...asked].map((spec) => [spec.fieldName, spec] as const))
  return [...byField.values()]
}

/**
 * The role an unauthenticated caller carries in an app that HAS auth.
 *
 * Such a caller reaches a table's records only when its `read` is `'all'` —
 * the auth middleware answers 401 before any evaluator runs, because the
 * evaluator's ladder admits every role, `guest` included, on `'authenticated'`
 * and on an undeclared read. A label bypasses that middleware (it is read from
 * the RELATED table inside another table's request), so the same one-rung rule
 * is applied here. An app without auth has no anonymous caller to tell apart:
 * every request is `guest` and the evaluator is the whole gate.
 */
const ANONYMOUS_ROLE = 'guest'

const isAnonymousReader = (app: App, reader: LabelReader): boolean =>
  app.auth !== undefined && reader.role === ANONYMOUS_ROLE

/**
 * May `reader` see the label a spec would resolve?
 *
 * Exactly the two checks a direct read of the same column goes through: the
 * related TABLE must admit the reader, and the named FIELD of it must be
 * readable by them. Without this a column reserved for admins on `authors`
 * reached every viewer of `posts` one hop away, as the label of its key.
 */
const readerMaySee = (app: App, reader: LabelReader, spec: RelationshipDisplaySpec): boolean => {
  const relatedTable = app.tables?.find((t) => t.name === spec.relatedTable)
  if (relatedTable === undefined) return false
  if (
    isAnonymousReader(app, reader) &&
    !isOpenToEveryone(toPermissionValue(relatedTable.permissions?.read))
  ) {
    return false
  }
  const groups = reader.groups ?? []
  const effectiveRoles = buildEffectiveRoles(reader.role, groups)
  if (!hasReadPermissionForRoles(relatedTable, effectiveRoles, app.tables)) return false
  return isFieldReadableByCaller(
    app,
    spec.relatedTable,
    { role: reader.role, groups },
    spec.displayField
  )
}

/**
 * The relationship columns on `tableName` whose target `reader` may see
 * labelled — the declared `displayField`s, overridden per field by `requested`,
 * then narrowed to the labels the reader is allowed to read.
 */
export const getRelationshipDisplaySpecs = (
  app: App | undefined,
  tableName: string,
  reader: LabelReader,
  requested: readonly RequestedLabel[] = []
): readonly RelationshipDisplaySpec[] => {
  const table = app?.tables?.find((t) => t.name === tableName)
  if (!app || !table) return []
  return mergeSpecs(app.tables, table.fields, requested).filter((spec) =>
    readerMaySee(app, reader, spec)
  )
}

/**
 * Parse `?labels=<field>:<relatedField>[,…]` into the pairs it asks for.
 *
 * Lenient on purpose: a malformed entry is dropped, never a 400, because a
 * label is decoration and a misspelt one should cost the label rather than the
 * page. Whether a well-formed pair names a real relationship is decided later,
 * against the schema, by {@link getRelationshipDisplaySpecs}.
 */
export const parseRequestedLabels = (raw: string | undefined): readonly RequestedLabel[] =>
  (raw ?? '').split(',').flatMap((entry): readonly RequestedLabel[] => {
    const [fieldName, displayField, ...rest] = entry.split(':').map((part) => part.trim())
    if (rest.length > 0 || !isNonEmptyString(fieldName) || !isNonEmptyString(displayField)) {
      return []
    }
    return [{ fieldName, displayField }]
  })

/** The stored key(s) a single relationship cell references, if any. */
const keysOf = (value: unknown): readonly (string | number)[] => {
  if (Array.isArray(value)) {
    return value.filter((v): v is string | number => typeof v === 'string' || typeof v === 'number')
  }
  if (typeof value === 'string' && value.length > 0) return [value]
  if (typeof value === 'number') return [value]
  return []
}

/**
 * Every identifier a page of records references, per (table, column) pair.
 *
 * Collapsed across records and across columns so two columns pointing at the
 * same table through the same display column resolve in one query rather than
 * two — and so the read stays one query per pair however many rows are listed.
 */
export const collectReferencedKeys = (
  specs: readonly RelationshipDisplaySpec[],
  records: readonly { readonly fields: Readonly<Record<string, unknown>> }[]
): readonly { relatedTable: string; displayField: string; ids: readonly (string | number)[] }[] => {
  const byPair = specs.reduce<Record<string, readonly (string | number)[]>>((acc, spec) => {
    const key = `${spec.relatedTable}.${spec.displayField}`
    const ids = records.flatMap((record) => keysOf(record.fields[spec.fieldName]))
    return { ...acc, [key]: [...(acc[key] ?? []), ...ids] }
  }, {})

  return Object.entries(byPair).flatMap(([key, ids]) => {
    const [relatedTable = '', displayField = ''] = key.split('.')
    const unique = [...new Set(ids)]
    return unique.length === 0 ? [] : [{ relatedTable, displayField, ids: unique }]
  })
}

/**
 * The `_display` block for one record, or `undefined` when it references
 * nothing that resolved.
 *
 * A key whose row has since been deleted keeps its identifier rather than
 * vanishing: a dangling link should stay visible as a link, and dropping it
 * would also change how many entries a to-many cell renders.
 */
export const buildRecordDisplayLabels = (
  specs: readonly RelationshipDisplaySpec[],
  fields: Readonly<Record<string, unknown>>,
  labels: Readonly<Record<string, Readonly<Record<string, string>>>>
): Readonly<RecordDisplayLabels> | undefined => {
  const entries = specs.flatMap((spec): readonly (readonly [string, string | string[]])[] => {
    const byId = labels[`${spec.relatedTable}.${spec.displayField}`]
    if (!byId) return []
    const raw = fields[spec.fieldName]
    const keys = keysOf(raw)
    if (keys.length === 0) return []
    const resolved = keys.map((key) => byId[String(key)] ?? String(key))
    // Preserve the cell's shape: a to-one column labels to a string, a to-many
    // column to a list, so a renderer can tell one pill from many without
    // re-reading the schema.
    return [[spec.fieldName, Array.isArray(raw) ? resolved : (resolved[0] ?? String(keys[0]))]]
  })
  return entries.length === 0 ? undefined : Object.fromEntries(entries)
}

/**
 * The field types that store an ACCOUNT id — the person a read surface should
 * name rather than the key it stores.
 */
const USER_FIELD_TYPES: ReadonlySet<string> = new Set([
  'user',
  'created-by',
  'updated-by',
  'deleted-by',
])

/**
 * The fields of `tableName` that store an account id.
 *
 * No reader narrowing here, unlike a relationship's: the label is the account's
 * own name, not a value of another table, and it rides on a field the record
 * read already cleared for this caller — a field the caller may not read never
 * reaches the enrichment, so neither does its label.
 */
export const getUserDisplayFieldNames = (
  app: App | undefined,
  tableName: string
): readonly string[] =>
  (app?.tables?.find((t) => t.name === tableName)?.fields ?? []).flatMap((field) => {
    const { name, type } = field as SchemaField
    return isNonEmptyString(name) && typeof type === 'string' && USER_FIELD_TYPES.has(type)
      ? [name]
      : []
  })

/** Every account id a page of records stores in `fieldNames`, once each. */
export const collectReferencedUserIds = (
  fieldNames: readonly string[],
  records: readonly { readonly fields: Readonly<Record<string, unknown>> }[]
): readonly string[] => [
  ...new Set(
    records.flatMap((record) =>
      fieldNames.flatMap((name) => keysOf(record.fields[name]).map(String))
    )
  ),
]

/**
 * The user-field part of one record's `_display` block, or `undefined` when
 * none of its account ids resolved.
 *
 * An id naming no account keeps its key, as a dangling relationship key does,
 * and the cell's shape is preserved: one id labels to a string, several to a
 * list.
 */
export const buildUserDisplayLabels = (
  fieldNames: readonly string[],
  fields: Readonly<Record<string, unknown>>,
  labels: ReadonlyMap<string, string>
): Readonly<RecordDisplayLabels> | undefined => {
  const entries = fieldNames.flatMap((name): readonly (readonly [string, string | string[]])[] => {
    const raw = fields[name]
    const keys = keysOf(raw).map(String)
    if (!keys.some((key) => labels.has(key))) return []
    const resolved = keys.map((key) => labels.get(key) ?? key)
    return [[name, Array.isArray(raw) ? resolved : (resolved[0] ?? keys[0] ?? '')]]
  })
  return entries.length === 0 ? undefined : Object.fromEntries(entries)
}
