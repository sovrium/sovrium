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

export const SchemaYamlEditorTypeLiteral = Schema.Literal('schema-yaml-editor')

export const schemaYamlEditorFields = {
  ...coreFields,
  ...responsiveFields,
  ...visibilityFields,
  ...i18nFields,
  submitToTable: Schema.optional(
    Schema.String.annotations({
      description: 'Table slug the edited config is submitted to (e.g. "config_submissions")',
    })
  ),
  configField: Schema.optional(
    Schema.String.annotations({
      description: 'Column on the submit table that stores the edited config text',
    })
  ),
  formatField: Schema.optional(
    Schema.String.annotations({
      description: 'Column on the submit table that stores the editor format discriminant ("yaml")',
    })
  ),
  initialValue: Schema.optional(
    Schema.String.annotations({
      description: 'Initial YAML document shown when the editor mounts (e.g. "$record.config")',
    })
  ),
  height: Schema.optional(
    Schema.Number.pipe(
      Schema.greaterThan(0),
      Schema.annotations({ description: 'Editor container height in pixels' })
    )
  ),
  readOnly: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Whether the editor is read-only (view config without editing)',
    })
  ),
  lineNumbers: Schema.optional(
    Schema.Boolean.annotations({ description: 'Whether to show the line-number gutter' })
  ),
  inlinePrefill: Schema.optional(InlinePrefillSchema),
} as const
