/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { OptionsSchema } from '../../form-controls'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'
import { SelectOptionSourceSchema } from './select-option-source'

export const SelectTypeLiteral = Schema.Literal('select')

export const selectFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  /**
   * Static option list. Mutually exclusive with `dataSource` — declaring both
   * is a boot error (`validateAllSelectOptionSources`), because the two answer
   * the same question and there is no defensible precedence between them.
   */
  options: Schema.optional(OptionsSchema),
  /**
   * Dynamic option source — resolve the option list from a table's rows.
   *
   * DELIBERATELY NARROW: this is NOT the shared rows-oriented `dataBoundFields`
   * binding (see `select-option-source.ts` for why), and it is REPLACED with a
   * concrete `options` array server-side before render, so no `select` reaches
   * the renderer still carrying one.
   */
  dataSource: Schema.optional(SelectOptionSourceSchema),
  defaultValue: Schema.optional(
    Schema.Union(Schema.String, Schema.Number, Schema.Boolean).annotations({
      description: 'Default value for form controls (select, radio-group, slider, etc.)',
    })
  ),
  multiple: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Allow multiple option selections (select)',
    })
  ),
  searchable: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Enable type-ahead search filtering in the list',
    })
  ),
  searchPlaceholder: Schema.optional(
    Schema.String.annotations({
      description:
        'Placeholder text shown inside the combobox search input (only meaningful when `searchable: true`)',
    })
  ),
  allowCustomValue: Schema.optional(
    Schema.Boolean.annotations({
      description:
        'When `searchable: true`, accept a typed value that does not match any option (free-form input).',
    })
  ),
  // REMOVED (deliberate): the top-level `valueField` / `displayField` pair.
  //
  // They were declared here, documented as "which keys of each option supply
  // the value and the label" (a remap over a STATIC `options` array), and read
  // by nothing — `buildSelectProps` never picked them up, so setting them had
  // no observable effect in any renderer. Their only appearances repo-wide were
  // the four specs that asserted on a disabled skeleton and one published docs
  // row. (`displayField` in `templates/**` is the unrelated
  // `tables[].fields[].displayField` on relationship fields.)
  //
  // The pair now lives INSIDE `dataSource`, where it has a real job: naming the
  // row fields that become each resolved option's value and label. Keeping an
  // inert top-level copy with a *different* documented meaning would have been
  // a third piece of fiction on this component, so the copy is gone rather than
  // silently repurposed.
} as const
