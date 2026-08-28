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
 * `schema-yaml-editor` component type — a CodeMirror-backed YAML config editor.
 *
 * YAML is a first-class Sovrium config authoring format (`app.yaml` parsed via
 * `Bun.YAML`), so this editor sits alongside `schema-json-editor` and shares the
 * same config-submission contract — the `format: 'yaml'` discriminant is the only
 * difference. Uses the `@codemirror/lang-yaml` syntax mode (already installed).
 *
 * Island deferred (red): the CodeMirror YAML island is a later
 * `src/presentation/islands/` build; until then the dispatcher renders a safe
 * `<div>` placeholder (component-type-dispatcher fallback) so the type validates
 * against AppSchema and renders without crashing.
 */
export const SchemaYamlEditorTypeLiteral = Schema.Literal('schema-yaml-editor')

export const schemaYamlEditorFields = {
  ...coreFields,
  ...responsiveFields,
  ...visibilityFields,
  ...i18nFields,
  submitToTable: Schema.optional(
    Schema.String.annotate({
      description: 'Table slug the edited config is submitted to (e.g. "config_submissions")',
    })
  ),
  configField: Schema.optional(
    Schema.String.annotate({
      description: 'Column on the submit table that stores the edited config text',
    })
  ),
  formatField: Schema.optional(
    Schema.String.annotate({
      description: 'Column on the submit table that stores the editor format discriminant ("yaml")',
    })
  ),
  initialValue: Schema.optional(
    Schema.String.annotate({
      description: 'Initial YAML document shown when the editor mounts (e.g. "$record.config")',
    })
  ),
  height: Schema.optional(
    Schema.Finite.pipe(
      Schema.check(Schema.isGreaterThan(0)),
      Schema.annotate({ description: 'Editor container height in pixels' })
    )
  ),
  readOnly: Schema.optional(
    Schema.Boolean.annotate({
      description: 'Whether the editor is read-only (view config without editing)',
    })
  ),
  lineNumbers: Schema.optional(
    Schema.Boolean.annotate({ description: 'Whether to show the line-number gutter' })
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
