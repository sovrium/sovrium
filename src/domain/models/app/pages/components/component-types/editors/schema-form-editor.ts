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

/**
 * `schema-form-editor` component type — a structured, no-code app-config builder.
 *
 * Where `schema-json-editor` / `schema-yaml-editor` expose the raw config text,
 * this editor renders a guided form over the same app-config schema (tables,
 * pages, fields) so a non-developer can author a tenant app without writing JSON
 * or YAML. The same `submitToTable` / `configField` / `formatField` contract is
 * reused; the emitted format is `form` (the engine serializes the structured
 * model to a config submission).
 *
 * Island deferred (red): the structured form-builder island is a substantial
 * later `src/presentation/islands/` build. Until it ships the dispatcher renders
 * a safe `<div>` placeholder, so the type validates against AppSchema and renders
 * without crashing (component-type-dispatcher fallback).
 */
export const SchemaFormEditorTypeLiteral = Schema.Literal('schema-form-editor')

export const schemaFormEditorFields = {
  ...coreFields,
  ...responsiveFields,
  ...visibilityFields,
  ...i18nFields,
  submitToTable: Schema.optional(
    Schema.String.annotate({
      description: 'Table slug the authored config is submitted to (e.g. "config_submissions")',
    })
  ),
  configField: Schema.optional(
    Schema.String.annotate({
      description: 'Column on the submit table that stores the serialized config',
    })
  ),
  formatField: Schema.optional(
    Schema.String.annotate({
      description: 'Column on the submit table that stores the editor format discriminant ("form")',
    })
  ),
  initialValue: Schema.optional(
    Schema.String.annotate({
      description: 'Initial config the form-builder hydrates from (e.g. "$record.config")',
    })
  ),
  sections: Schema.optional(
    Schema.Array(
      Schema.Literals(['tables', 'pages', 'fields', 'automations', 'auth', 'theme'])
    ).annotate({
      description: 'Which config sections the guided builder exposes (subset of the app schema)',
    })
  ),
  readOnly: Schema.optional(
    Schema.Boolean.annotate({
      description:
        'Whether the builder is read-only (review the structured config without editing)',
    })
  ),
  /**
   * Record-context submit fields (GAP-I2). Reuses the `InlinePrefillSchema`
   * (`$record.<field>` token + `lockPrefill`). On a record-detail / collection
   * page the editor SSR dispatcher resolves the tokens against the host record
   * into a literal `submitContext` merged into the submit body — so an editor
   * whose submit table has a required relationship FK carries the page record
   * FK without overloading the format column.
   */
  inlinePrefill: Schema.optional(InlinePrefillSchema),
} as const
