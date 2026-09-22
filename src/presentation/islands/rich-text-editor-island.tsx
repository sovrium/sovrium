/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useMemo, useState } from 'react'
import { RichTextFieldBoundary } from './parts/crud-form/rich-text-field-boundary'
import type { ReactElement } from 'react'

/**
 * `rich-text-editor` — the Tiptap editor of a `rich-text` field, addressed by a
 * page component instead of derived from a column.
 *
 * ─── THIS ISLAND IS THIN ON PURPOSE ────────────────────────────────────────
 *
 * It owns the value, the toolbar ORDER and nothing else. The editor itself —
 * the toolbar, the slash menu, the character counter, the image upload — is the
 * same `RichTextEditorField` the crud-form and the grid's inline cell editor
 * mount, reached through the same `RichTextFieldBoundary`, so all three
 * download ONE Tiptap chunk (~848 KB) between them and a page carrying none of
 * them downloads no part of it.
 *
 * Deferring through `useDeferredComponent` rather than `React.lazy` is not a
 * style choice: Suspense disconnects a suspended subtree's effects, and Tiptap's
 * cleanup destroys the editor on a 1 ms timer when that happens. The full
 * mechanism is on `useDeferredComponent`; the consequence here is that the
 * boundary must stay the entry point.
 *
 * ─── NO SUBMIT CONTROL, AND THAT IS A SAFETY PROPERTY ──────────────────────
 *
 * The value goes into a hidden input under the declared `name` — the one
 * `RichTextEditorField` already renders — and whatever form encloses the
 * component submits it, exactly as an `input` does. The component posts nothing
 * itself and wraps itself in no `<form>`.
 *
 * That is what lets this type be CATALOGUED. Four `schema-*-editor` types were
 * deleted in wave C1 for mounting the same library behind a Save button that
 * POSTed into the records API — [internal ref] A3 clause 2 forbids a write path inside
 * a preview frame, and [internal ref] D3 keeps the config-editing plane in paid Cloud.
 * A Save button here would put this type in that company.
 */

/**
 * The engine's fixed button order — the order `RichTextActionSchema` declares
 * its literals in, which is also the order `TOOLBAR_ACTIONS` is written in.
 *
 * `toolbar` selects WHICH actions exist, never where they sit. Two reasons it is
 * normalised here rather than left to the config: a toolbar whose order followed
 * the array would move under a reader who edited one entry of it, and the twelve
 * buttons are a keyboard the reader learns the shape of — Bold is on the left in
 * every editor they have ever used.
 *
 * Spelled out rather than imported from the editor's own `actions.ts`: that
 * module is inside the Tiptap chunk's directory, and importing a constant from
 * it to decide an ORDER would tie this island's tiny closure to the editor's for
 * a twelve-string list. The pairing is pinned by the schema, which enumerates
 * the same twelve.
 */
const ACTION_ORDER = [
  'bold',
  'italic',
  'strike',
  'heading',
  'list',
  'ordered-list',
  'code-block',
  'blockquote',
  'link',
  'image',
  'table',
  'horizontal-rule',
] as const

/** What an omitted `toolbar` offers — the six the field editor already ships. */
const DEFAULT_ACTIONS: readonly string[] = [
  'bold',
  'italic',
  'heading',
  'list',
  'link',
  'code-block',
]

interface RichTextEditorIslandProps {
  readonly className?: string
  readonly label?: string
  readonly name?: string
  readonly value?: string
  readonly toolbar?: readonly string[]
  readonly placeholder?: string
  readonly maxLength?: number
  readonly imageBucket?: string
}

export default function RichTextEditorIsland({
  className,
  label,
  name,
  value,
  toolbar,
  placeholder,
  maxLength,
  imageBucket,
}: RichTextEditorIslandProps): ReactElement {
  const [html, setHtml] = useState(value ?? '')

  // The editor reports `(name, value)`; this component is the only consumer, so
  // the name is discarded rather than re-checked against the prop.
  const handleChange = useCallback((_name: string, next: string) => setHtml(next), [])

  // An EMPTY array is not an omitted one: `[]` means a toolbar-free editor,
  // where the slash menu is the only way to reach a block action. So the
  // fallback is applied before the ordering, not folded into it.
  const orderedToolbar = useMemo(() => {
    const requested = toolbar ?? DEFAULT_ACTIONS
    return ACTION_ORDER.filter((action) => requested.includes(action))
  }, [toolbar])

  return (
    <div className={className}>
      <RichTextFieldBoundary
        name={name ?? ''}
        value={html}
        onChange={handleChange}
        toolbar={orderedToolbar}
        placeholder={placeholder}
        maxLength={maxLength}
        displayLabel={label ?? name}
        imageBucket={imageBucket}
      />
    </div>
  )
}
