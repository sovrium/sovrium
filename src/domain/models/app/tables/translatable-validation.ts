/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a translatable field cannot be combined with, refused when the config
 * is read.
 *
 * A translatable field holds one value per declared language in one column.
 * Anything that needs ONE stored value per row is refused:
 *
 * - `writeOnly`: a value nobody reads back gains nothing from being kept per
 *   language;
 * - `unique` on any type but a `single-line-text` (where it holds within each
 *   language), and a table `unique` entry or unique index naming the field:
 *   a value held unique together with other columns has no per-language
 *   meaning;
 * - `fullTextSearch`: the word-search index is built over one text column;
 * - an app declaring fewer than two languages: there is nothing to translate;
 * - a formula, a rollup or a row-level permission condition naming it: a
 *   stored or generated value cannot vary per request.
 *
 * A `default` given per language (a map) is only meaningful on a translatable
 * field, and only for languages the app declares.
 */

import { extractFieldReferences } from './table-formula-validation'
import {
  declaresTranslatable,
  isLanguageMapShape,
  recordLanguageOrder,
  undeclaredLanguageKeys,
  type RecordLanguages,
} from './translatable-field-service'
import { UNIQUE_IN_EACH_LANGUAGE_TYPE } from './translatable-unique-service'

/** The slice of a field these checks read. */
interface FieldLike {
  readonly name: string
  readonly type: string
  readonly [option: string]: unknown
}

/** The slice of a table these checks read. */
interface TableLike {
  readonly name: string
  readonly fields: readonly FieldLike[]
  readonly unique?: ReadonlyArray<{ readonly fields: ReadonlyArray<string> }> | undefined
  readonly indexes?:
    | ReadonlyArray<{
        readonly fields: ReadonlyArray<string>
        readonly unique?: boolean | undefined
      }>
    | undefined
  readonly rowLevelPermissions?: unknown
}

/** The slice of the app these checks read. */
export interface TranslatableAppLike {
  readonly languages?: RecordLanguages | undefined
  readonly tables?: readonly TableLike[] | undefined
}

/** The options a translatable field refuses on itself. */
const REFUSED_OPTIONS = ['writeOnly', 'unique', 'fullTextSearch'] as const

/** What each refused option would need that a per-language value cannot give. */
const REFUSAL_REASON: Readonly<Record<(typeof REFUSED_OPTIONS)[number], string>> = {
  writeOnly: 'a value no one reads back has no language to be read in',
  unique: `only a ${UNIQUE_IN_EACH_LANGUAGE_TYPE} can be unique, within each language`,
  fullTextSearch: 'the word-search index reads one text column, not one value per language',
}

/** Whether `option` set on `field` is refused: `unique` is accepted on a single-line text. */
const refuses = (field: FieldLike, option: (typeof REFUSED_OPTIONS)[number]): boolean =>
  field[option] === true && (option !== 'unique' || field.type !== UNIQUE_IN_EACH_LANGUAGE_TYPE)

/** The translatable field names of a table. */
const translatableNames = (table: TableLike): readonly string[] =>
  table.fields.filter(declaresTranslatable).map((field) => field.name)

/** `writeOnly`, `fullTextSearch`, or `unique` off a single-line text, set on a translatable field. */
const ownOptionError = (table: TableLike): string | undefined => {
  const found = table.fields
    .filter(declaresTranslatable)
    .flatMap((field) =>
      REFUSED_OPTIONS.filter((option) => refuses(field, option)).map((option) => ({
        field,
        option,
      }))
    )
    .at(0)
  if (found === undefined) return undefined
  const on = found.option === 'unique' ? ` on a ${found.field.type} field` : ''
  return `Field "${found.field.name}": translatable cannot be combined with ${found.option}${on} — ${REFUSAL_REASON[found.option]}`
}

/** A table `unique` entry or unique index naming a translatable field. */
const uniqueEntryError = (
  table: TableLike,
  translatable: readonly string[]
): string | undefined => {
  const entries = [
    ...(table.unique ?? []).map((entry, position) => ({
      fields: entry.fields,
      at: `unique.${position}`,
    })),
    ...(table.indexes ?? []).flatMap((index, position) =>
      index.unique === true ? [{ fields: index.fields, at: `indexes.${position}` }] : []
    ),
  ]
  const found = entries
    .map((entry) => ({ ...entry, field: entry.fields.find((name) => translatable.includes(name)) }))
    .find((entry) => entry.field !== undefined)
  return found?.field === undefined
    ? undefined
    : `Table "${table.name}": ${found.at} names translatable field "${found.field}" — uniqueness declared on the table has no per-language meaning; declare unique on the field itself, where it holds within each language`
}

