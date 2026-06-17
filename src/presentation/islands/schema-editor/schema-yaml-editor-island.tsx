/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { yaml } from '@codemirror/lang-yaml'
import SchemaConfigEditor, { type SchemaConfigEditorProps } from './schema-config-editor'
import type { ReactElement } from 'react'

export default function SchemaYamlEditorIsland(props: SchemaConfigEditorProps): ReactElement {
  return (
    <SchemaConfigEditor
      {...props}
      extension={yaml()}
      format="yaml"
    />
  )
}
