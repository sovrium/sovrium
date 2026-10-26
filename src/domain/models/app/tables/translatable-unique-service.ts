/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A translatable `single-line-text` that is also `unique` ([internal ref] A1): unique
 * within each language, never across languages.
 *
 * The database holds it with one live-rows unique index per declared language,
 * `<table>_<field>_<code>_key`. The `_key` suffix keeps the name apart from the
 * non-unique `idx_<table>_<field>_<code>` of an `indexed` field. Neither engine
 * names the column of an expression index when it refuses a write, so the
 * field and the language are recovered from the index name, and only that way:
 * a reverse lookup of the name against the fields the caller wrote.
 *
 * Where an answer names the field, it names it with its language, `slug (fr)`.
 */

import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import { declaresTranslatable } from './translatable-field-service'

/** The one field type a translatable field may be `unique` on. */
export const UNIQUE_IN_EACH_LANGUAGE_TYPE = 'single-line-text'

/** The shape of a declared language code. */
const LANGUAGE_CODE = /^[a-z]{2}$/

/** Whether a declared field is a translatable `single-line-text` that is `unique`. */
export const isUniqueInEachLanguage = (field: object): boolean =>
  declaresTranslatable(field) &&
  (field as { readonly unique?: unknown }).unique === true &&
  (field as { readonly type?: unknown }).type === UNIQUE_IN_EACH_LANGUAGE_TYPE

/**
 * The name of the live-rows unique index holding `fieldName` unique in the
 * language `code`, on the relation `relationName`.
 */
export const languageUniqueIndexName = (
  relationName: string,
  fieldName: string,
  code: string
): string => `${sanitizeTableName(relationName)}_${fieldName}_${code}_key`

/** How an answer names a field in one language: `slug (fr)`. */
export const languageUniqueLabel = (fieldName: string, code: string): string =>
  `${fieldName} (${code})`

/**
 * The field a label names: `slug` for `slug (fr)`, any other name as it is. A
 * form draws a refusal on the field the visitor filled, in the language she
 * wrote in, so it reads the field back from the label.
 */
export const languageUniqueBaseField = (label: string): string =>
  /^(.+) \([a-z]{2}\)$/.exec(label)?.[1] ?? label

/** The field and the language one per-language unique index holds. */
export interface LanguageUniqueTarget {
  readonly field: string
  readonly code: string
}

/**
 * The field and language a per-language unique index name stands for, among
 * `fieldNames` — the longest name first, so `slug_fr_key` attributes to
 * `slug_fr` rather than to `slug` when both are candidates. `undefined` when the
 * name is not one of these indexes. `tableName` is the table's config name; a
 * view-backed table's rows live in `<table>_base`, whose indexes are accepted
 * too.
 */
export const languageUniqueTargetOf = (
  indexName: string,
  tableName: string,
  fieldNames: readonly string[]
): LanguageUniqueTarget | undefined => {
  const relation = sanitizeTableName(tableName)
  const rest = [`${relation}_base_`, `${relation}_`]
    .filter((prefix) => indexName.startsWith(prefix) && indexName.endsWith('_key'))
    .map((prefix) => indexName.slice(prefix.length, -'_key'.length))
  return fieldNames
    .toSorted((a, b) => b.length - a.length)
    .flatMap((field) =>
      rest.flatMap((middle) => {
        const code = middle.slice(field.length + 1)
        return middle.startsWith(`${field}_`) && LANGUAGE_CODE.test(code) ? [{ field, code }] : []
      })
    )
    .at(0)
}

/**
 * The per-language view a refused unique write is judged in: each translatable
 * unique field stands for one rule per declared language, keyed by its label
 * (`slug (fr)`), so the holder of a value is looked up — and judged — in the
 * language the value collides in.
 */
export interface LanguageUniqueView {
  /** Each label, with the field and language it stands for. */
  readonly targets: ReadonlyMap<string, LanguageUniqueTarget>
  /** The table's uniqueness rules, each translatable unique field split per language. */
  readonly sets: readonly (readonly string[])[]
  /** A record's values in that view: a map split per language, a string in every language. */
  readonly expand: (record: Readonly<Record<string, unknown>>) => Readonly<Record<string, unknown>>
}

/** {@link LanguageUniqueView} of `sets` for `fieldNames`, unique in each of `codes`. */
export const languageUniqueView = (
  sets: readonly (readonly string[])[],
  fieldNames: readonly string[],
  codes: readonly string[]
): LanguageUniqueView => {
  const targets = new Map(
    fieldNames.flatMap((field) =>
      codes.map((code) => [languageUniqueLabel(field, code), { field, code }] as const)
    )
  )
  const split = (set: readonly string[]): readonly (readonly string[])[] => {
    const [only] = set
    return set.length === 1 && only !== undefined && fieldNames.includes(only)
      ? codes.map((code) => [languageUniqueLabel(only, code)])
      : [set]
  }
  const valuesOf = (field: string, value: unknown): readonly (readonly [string, unknown])[] =>
    typeof value === 'object' && value !== null && !Array.isArray(value)
      ? codes.map(
          (code) =>
            [languageUniqueLabel(field, code), (value as Record<string, unknown>)[code]] as const
        )
      : codes.map((code) => [languageUniqueLabel(field, code), value] as const)
  return {
    targets,
    sets: sets.flatMap(split),
    expand: (record) => {
      const present = fieldNames.filter((field) => field in record)
      if (present.length === 0) return record
      const rest = Object.fromEntries(
        Object.entries(record).filter(([key]) => !present.includes(key))
      )
      const perLanguage = present.flatMap((field) =>
        valuesOf(field, record[field]).filter(([, value]) => value !== undefined)
      )
      return { ...rest, ...Object.fromEntries(perLanguage) }
    },
  }
}
