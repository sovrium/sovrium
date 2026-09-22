/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable react-perf/jsx-no-new-function-as-prop --
   Cell-level editor: mounted per open cell, torn down on commit or cancel, and
   its onChange closes over the draft source. */

import { useRef, useState } from 'react'
import {
  TABLE_EDITOR_PROSE_WIDTH,
  computeTableEditorPopoverClasses,
} from '@/presentation/design/table-default-classes'
import { CodeEditorField } from '../../parts/code-editor-field'
import { editMetaOf, type CellEditorProps } from './editor-contract'
import { EditorPopover } from './editor-popover'
import type { ReactElement } from 'react'

/**
 * The `code` cell editor.
 *
 * Opens the SAME CodeMirror surface the CRUD form gives this field, configured
 * from the same five declared properties — the grammar plus the four that shape
 * the box it draws. The two halves of the product used to
 * disagree about `code`: the
 * READ path already rendered the cell as code (`CodeInlineCell`), while the
 * WRITE path fell through the widget table to the plain-text popover — so a
 * double-click swapped a syntax-highlighted value for an `<input type="text">`,
 * which holds no newline at all and therefore FLATTENED every multi-line
 * statement the moment anyone edited one.
 *
 * It floats OVER the row for the reason the rich-text editor does: a gutter and
 * several unwrapped lines inside a `<td>` fight the row's height. It stays a DOM
 * descendant of the cell all the same — see `EditorPopover`.
 *
 * ─── WHY Tab DOES NOT INDENT HERE ─────────────────────────────────────────
 *
 * `indentWithTab={false}`. Tab is the grid's commit-and-advance gesture, owned
 * by `EditorPopover`, and CodeMirror's own Tab binding does not stop the event
 * propagating — so with the library default (`true`) one keypress would BOTH
 * indent the draft and commit it, storing a stray indent nobody typed. Enter
 * still belongs to the surface, which is exactly why Tab has to be the commit
 * gesture for an editor of this shape.
 *
 * This module is the whole CodeMirror payload's entry point on the grid side, so
 * it is the chunk boundary: `island-registry.ts` declares the loader and
 * `code-editor-boundary.tsx` mounts it once the module has arrived (never
 * `React.lazy` — see `useDeferredComponent`). The same underlying chunk backs
 * the crud-form's `code` field and the JSON/YAML config editors, so a page
 * carrying a grid and a form downloads CodeMirror once.
 */
export default function CodeCellEditor(props: CellEditorProps): ReactElement {
  const { value, commit, cancel, tabNext, fieldMeta, fieldName } = props
  // Every editor property the field declares, spread below only where the
  // author actually declared one so `CodeEditorField`'s own defaults survive an
  // absent key rather than being overwritten with `undefined`.
  // See `EDIT_META_KEYS` in `render/props/resolve-field-cell-meta.ts`.
  const { language, lineNumbers, tabSize, minLines, maxLines } = editMetaOf(fieldMeta)

  // The opening source is captured ONCE and never updated, for the reason the
  // rich-text editor records: feeding a controlled value back into the editor
  // re-syncs its document on every keystroke and collapses the selection. The
  // draft lives in a ref, which is what every commit path here reads anyway.
  const [initialSource] = useState(() =>
    value === null || value === undefined ? '' : String(value)
  )
  const sourceRef = useRef(initialSource)

  const handleChange = (_name: string, next: string): void => {
    // eslint-disable-next-line functional/immutable-data -- Ref carries the draft to a Tab/blur that fires before React state would settle.
    sourceRef.current = next
  }

  return (
    <EditorPopover
      label={`Edit ${fieldName ?? 'code'}`}
      cancel={() => {
        // Escape closes the surface and PERSISTS the draft, as rich text does:
        // a code cell holds a statement rather than a token, and silently
        // discarding typed source because the reader reached for the key that
        // closes things is the worse of the two failures.
        commit(sourceRef.current)
        cancel()
      }}
      tabValue={() => sourceRef.current}
      {...(tabNext && { tabNext })}
    >
      <div
        className={`${computeTableEditorPopoverClasses()} ${TABLE_EDITOR_PROSE_WIDTH} top-0 left-0`}
      >
        <CodeEditorField
          name={fieldName ?? 'value'}
          value={initialSource}
          onChange={handleChange}
          indentWithTab={false}
          {...(language && { language })}
          {...(lineNumbers !== undefined && { lineNumbers })}
          {...(tabSize !== undefined && { tabSize })}
          {...(minLines !== undefined && { minLines })}
          {...(maxLines !== undefined && { maxLines })}
        />
      </div>
    </EditorPopover>
  )
}
