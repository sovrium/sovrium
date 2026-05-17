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

export const ComboboxTypeLiteral = Schema.Literal('combobox')

export const comboboxFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  options: Schema.optional(OptionsSchema),
  defaultValue: Schema.optional(
    Schema.Union(Schema.String, Schema.Number, Schema.Boolean).annotations({
      description: 'Default value for form controls (select, radio-group, slider, etc.)',
    })
  ),
  searchPlaceholder: Schema.optional(
    Schema.String.annotations({
      description: 'Placeholder text for the combobox search input',
    })
  ),
  allowCustomValue: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Allow typing a custom value not present in the options list',
    })
  ),
} as const
