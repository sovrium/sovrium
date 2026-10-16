/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { optionColor, type SelectOptionLike } from '@/domain/models/app/tables/select-option'
import { readColumnOptions } from '@/presentation/render/forms/form-field-resolver'
import type { Languages } from '@/domain/models/app/languages'

/**
 * Give every option field in a grid's field meta its options as
 * `{ value, label, color? }`, each label resolved in the page language.
 *
 * The island has no translation catalogue, so a chip could only ever print the
 * stored value: a `$t:` label would have reached it as a raw key. The labels
 * are resolved here, by the same reader a `formRef` form and the record drawer
 * use (`readColumnOptions`), so one record reads the same on every surface of
 * the page. The colour rides along unchanged; the value is never localized.
 */
export function withResolvedOptionLabels(
  fieldMeta: Record<string, unknown> | undefined,
  languages: Languages | undefined,
  activeLang: string | undefined
): Record<string, unknown> | undefined {
  if (fieldMeta === undefined) return undefined
  return Object.fromEntries(
    Object.entries(fieldMeta).map(([name, meta]) => {
      const entry = meta as { readonly type?: string; readonly options?: unknown }
      const labelled = readColumnOptions(entry, languages, activeLang)
      if (labelled === undefined) return [name, meta]
      const declared = entry.options as readonly SelectOptionLike[]
      const options = labelled.map((option, index) => {
        const color = optionColor(declared[index]!)
        return color === undefined ? option : { ...option, color }
      })
      return [name, { ...entry, options }]
    })
  )
}

type OptionField = Readonly<{ readonly type?: string; readonly options?: unknown }> | undefined

/**
 * `value → label` for one option field, each label resolved in `activeLang`
 * by the reader every surface shares (`readColumnOptions`). `keepIdentical:
 * false` drops an option whose label reads as its value — what a reader that
 * falls back to the value itself needs no entry for. Empty for any other field.
 */
export function optionLabelsOf(
  field: OptionField,
  languages: Languages | undefined,
  options: { readonly activeLang: string | undefined; readonly keepIdentical: boolean }
): Readonly<Record<string, string>> {
  const labelled = readColumnOptions(field, languages, options.activeLang) ?? []
  return Object.fromEntries(
    labelled
      .filter((option) => options.keepIdentical || option.label !== option.value)
      .map((option) => [option.value, option.label] as const)
  )
}

/**
 * `value → label` for one select or status field, each label resolved in the
 * page language, or `undefined` when no option reads differently from its
 * value. What a board's column and lane headers print (`option-labels`): the
 * island keys every column by the stored value and only READS the label.
 */
export function optionLabelMap(
  field: OptionField,
  languages: Languages | undefined,
  activeLang: string | undefined
): Readonly<Record<string, string>> | undefined {
  const labels = optionLabelsOf(field, languages, { activeLang, keepIdentical: false })
  return Object.keys(labels).length === 0 ? undefined : labels
}
