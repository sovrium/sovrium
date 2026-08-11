/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { json } from '@codemirror/lang-json'
import SchemaConfigEditor, { type SchemaConfigEditorProps } from './schema-config-editor'
import type { ReactElement } from 'react'

/**
 * `schema-json-editor` island (platform B10) — a CodeMirror JSON config editor.
 *
 * Delegates to the shared {@link SchemaConfigEditor} core with the
 * `@codemirror/lang-json` syntax mode and the `json` format discriminant.
 */
export default function SchemaJsonEditorIsland(props: SchemaConfigEditorProps): ReactElement {
  return (
    <SchemaConfigEditor
      {...props}
      extension={json()}
      format="json"
    />
  )
}
