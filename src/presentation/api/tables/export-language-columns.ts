/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { recordLanguageOrder } from '@/domain/models/app/tables/translatable-field-service'
import { translatableFieldNamesOf } from '@/domain/models/app/tables/translatable-query-service'
import type { App } from '@/domain/models/app'

/**
 * The CSV export's columns for translatable fields ([internal ref] D4): one column
 * per declared language, `name.en`, `name.fr`, the spelling the CSV import
 * reads back. A spreadsheet user edits each language in its own cell, and the
 * file round-trips through the import. The JSON export keeps each map whole.
 */

/** One column of the CSV file: its header, the field it reads, and the language of a translatable one. */
export interface CsvColumn {
  readonly header: string
  readonly field: string
  readonly language?: string
}

/** The declared languages of each translatable field of `tableName`, default first. */
export const languageColumnsOf = (
  app: App,
  tableName: string
): ReadonlyMap<string, readonly string[]> => {
  const codes = recordLanguageOrder(app.languages)
  return new Map([...translatableFieldNamesOf(app, tableName)].map((field) => [field, codes]))
}

/** `fields` as CSV columns: a translatable field becomes one column per declared language. */
export const csvColumnsOf = (
  fields: readonly string[],
  languages: ReadonlyMap<string, readonly string[]>
): readonly CsvColumn[] =>
  fields.flatMap((field): readonly CsvColumn[] => {
    const codes = languages.get(field)
    return codes === undefined || codes.length === 0
      ? [{ header: field, field }]
      : codes.map((language) => ({ header: `${field}.${language}`, field, language }))
  })

/** One language's value of an exported map; empty when the map holds none. */
export const languageCellValue = (value: unknown, language: string): string => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return ''
  const text = (value as Readonly<Record<string, unknown>>)[language]
  return typeof text === 'string' ? text : ''
}
