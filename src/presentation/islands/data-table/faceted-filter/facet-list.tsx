/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useId, useState, type KeyboardEvent, type ReactElement } from 'react'
import {
  COMMAND_EMPTY_CLASSES,
  COMMAND_GROUP_CLASSES,
  COMMAND_INPUT_CLASSES,
  COMMAND_INPUT_GROUP_CLASSES,
  COMMAND_INPUT_WRAPPER_CLASSES,
  COMMAND_ITEM_CLASSES,
  COMMAND_LIST_CLASSES,
  COMMAND_ROOT_CLASSES,
  COMMAND_SEPARATOR_CLASSES,
} from '@/presentation/design/command-default-classes'
import { useGridString } from '../island/grid-strings'
import { FacetCheck } from './facet-glyphs'
import type { FacetControl } from './faceted-filter'

/** One row of the list: an option to toggle, or the Clear filters row. */
interface Row {
  readonly key: string
  readonly label: string
  readonly checked?: boolean
  readonly run: () => void
}

function buildRows(control: FacetControl, query: string, clearLabel: string): readonly Row[] {
  const term = query.trim().toLowerCase()
  const options = control.options
    .filter((option) => option.label.toLowerCase().includes(term))
    .map((option) => ({
      key: option.value,
      label: option.label,
      checked: control.selected.includes(option.value),
      run: () => control.onToggle(control.field, option.value),
    }))
  const clear =
    control.selected.length > 0
      ? [{ key: '\u0000clear', label: clearLabel, run: () => control.onClear(control.field) }]
      : []
  return [...options, ...clear]
}

/** One option row, preceded by a rule when it is the Clear filters row. */
function FacetRow({
  row,
  id,
  active,
  onHover,
}: {
  readonly row: Row
  readonly id: string
  readonly active: boolean
  readonly onHover: () => void
}): ReactElement {
  const isOption = row.checked !== undefined
  return (
    <>
      {!isOption && (
        <div
          aria-hidden="true"
          className={`${COMMAND_SEPARATOR_CLASSES} my-1`}
        />
      )}
      <div
        id={id}
        role="option"
        aria-selected={active}
        {...(isOption && { 'aria-checked': row.checked })}
        data-slot="command-item"
        {...(active && { 'data-selected': '' })}
        onMouseMove={onHover}
        onClick={row.run}
        className={`${COMMAND_ITEM_CLASSES} ${isOption ? '' : 'justify-center'}`}
      >
        {isOption && <FacetCheck checked={row.checked === true} />}
        <span>{row.label}</span>
      </div>
    </>
  )
}

/** The arrows move the active row (wrapping), Enter runs it. */
function listKeyHandler(rows: readonly Row[], current: number, setActive: (next: number) => void) {
  return (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : rows.length - 1
      setActive((current + step) % Math.max(rows.length, 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      rows[current]?.run()
    }
  }
}

/**
 * The checklist inside a facet popover, drawn on shadcn's `Command` anatomy: a
 * search box that is the list's `combobox`, the options in declared order as
 * checkable `option`s, and Clear filters once something is checked. The arrows
 * move through the rows and Enter toggles one, without cmdk's weight.
 */
export function FacetList(control: FacetControl): ReactElement {
  const clearLabel = useGridString('datatable.facet.clear', 'Clear filters')
  const emptyLabel = useGridString('datatable.facet.empty', 'No results found.')
  const listId = useId()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const rows = buildRows(control, query, clearLabel)
  const current = Math.min(active, rows.length - 1)
  return (
    <div
      data-slot="command"
      className={COMMAND_ROOT_CLASSES}
    >
      <div className={COMMAND_INPUT_WRAPPER_CLASSES}>
        <div className={COMMAND_INPUT_GROUP_CLASSES}>
          <input
            data-slot="command-input"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-label={control.label}
            {...(rows[current] && { 'aria-activedescendant': `${listId}-${String(current)}` })}
            value={query}
            placeholder={control.label}
            onChange={(event) => {
              setQuery(event.target.value)
              setActive(0)
            }}
            onKeyDown={listKeyHandler(rows, current, setActive)}
            className={COMMAND_INPUT_CLASSES}
          />
        </div>
      </div>
      <div
        id={listId}
        role="listbox"
        aria-multiselectable="true"
        aria-label={control.label}
        data-slot="command-list"
        className={`${COMMAND_LIST_CLASSES} ${COMMAND_GROUP_CLASSES}`}
      >
        {rows.map((row, index) => (
          <FacetRow
            key={row.key}
            row={row}
            id={`${listId}-${String(index)}`}
            active={index === current}
            onHover={() => setActive(index)}
          />
        ))}
      </div>
      {rows.length === 0 && <div className={COMMAND_EMPTY_CLASSES}>{emptyLabel}</div>}
    </div>
  )
}
