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

export const SelectTypeLiteral = Schema.Literal('select')

export const selectFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  options: Schema.optional(OptionsSchema),
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
  valueField: Schema.optional(
    Schema.String.annotations({
      description: 'Field name to use as the option value',
    })
  ),
  displayField: Schema.optional(
    Schema.String.annotations({
      description: 'Field name to use as the option display text',
    })
  ),
} as const
