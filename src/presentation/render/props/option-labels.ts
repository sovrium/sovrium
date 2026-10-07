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
