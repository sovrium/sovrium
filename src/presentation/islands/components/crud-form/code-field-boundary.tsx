/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useMemo } from 'react'
import { useDeferredComponent } from '../deferred-component'
import type { CodeEditorFieldProps } from '../code-editor-field/props'
import type { ReactElement } from 'react'

/**
 * CodeMirror's entry point into the form, fetched on demand.
 *
 * The editor pulls CodeMirror plus eight language grammars — around 428 KB of
 * the shipped bundle. Because the crud-form island is EAGER, a static import
 * here charged that to every page that mounted any island, whether or not it
 * had a single line of code on it.
 *
 * The same chunk backs the JSON and YAML config editors, so a page carrying one
 * of those and a `code` form field downloads CodeMirror once.
 */
const loadCodeEditorField = () => import('../code-editor-field').then((m) => m.CodeEditorField)

/**
 * What the field shows between mount and CodeMirror being ready.
 *
 * The loaded editor renders a `<label>` wrapping its own chrome and no
 * name-bearing control of its own, so this placeholder matches that shape:
 * anything it added would have to disappear again a moment later. The border
 * and monospace body reserve the editor's frame so the form does not jump, and
 * `aria-busy` says the control cannot take input yet.
 */
function CodeLoading({
  name,
  value,
  minLines,
}: Pick<CodeEditorFieldProps, 'name' | 'value' | 'minLines'>): ReactElement {
  // Mirrors the height the loaded editor will claim, so a field declaring
  // `minLines` reserves its full box now instead of growing under the reader.
  // Memoized because a fresh object per render is what
  // `react-perf/jsx-no-new-object-as-prop` exists to catch, and the React
  // Compiler is unavailable under Bun.
  const reservedHeight = useMemo(
    () => ({ minHeight: minLines ? `${minLines * 1.5}em` : '6em' }),
    [minLines]
  )
  return (
    <label>
      {name}
      <div
        role="status"
        aria-busy="true"
        className="text-foreground-subtle overflow-hidden rounded border p-3 font-mono text-sm"
        style={reservedHeight}
      >
        {value}
      </div>
    </label>
  )
}

/** Fetches the CodeMirror-bearing form field on mount, then mounts it once. */
export function CodeFieldBoundary(props: CodeEditorFieldProps): ReactElement {
  const Editor = useDeferredComponent(loadCodeEditorField)
  if (!Editor) return <CodeLoading {...props} />
  return <Editor {...props} />
}
