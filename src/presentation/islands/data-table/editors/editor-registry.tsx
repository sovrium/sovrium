/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable unicorn/no-null --
   `null` is the value that CLEARS a column: it is SQL NULL on the wire, while
   `undefined` is dropped by JSON.stringify and reaches the endpoint as "leave
   this field alone". The two are not interchangeable here — swapping them turns
   every clear gesture into a silent no-op. */

import { fieldWidgetOf, type FieldWidget } from '@/presentation/design/field-type-behavior'
import { AttachmentEditor } from './attachment-editor'
import { CodeCellEditorBoundary } from './code-editor-boundary'
import { DateTimeEditor } from './datetime-editor'
import { MultiSelectEditor } from './multi-select-editor'
import { RecordPickerEditor } from './record-picker-editor'
import { RichTextCellEditorBoundary } from './rich-text-editor-boundary'
import { UserPickerEditor } from './user-picker-editor'
import type { CellEditorProps } from './editor-contract'
import type { ReactElement } from 'react'

/**
 * TOTAL widget → inline editor table for the data-table grid.
 *
 * This is what replaced the grid's own dispatch. It used to decide its editor
 * from three hand-maintained constants in `editable-cell.tsx` —
 * `SELECT_FIELD_TYPES`, `NUMBER_FIELD_TYPES` and a `resolveInputType` chain —
 * and eight field types fell through all three to a plain `<input type="text">`.
 * Six of them could not express their value at all; `checkbox`, `rating` and
 * `datetime` were worse, because a text box LOOKS editable and silently accepts
 * prose.
 *
 * The fix was never eight editors. `field-type-behavior.ts` already carried a
 * `satisfies Record<FieldType, FieldTypeBehavior>` whose stated purpose is to
 * break at compile time when a field type is added, and both CRUD-form views
 * dispatch through it — the grid simply kept a second, partial, non-total copy.
 * The table below is the other half of that guard, and it is TOTAL over
 * `FieldWidget` for the same reason `WIDGET_SHOWS_DECLARED_DEFAULT` is: a new
 * widget fails to compile until someone states what edits it.
 *
 * Totality is the whole point, so every widget appears — including the ones
 * with no bespoke editor. A `Partial<…>` would let a new widget fall silently
 * through to `<input type="text">`, which is EXACTLY the defect this story
 * exists to undo: eight field types reached a text box because nothing forced a
 * decision about them. `null` is not "unhandled" here, it is one of the two
 * answers, and which answer it means is spelled by the constant used.
 */
type EditorComponent = (props: CellEditorProps) => ReactElement

/** Served by the pre-existing text/select editors in `editable-cell.tsx`. */
const HANDLED_BY_LEGACY_EDITOR = null

/**
 * Rendered by the READ path as a live control, with no editing state to enter.
 * A checkbox and a rating commit on a single click — see
 * `single-gesture-cells.tsx`. A widget with a COMPONENT below is one that opens
 * on a double-click.
 */
const RENDERED_AS_A_LIVE_CONTROL = null

/**
 * Not an input at all: a `button` field holds no value, so there is nothing to
 * edit. The read path renders the button the field declares.
 */
const HOLDS_NO_VALUE_TO_EDIT = null

const WIDGET_EDITORS: Record<FieldWidget, EditorComponent | null> = {
  'multi-select': MultiSelectEditor,
  'record-picker': RecordPickerEditor,
  'user-picker': UserPickerEditor,
  datetime: DateTimeEditor,
  // The two editors behind a chunk boundary: Tiptap and CodeMirror are the only
  // controls heavier than the grid that hosts them. See
  // `rich-text-editor-boundary.tsx` and `code-editor-boundary.tsx`.
  'rich-text': RichTextCellEditorBoundary,
  code: CodeCellEditorBoundary,
  'file-single': (props) => (
    <AttachmentEditor
      {...props}
      multiple={false}
    />
  ),
  'file-multiple': (props) => (
    <AttachmentEditor
      {...props}
      multiple={true}
    />
  ),

  checkbox: RENDERED_AS_A_LIVE_CONTROL,
  rating: RENDERED_AS_A_LIVE_CONTROL,

  button: HOLDS_NO_VALUE_TO_EDIT,

  text: HANDLED_BY_LEGACY_EDITOR,
  textarea: HANDLED_BY_LEGACY_EDITOR,
  select: HANDLED_BY_LEGACY_EDITOR,
  number: HANDLED_BY_LEGACY_EDITOR,
  date: HANDLED_BY_LEGACY_EDITOR,
  email: HANDLED_BY_LEGACY_EDITOR,
  url: HANDLED_BY_LEGACY_EDITOR,
}

/**
 * The native `type` attribute the plain-input editor wears, per widget.
 *
 * This is a refinement WITHIN one control, not a second dispatch: every widget
 * below renders the same `<input>` and differs only in how the browser lets the
 * reader type into it. The form deliberately keeps `text` for these — see
 * `crud-form/fields.tsx`.
 */
const INPUT_TYPE_BY_WIDGET: Partial<Record<FieldWidget, string>> = {
  number: 'number',
  date: 'date',
  email: 'email',
  url: 'url',
}

/**
 * The bespoke editor for a field type, or `null` when it is served elsewhere —
 * by the text/select editor, or by a live control on the read path.
 *
 * No `??` fallback: `fieldWidgetOf` degrades an unknown field type to a real
 * `FieldWidget` of its own accord, and the table is total, so the lookup cannot
 * miss. A fallback here would re-introduce the silent text-box default that the
 * totality above exists to prevent.
 */
export function resolveCellEditor(fieldType: string): EditorComponent | null {
  return WIDGET_EDITORS[fieldWidgetOf(fieldType)]
}

/** The `<input type>` the plain-input editor should wear for this field type. */
export function resolveInputType(fieldType: string): string {
  return INPUT_TYPE_BY_WIDGET[fieldWidgetOf(fieldType)] ?? 'text'
}

/** Whether this field type is edited with the `<select>` editor. */
export function usesSelectEditor(fieldType: string): boolean {
  return fieldWidgetOf(fieldType) === 'select'
}
