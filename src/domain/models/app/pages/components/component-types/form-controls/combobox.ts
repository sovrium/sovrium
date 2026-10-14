/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `combobox` — one choice found by typing, from a list that narrows with each
 * keystroke. shadcn/ui's Combobox, under its own name.
 *
 * ## A promotion, not a new control
 *
 * The control already ships: it is `select` with `searchable: true`. This type
 * is that control without the flag that selected it, so its key set is the
 * `select` keys that make sense for a list you type into, picked from
 * {@link selectFields} rather than redeclared — one definition of what
 * `options`, `dataSource`, `publishes` and `emptyOption` mean.
 *
 * Two `select` keys are left out on purpose, because each names a different
 * control: `searchable` (a combobox is always searchable) and `native` (the
 * browser's own control is `type: native-select`). The reporter refuses both
 * with a sentence naming the replacement.
 */

import { Schema } from 'effect'
import { selectFields } from './select'

export const ComboboxTypeLiteral = Schema.Literal('combobox')

export const comboboxFields = {
  props: selectFields.props,
  classes: selectFields.classes,
  visibility: selectFields.visibility,
  i18n: selectFields.i18n,
  options: selectFields.options,
  dataSource: selectFields.dataSource,
  publishes: selectFields.publishes,
  emptyOption: selectFields.emptyOption,
  defaultValue: selectFields.defaultValue,
  multiple: Schema.optional(
    Schema.Boolean.annotate({
      description:
        'Hold several choices, each found by typing; the field submits every chosen value under its name (default false).',
    })
  ),
  chips: Schema.optional(
    Schema.Boolean.annotate({
      defaultNote: 'false',
      description:
        "Draw each chosen value as a removable chip inside the field, beside the text input; requires multiple: true. shadcn/ui's ComboboxChips.",
    })
  ),
  /**
   * Redeclared rather than picked: the `select` copy is documented as "only
   * meaningful when `searchable: true`", which on a combobox is always true.
   */
  searchPlaceholder: Schema.optional(
    Schema.String.annotate({
      description:
        "Placeholder shown in the search field at the top of the combobox's list (shadcn/ui's Combobox input placeholder).",
      examples: ['Search frameworks...', 'Type a tag...'],
    })
  ),
  allowCustomValue: Schema.optional(
    Schema.Boolean.annotate({
      defaultNote: 'false',
      description:
        'Accept a typed value that matches no option as the combobox value, instead of offering only the listed options (default false).',
    })
  ),
} as const
