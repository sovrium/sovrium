/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable react-perf/jsx-no-new-function-as-prop --
   One trailing row is mounted per grid (or per group), and its cell handlers
   close over the draft they edit; typing IS the state change that re-renders
   the row, so hoisting them would add indirection without removing work. */

import { useEffect, useRef } from 'react'
import { optionLabel, optionValue } from '@/domain/models/app/tables/select-option'
import { fieldWidgetOf } from '@/presentation/design/field-type-behavior'
import {
  computeTableAddRowClasses,
  computeTableAddRowInputClasses,
  computeTableAddRowTriggerClasses,
  computeTableCheckboxControlClasses,
} from '@/presentation/design/table-default-classes'
import { resolveCellEditor, resolveInputType } from './editors/editor-registry'
import { isWritableAddRowColumn, useAddRowDraft, type AddRowColumn } from './use-add-row-draft'
import type { FieldMetaMap } from '../hooks/use-inline-editing'
import type { KeyboardEvent, ReactElement } from 'react'

/**
 * The trailing add-row: a row under the last record that creates a new one on
 * its first commit.
 *
 * It rests as a single "+ New row" trigger, always the LAST row of its
 * `<tbody>`, and exists whenever the role may create — even on an empty
 * table. Activating it turns it into one control per column; Enter in any of
 * them commits the whole row, Escape discards it outright (there is no value
 * to revert to), and a refusal — a required column left empty, a value a
 * column cannot hold, the server saying no — keeps the row open with what was
 * typed and names the problem. A successful commit re-reads the grid and
 * grows a FRESH trailing row, so a whole batch of records can be typed
 * without leaving the keyboard.
 *
 * It shares exactly one thing with the toolbar's create modal: the `canCreate`
 * gate. A role that cannot create sees no trailing row at all — absent, not
 * disabled — so the grid never advertises an action the role cannot take.
 *
 * A `relationship` column opens the SAME searchable picker the grid uses for
 * an existing row's cell, through the same editor registry, rather than the
 * modal's skip-the-relationship behaviour.
 */

export interface AddRowConfig {
  readonly tableName: string
  /** One entry per visible leaf column, in render order. */
  readonly columns: readonly AddRowColumn[]
  readonly fieldMeta?: FieldMetaMap
  readonly cellClass: string
  readonly borderClass: string
  /** Re-reads the grid once a record has been created. */
  readonly onCreated: () => void
}

/** Widgets whose control opens on a click rather than sitting inline. */
const OPENS_ON_CLICK: ReadonlySet<string> = new Set([
  'record-picker',
  'user-picker',
  'multi-select',
  'datetime',
  'code',
  'rich-text',
  'file-single',
  'file-multiple',
])

/**
 * The subset of {@link OPENS_ON_CLICK} whose surface is WRITTEN rather than
 * chosen from, which is what decides the resting cell's verb.
 *
 * You write prose and you write code; you pick a record, a person, a date, a
 * choice or a file. A picked cell at rest therefore reads "Pick <column>…" and
 * a written one reads "Write <column>…" — the difference between naming a
 * value that already exists somewhere and prompting for one that does not yet
 * exist at all. A widget joining the set above belongs in exactly one of the
 * two camps; the wrong one produces "Pick source code…", which asks the reader
 * to find something nobody has authored.
 */
const WRITES_PROSE: ReadonlySet<string> = new Set(['code', 'rich-text'])

/** What a picked cell reads before anything has been supplied for it. */
function restingLabel(column: AddRowColumn): string {
  const verb = WRITES_PROSE.has(fieldWidgetOf(column.type ?? '')) ? 'Write' : 'Pick'
  return `${verb} ${column.label.toLowerCase()}…`
}

const INPUT_CLASS = computeTableAddRowInputClasses()

type Draft = ReturnType<typeof useAddRowDraft>

/** Enter commits the row, Escape discards it; every other key is the control's. */
function draftKeyHandler(draft: Draft) {
  return (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault()
      draft.commit()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      draft.discard()
    }
  }
}

/** The inline control for a column that takes text, a number, a date or a choice. */
function InlineControl({
  column,
  field,
  draft,
}: {
  readonly column: AddRowColumn
  readonly field: string
  readonly draft: Draft
}): ReactElement {
  const widget = fieldWidgetOf(column.type ?? 'single-line-text')
  const value = draft.state.values[field]
  const onKeyDown = draftKeyHandler(draft)
  if (widget === 'checkbox') {
    return (
      <input
        type="checkbox"
        aria-label={column.label}
        checked={value === true}
        onChange={(event) => draft.setValue(field, event.target.checked)}
        onKeyDown={onKeyDown}
        className={computeTableCheckboxControlClasses()}
      />
    )
  }
  if (widget === 'select' && column.options !== undefined && column.options.length > 0) {
    return (
      <select
        aria-label={column.label}
        value={String(value ?? '')}
        onChange={(event) => draft.setValue(field, event.target.value)}
        onKeyDown={onKeyDown}
        className={INPUT_CLASS}
      >
        <option value="">—</option>
        {column.options.map((option) => (
          <option
            key={optionValue(option)}
            value={optionValue(option)}
          >
            {optionLabel(option)}
          </option>
        ))}
      </select>
    )
  }
  return (
    <input
      type={resolveInputType(column.type ?? 'single-line-text')}
      aria-label={column.label}
      value={String(value ?? '')}
      onChange={(event) => draft.setValue(field, event.target.value)}
      onKeyDown={onKeyDown}
      className={INPUT_CLASS}
    />
  )
}

