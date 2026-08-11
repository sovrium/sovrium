/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable react-perf/jsx-no-new-function-as-prop --
   Cell-level editor: mounted per open cell, torn down on commit or cancel, and
   its onChange closes over the draft HTML. */

import { useRef, useState } from 'react'
import { RichTextEditorField } from '../../components/rich-text-editor-field'
import { editMetaOf, type CellEditorProps } from './editor-contract'
import { EditorPopover } from './editor-popover'
import type { ReactElement } from 'react'

/**
 * The `rich-text` cell editor.
 *
 * Opens the SAME editor the CRUD form uses, honouring the field's declared
 * `toolbar`, `placeholder` and `maxLength` — all three are already wired end to
 * end there, so reusing the island is what keeps one rich-text surface in the
 * product rather than two that drift.
 *
 * It floats OVER the row rather than inlining into the `<td>`: a Tiptap surface
 * with its own toolbar inside a table cell fights the row's height. It stays a
 * DOM descendant of the cell all the same — see `EditorPopover`.
 *
 * It deliberately does NOT route to the record drawer. The drawer is a live
 * surface with its own tracked defects (it needs an explicit `recordFields`
 * list, `RecordDrawerField` carries no `label`, and its save button is hardcoded
 * French); making rich-text editing depend on it would couple this work to that
 * repair.
 *
 * This module is the whole Tiptap payload's entry point, so it is the chunk
 * boundary: `island-registry.ts` declares `RichTextCellEditorLazy` and the grid
 * mounts it behind its own Suspense boundary, which is why the default export
 * below is the shape `React.lazy` wants.
 *
 * An earlier attempt declared that `lazy()` INSIDE the grid and rendered it
 * with no boundary of its own. The chunk resolved fine — what broke was
 * Suspense placement: with no nearer boundary, the suspending cell propagated
 * to the island-level `<Suspense>` in `island-client.tsx`, whose fallback is
 * the SSR skeleton captured at mount. Double-clicking a cell therefore replaced
 * the whole grid with that skeleton until the chunk landed. The fix is not a
 * static import; it is a boundary at the cell — see `editor-registry.tsx`.
 */

export default function RichTextCellEditor(props: CellEditorProps): ReactElement {
  const { value, commit, cancel, tabNext, fieldMeta, fieldName } = props
  const { toolbar, placeholder, maxLength } = editMetaOf(fieldMeta)
  // The opening HTML is captured ONCE and never updated.
  //
  // `RichTextEditorField` re-syncs its document whenever its `value` prop
  // changes — `editor.commands.setContent(value)`, which COLLAPSES the
  // selection. Feeding it a controlled value would call that on every
  // keystroke, so selecting a phrase and reaching for Bold would apply the mark
  // to an empty selection: the text stays unmarked and the toolbar looks
  // broken. The draft lives in a ref instead, which is what every commit path
  // here reads anyway.
  const [initialHtml] = useState(() => (value === null || value === undefined ? '' : String(value)))
  const htmlRef = useRef(initialHtml)

  const handleChange = (_name: string, next: string): void => {
    // eslint-disable-next-line functional/immutable-data -- Ref carries the draft to a Tab/blur that fires before React state would settle.
    htmlRef.current = next
  }

  return (
    <EditorPopover
      label={`Edit ${fieldName ?? 'rich text'}`}
      cancel={() => {
        // Escape closes the surface. The draft is persisted on the way out
        // rather than discarded: a rich-text cell holds a paragraph, not a
        // token, and silently dropping typed prose because the reader reached
        // for the key that closes things is the worse of the two failures.
        commit(htmlRef.current)
        cancel()
      }}
      tabValue={() => htmlRef.current}
      {...(tabNext && { tabNext })}
    >
      <div className="border-border bg-background absolute top-0 left-0 z-20 w-80 rounded border p-2 shadow-md">
        <RichTextEditorField
          name={fieldName ?? 'value'}
          value={initialHtml}
          onChange={handleChange}
          {...(toolbar && { toolbar })}
          {...(placeholder && { placeholder })}
          {...(maxLength !== undefined && { maxLength })}
        />
      </div>
    </EditorPopover>
  )
}
