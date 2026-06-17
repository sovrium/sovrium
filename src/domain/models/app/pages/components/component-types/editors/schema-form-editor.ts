/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { InlinePrefillSchema } from '../data/form'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { responsiveFields } from '../modules/responsive'
import { visibilityFields } from '../modules/visibility'

export const SchemaFormEditorTypeLiteral = Schema.Literal('schema-form-editor')

export const schemaFormEditorFields = {
  ...coreFields,
  ...responsiveFields,
  ...visibilityFields,
  ...i18nFields,
  submitToTable: Schema.optional(
    Schema.String.annotations({
      description: 'Table slug the authored config is submitted to (e.g. "config_submissions")',
    })
  ),
  configField: Schema.optional(
    Schema.String.annotations({
      description: 'Column on the submit table that stores the serialized config',
    })
  ),
  formatField: Schema.optional(
    Schema.String.annotations({
      description: 'Column on the submit table that stores the editor format discriminant ("form")',
    })
  ),
  initialValue: Schema.optional(
    Schema.String.annotations({
      description: 'Initial config the form-builder hydrates from (e.g. "$record.config")',
    })
  ),
  sections: Schema.optional(
    Schema.Array(
      Schema.Literal('tables', 'pages', 'fields', 'automations', 'auth', 'theme')
    ).annotations({
      description: 'Which config sections the guided builder exposes (subset of the app schema)',
    })
  ),
  readOnly: Schema.optional(
    Schema.Boolean.annotations({
      description:
        'Whether the builder is read-only (review the structured config without editing)',
    })
  ),
  inlinePrefill: Schema.optional(InlinePrefillSchema),
} as const