/**
 * A column whose control opens on a click: the cell shows what has been
 * picked, and a click on it mounts the grid's own editor for that widget.
 */
function PickedControl({
  column,
  field,
  draft,
  config,
}: {
  readonly column: AddRowColumn
  readonly field: string
  readonly draft: Draft
  readonly config: AddRowConfig
}): ReactElement {
  const Editor = resolveCellEditor(column.type ?? 'single-line-text')
  const value = draft.state.values[field]
  if (draft.state.activeEditor === field && Editor) {
    return (
      <Editor
        value={value}
        commit={(next) => draft.setValue(field, next)}
        cancel={draft.closeEditor}
        fieldMeta={config.fieldMeta?.[field]}
        fieldName={field}
        tableName={config.tableName}
      />
    )
  }
  const picked = value === undefined || value === null || value === '' ? undefined : String(value)
  return (
    <span className={picked === undefined ? 'text-foreground-muted' : ''}>
      {picked ?? restingLabel(column)}
    </span>
  )
}

/** How one column of the activated row is edited. */
type ControlKind = 'inline' | 'picked' | 'none'

function controlKindOf(column: AddRowColumn): ControlKind {
  if (!isWritableAddRowColumn(column)) return 'none'
  return OPENS_ON_CLICK.has(fieldWidgetOf(column.type ?? '')) ? 'picked' : 'inline'
}

/** The control a writable column renders, or the dash a computed one shows. */
function CellControl({
  column,
  kind,
  draft,
  config,
}: {
  readonly column: AddRowColumn
  readonly kind: ControlKind
  readonly draft: Draft
  readonly config: AddRowConfig
}): ReactElement {
  const field = column.field ?? ''
  if (kind === 'picked') {
    return (
      <PickedControl
        column={column}
        field={field}
        draft={draft}
        config={config}
      />
    )
  }
  if (kind === 'inline') {
    return (
      <InlineControl
        column={column}
        field={field}
        draft={draft}
      />
    )
  }
  return <span className="text-foreground-muted">—</span>
}

/** One cell of the activated row. */
function AddRowCell({
  column,
  draft,
  config,
  error,
}: {
  readonly column: AddRowColumn
  readonly draft: Draft
  readonly config: AddRowConfig
  /** The refusal, rendered in the first cell so the row names its own problem. */
  readonly error?: string
}): ReactElement {
  const { field } = column
  const kind = controlKindOf(column)
  return (
    <td
      className={`${config.cellClass} ${config.borderClass} whitespace-nowrap`}
      {...(field !== undefined && { 'data-field': field })}
      {...(kind === 'picked' && field !== undefined && { onClick: () => draft.openEditor(field) })}
    >
      {field !== undefined && (
        <CellControl
          column={column}
          kind={kind}
          draft={draft}
          config={config}
        />
      )}
      {error !== undefined && (
        <p
          role="alert"
          className="text-error-fg mt-1 text-sm whitespace-normal"
        >
          {error}
        </p>
      )}
    </td>
  )
}

/** The row at rest: a single trigger spanning the grid. */
function RestingAddRow({
  config,
  onOpen,
}: {
  readonly config: AddRowConfig
  readonly onOpen: () => void
}): ReactElement {
  return (
    <tr
      data-add-row="true"
      className={computeTableAddRowClasses()}
    >
      <td
        colSpan={config.columns.length}
        className={`${config.cellClass} ${config.borderClass}`}
      >
        <button
          type="button"
          onClick={onOpen}
          className={computeTableAddRowTriggerClasses()}
        >
          + New row
        </button>
      </td>
    </tr>
  )
}

/**
 * The trailing row itself. `prefill` is what the row's place already says
 * about the record — the group's value on a grouped grid.
 */
export function AddRow({
  config,
  prefill = {},
}: {
  readonly config: AddRowConfig
  readonly prefill?: Readonly<Record<string, unknown>>
}): ReactElement {
  const draft = useAddRowDraft({
    tableName: config.tableName,
    columns: config.columns,
    prefill,
    onCreated: config.onCreated,
  })
  const rowRef = useRef<HTMLTableRowElement>(null)
  const { open, error } = draft.state

  // Activation puts the caret in the first control, so typing can start at
  // once — the whole point of a row over a dialog.
  useEffect(() => {
    if (!open) return
    rowRef.current?.querySelector<HTMLElement>('input, select, textarea')?.focus()
  }, [open])

  if (!open) {
    return (
      <RestingAddRow
        config={config}
        onOpen={draft.open}
      />
    )
  }

  const firstWritable = config.columns.findIndex(isWritableAddRowColumn)
  return (
    <tr
      ref={rowRef}
      data-add-row="true"
      data-add-row-open="true"
    >
      {config.columns.map((column, index) => (
        <AddRowCell
          key={column.field ?? `column-${String(index)}`}
          column={column}
          draft={draft}
          config={config}
          {...(index === firstWritable && error !== undefined && { error })}
        />
      ))}
    </tr>
  )
}
