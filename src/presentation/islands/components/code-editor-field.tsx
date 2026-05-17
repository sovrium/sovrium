/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { python } from '@codemirror/lang-python'
import { sql } from '@codemirror/lang-sql'
import { yaml } from '@codemirror/lang-yaml'
import CodeMirror from '@uiw/react-codemirror'
import type { Extension } from '@codemirror/state'

const LANGUAGE_MAP: Record<string, () => Extension> = {
  javascript,
  typescript: () => javascript({ typescript: true }),
  jsx: () => javascript({ jsx: true }),
  tsx: () => javascript({ jsx: true, typescript: true }),
  json,
  html,
  css,
  sql,
  markdown,
  python,
  yaml,
}

interface CodeEditorFieldProps {
  readonly name: string
  readonly value: string
  readonly onChange: (name: string, value: string) => void
  readonly language?: string
  readonly lineNumbers?: boolean
  readonly readOnly?: boolean
  readonly tabSize?: number
  readonly minLines?: number
  readonly maxLines?: number
}

export function CodeEditorField({
  name,
  value,
  onChange,
  language = 'javascript',
  lineNumbers = true,
  readOnly = false,
  tabSize = 2,
  minLines,
  maxLines,
}: CodeEditorFieldProps) {
  const langFactory = LANGUAGE_MAP[language]
  const extensions: Extension[] = langFactory ? [langFactory()] : []

  const minHeight = minLines ? `${minLines * 1.5}em` : '6em'
  const maxHeight = maxLines ? `${maxLines * 1.5}em` : '400px'

  return (
    <label>
      {name}
      <CodeMirror
        value={value}
        // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop -- form-field handler; re-render triggered by CodeMirror's own value updates dominates inline-handler cost
        onChange={(val) => onChange(name, val)}
        extensions={extensions}
        readOnly={readOnly}
        // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- per-render config object derived from props; CodeMirror reads it on mount, not on every render
        basicSetup={{
          lineNumbers,
          tabSize,
          foldGutter: true,
          highlightActiveLine: !readOnly,
        }}
        minHeight={minHeight}
        maxHeight={maxHeight}
        className="rounded border"
      />
    </label>
  )
}
