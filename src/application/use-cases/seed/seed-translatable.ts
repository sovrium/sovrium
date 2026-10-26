/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Seed values of translatable fields.
 *
 * A translatable field is seeded with a string — the default language's value
 * — or with a map from language code to text. A map naming a language the app
 * does not declare, or holding something other than text, is refused before
 * anything is written: stored, the value would be kept but never served.
 */

import {
  declaresTranslatable,
  isLanguageMapShape,
  toLanguageMap,
  undeclaredLanguageKeys,
} from '@/domain/models/app/tables/translatable-field-service'
import { findSeedTable } from './seed-config'
import type { LoadedSeedFile, PlannedSeedRecord } from './seed-checks'
import type { SeedTableConfig } from './seed-config'

/** The translatable field names of a seeded table. */
const translatableFieldsOf = (table: SeedTableConfig | undefined): ReadonlySet<string> =>
  new Set((table?.fields ?? []).filter(declaresTranslatable).map((field) => field.name))

/** The refusal of one seed value of a translatable field, or `undefined`. */
const valueRefusal = (value: unknown, declared: readonly string[]): string | undefined => {
  if (!isLanguageMapShape(value)) return undefined
  const unknown = undeclaredLanguageKeys(value, declared)
  if (unknown.length > 0) {
    return `names ${unknown.map((code) => `"${code}"`).join(', ')}, which app.languages does not declare — declared: ${declared.join(', ')}`
  }
  const nonText = Object.entries(value).find(([, text]) => typeof text !== 'string')
  return nonText === undefined
    ? undefined
    : `gives "${nonText[0]}" a value that is not text — write each language's value as a string`
}

/**
 * Every seed value of a translatable field that names an undeclared language
 * or holds something other than text, as a message naming the file, the row,
 * the field and the language.
 *
 * @param declared - the app's language codes, default first
 */
export const checkTranslatableValues = (
  files: readonly LoadedSeedFile[],
  tables: readonly SeedTableConfig[],
  declared: readonly string[]
): readonly string[] =>
  files.flatMap((file) => {
    const translatable = translatableFieldsOf(findSeedTable(tables, file.table))
    return file.records.flatMap((record) =>
      Object.entries(record.fields).flatMap(([name, value]) => {
        if (!translatable.has(name)) return []
        const refusal = valueRefusal(value, declared)
        return refusal === undefined
          ? []
          : [`${file.fileName} (key "${record.key}"): field "${name}" ${refusal}`]
      })
    )
  })

/**
 * `records` with each translatable field's planned text as the map it is
 * stored as: a string becomes the default language's value.
 */
export const withLanguageMaps = (
  records: readonly PlannedSeedRecord[],
  table: SeedTableConfig | undefined,
  defaultLanguage: string | undefined
): readonly PlannedSeedRecord[] => {
  const translatable = translatableFieldsOf(table)
  if (translatable.size === 0 || defaultLanguage === undefined) return records
  return records.map((record) => ({
    ...record,
    fields: Object.fromEntries(
      Object.entries(record.fields).map(([name, value]) =>
        translatable.has(name) && value.kind === 'literal'
          ? [name, { kind: 'literal', value: toLanguageMap(value.value, defaultLanguage) ?? null }]
          : [name, value]
      )
    ),
  }))
}
