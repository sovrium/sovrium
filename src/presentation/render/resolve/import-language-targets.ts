/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  declaresTranslatable,
  recordLanguageOrder,
} from '@/domain/models/app/tables/translatable-field-service'
import type { Languages } from '@/domain/models/app/languages'

/**
 * The CSV import's targets for a translatable field ([internal ref] D10): besides the
 * field itself — whose column fills the default language — one target per
 * declared language, `name.fr`, the spelling the import route files under that
 * language and the CSV export writes. A `name.fr` header then maps to the
 * French value by name, instead of matching `name` and overwriting the default
 * language with French text.
 */

/** What the import dialog maps a CSV onto: its target names and their metadata. */
interface ImportFields {
  readonly tableFields: readonly string[]
  readonly fieldMeta: Record<string, unknown>
}

/** The language label `code` is declared with, else the code. */
const languageLabel = (languages: Languages, code: string): string =>
  languages.supported.find((language) => language.code === code)?.label ?? code

/**
 * `fields` with one `<field>.<code>` target after each translatable field, per
 * language `languages` declares, each read as text and labelled with its
 * language. A per-language target is never required on its own. Unchanged
 * without languages or translatable fields.
 */
export const withLanguageTargets = (
  fields: ImportFields,
  table: { readonly fields: readonly object[] },
  languages: Languages | undefined
): ImportFields => {
  if (languages === undefined) return fields
  const translatable = new Set(
    table.fields
      .filter(declaresTranslatable)
      .map((field) => String((field as { readonly name?: unknown }).name))
  )
  const codes = recordLanguageOrder(languages)
  const targetsOf = (name: string): readonly string[] =>
    translatable.has(name) ? codes.map((code) => `${name}.${code}`) : []
  const added = fields.tableFields.flatMap((name) =>
    targetsOf(name).map((target, index) => {
      const { required: _required, ...meta } = (fields.fieldMeta[name] ?? {}) as Readonly<
        Record<string, unknown>
      >
      const label = typeof meta['label'] === 'string' ? meta['label'] : name
      const code = codes[index] ?? ''
      return [target, { ...meta, label: `${label} (${languageLabel(languages, code)})` }] as const
    })
  )
  if (added.length === 0) return fields
  return {
    tableFields: fields.tableFields.flatMap((name) => [name, ...targetsOf(name)]),
    fieldMeta: { ...fields.fieldMeta, ...Object.fromEntries(added) },
  }
}
