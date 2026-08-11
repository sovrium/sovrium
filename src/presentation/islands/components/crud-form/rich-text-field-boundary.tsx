/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useDeferredComponent } from '../deferred-component'
import type { RichTextEditorFieldProps } from '../rich-text-editor-field/props'
import type { ReactElement } from 'react'

/**
 * Tiptap's entry point into the form, fetched on demand.
 *
 * The editor and everything under it is the single largest dependency any
 * island carries — around 848 KB of the shipped bundle. The crud-form island
 * is EAGER (it has to take over the form before a keystroke can reach the SSR
 * skeleton), so for as long as this import was static, every page that mounted
 * any island at all paid for Tiptap: a login form, a pricing page with a
 * tooltip, a grid of numbers. Almost none of them contain a rich-text field.
 *
 * Loading it here means the cost lands on the forms that actually have one.
 * The same chunk backs the grid's inline `rich-text` cell editor, so a page
 * with both downloads it once.
 */
const loadRichTextEditorField = () =>
  import('../rich-text-editor-field').then((m) => m.RichTextEditorField)

/**
 * What the field shows between mount and Tiptap being ready.
 *
 * It carries the parts of the loaded editor that the surrounding page and its
 * specs address by selector, so nothing outside this component can tell the
 * difference except by looking for the editor itself:
 *
 * - the `data-rich-text-field` wrapper, which is how the field is located;
 * - the visible `<label>`, so the field is readable and reachable by name;
 * - the hidden input carrying the current value, so a native submit before the
 *   chunk lands still posts what the record already had.
 *
 * It deliberately renders no `<textarea>` — the SSR skeleton avoids one for the
 * same reason, because a rich-text field is asserted to have none.
 *
 * The frame matches the loaded editor's border and minimum height so the form
 * settles once rather than twice, and `aria-busy` says the control cannot take
 * input yet.
 */
function RichTextLoading({
  name,
  value,
  placeholder,
  displayLabel,
}: Pick<
  RichTextEditorFieldProps,
  'name' | 'value' | 'placeholder' | 'displayLabel'
>): ReactElement {
  return (
    <div data-rich-text-field={name}>
      <label className="block text-sm font-medium">{displayLabel ?? name}</label>
      <div
        role="status"
        aria-busy="true"
        className="text-foreground-subtle min-h-[6em] rounded border p-3"
      >
        {placeholder ?? ''}
      </div>
      <input
        type="hidden"
        name={name}
        value={value}
        readOnly
      />
    </div>
  )
}

/** Fetches the Tiptap-bearing form field on mount, then mounts it once. */
export function RichTextFieldBoundary(props: RichTextEditorFieldProps): ReactElement {
  const Editor = useDeferredComponent(loadRichTextEditorField)
  if (!Editor) return <RichTextLoading {...props} />
  return <Editor {...props} />
}