/** A formula of the table reading one of its translatable fields. */
const formulaError = (table: TableLike, translatable: readonly string[]): string | undefined => {
  const found = table.fields
    .flatMap((field) => {
      const expression = field.formula
      if (field.type !== 'formula' || typeof expression !== 'string') return []
      const read = extractFieldReferences(expression).find((name) => translatable.includes(name))
      return read === undefined ? [] : [{ field: field.name, read }]
    })
    .at(0)
  return found === undefined
    ? undefined
    : `Formula field "${found.field}" cannot read translatable field "${found.read}" — a computed value is stored once, and a translatable value differs by language`
}

/** Every field name a row-level `when` names, at any depth of its groups. */
const conditionFields = (when: unknown): readonly string[] => {
  if (!isLanguageMapShape(when)) return []
  const own = typeof when.field === 'string' ? [when.field] : []
  const children = Array.isArray(when.conditions) ? when.conditions.flatMap(conditionFields) : []
  return [...own, ...children]
}

/** A row-level permission condition naming a translatable field of the table. */
const rowConditionError = (
  table: TableLike,
  translatable: readonly string[]
): string | undefined => {
  const rules = isLanguageMapShape(table.rowLevelPermissions)
    ? Object.values(table.rowLevelPermissions)
    : []
  const named = rules
    .flatMap((rule) => (isLanguageMapShape(rule) ? conditionFields(rule.when) : []))
    .find((name) => translatable.includes(name))
  return named === undefined
    ? undefined
    : `Table "${table.name}": a row-level permission condition cannot name translatable field "${named}" — the condition compares one stored value, and a translatable value differs by language`
}

/** The table a rollup of `table` reads through `relationshipField`. */
const relatedTableOf = (
  table: TableLike,
  relationshipField: unknown,
  tables: readonly TableLike[]
): TableLike | undefined => {
  const own = table.fields.find(
    (field) => field.name === relationshipField && field.type === 'relationship'
  )
  if (own !== undefined) return tables.find((other) => other.name === own.relatedTable)
  return tables.find(
    (other) =>
      other.name !== table.name &&
      other.fields.some(
        (field) =>
          field.name === relationshipField &&
          field.type === 'relationship' &&
          field.relatedTable === table.name
      )
  )
}

/** A rollup reading a translatable field of the table it rolls up. */
const rollupError = (tables: readonly TableLike[]): string | undefined => {
  const found = tables
    .flatMap((table) =>
      table.fields.flatMap((field) => {
        if (field.type !== 'rollup') return []
        const related = relatedTableOf(table, field.relationshipField, tables)
        const read = field.relatedField
        return related !== undefined &&
          typeof read === 'string' &&
          translatableNames(related).includes(read)
          ? [{ field: field.name, read, related: related.name }]
          : []
      })
    )
    .at(0)
  return found === undefined
    ? undefined
    : `Rollup field "${found.field}" cannot read translatable field "${found.read}" of table "${found.related}" — a rollup is computed once, and a translatable value differs by language`
}

/** A map `default` on a field that is not translatable, or naming an undeclared language. */
const defaultError = (table: TableLike, declared: readonly string[]): string | undefined =>
  table.fields
    .flatMap((field) => {
      if (!isLanguageMapShape(field.default)) return []
      if (!declaresTranslatable(field)) {
        return [
          `Field "${field.name}": a default given per language needs translatable: true — write the default as one string, or make the field translatable`,
        ]
      }
      const unknown = undeclaredLanguageKeys(field.default, declared)
      return unknown.length === 0
        ? []
        : [
            `Field "${field.name}": the default names ${unknown.map((code) => `"${code}"`).join(', ')}, which app.languages does not declare — declared: ${declared.join(', ')}`,
          ]
    })
    .at(0)

/** A translatable field in an app declaring fewer than two languages. */
const languageCountError = (
  tables: readonly TableLike[],
  declared: readonly string[]
): string | undefined => {
  if (declared.length >= 2) return undefined
  const found = tables
    .flatMap((table) => translatableNames(table).map((field) => ({ table: table.name, field })))
    .at(0)
  if (found === undefined) return undefined
  const has = declared.length === 0 ? 'declares none' : `declares only "${declared[0] ?? ''}"`
  return `Field "${found.field}" of table "${found.table}" is translatable, which needs at least two languages in app.languages; the app ${has}`
}

/** The first problem one table has with its translatable fields. */
const tableError = (table: TableLike, declared: readonly string[]): string | undefined => {
  const translatable = translatableNames(table)
  return (
    defaultError(table, declared) ??
    (translatable.length === 0
      ? undefined
      : (ownOptionError(table) ??
        uniqueEntryError(table, translatable) ??
        formulaError(table, translatable) ??
        rowConditionError(table, translatable)))
  )
}

/**
 * The first problem the app's translatable fields have, as a message — or
 * `true` when there is none.
 */
export const validateTranslatableContent = (app: TranslatableAppLike): true | string => {
  const tables = app.tables ?? []
  const declared = recordLanguageOrder(app.languages)
  return (
    languageCountError(tables, declared) ??
    tables.map((table) => tableError(table, declared)).find((error) => error !== undefined) ??
    rollupError(tables) ??
    true
  )
}
