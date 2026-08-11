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
 * `schema-json-editor` component type — a CodeMirror-backed JSON config editor.
 *
 * Authors a tenant app config in JSON form (`@codemirror/lang-json` syntax mode,
 * already installed). On submit it writes the edited text to a config-submission
 * record via `submitToTable`, tagging the row with `format: 'json'` so a single
 * `config_submissions`-style contract can carry both JSON and YAML variants.
 *
 * Island deferred (red): the editor island that mounts CodeMirror is a later
 * `src/presentation/islands/` build. Until it ships the dispatcher renders a
 * safe `<div>` placeholder, so the type validates against AppSchema and renders
 * without crashing (component-type-dispatcher fallback).
 */
export const SchemaJsonEditorTypeLiteral = Schema.Literal('schema-json-editor')

export const schemaJsonEditorFields = {
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
      description: 'Column on the submit table that stores the editor format discriminant ("json")',
    })
  ),
  initialValue: Schema.optional(
    Schema.String.annotations({
      description: 'Initial JSON document shown when the editor mounts (e.g. "$record.config")',
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
