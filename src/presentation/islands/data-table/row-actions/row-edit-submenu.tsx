/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Menu } from '@base-ui/react/menu'
import { useState, type ReactElement } from 'react'
import {
  computeMenuItemClasses,
  computeMenuPopupClasses,
  computeMenuSeparatorClasses,
} from '../../overlays/menu-default-classes'
import { actionTypeAttr } from './action-type-attr'
import { refocusMenuTrigger } from './trigger-focus'
import type { RowActionEntryProps } from './row-action-menu-item'
import type { TableRecord } from '../../runtime/types'
import type { ActionColumnItem } from '@/domain/models/app/pages/components/component-types/data/table/schema'

type EditSelect = NonNullable<ActionColumnItem['editSelect']>
type EditOption = { readonly value: string; readonly label: string }

/** Each option's stored value and the label it reads as. */
const optionsOf = (editSelect: EditSelect): readonly EditOption[] =>
  (editSelect.options ?? []).map((option) => ({
    value: option.value,
    label: option.label ?? option.value,
  }))

/**
 * A list editor on a row that does not carry its list: the server could not
 * read the value, and saving from it would replace values nobody could see.
 */
const isUnreadList = (editSelect: EditSelect, record: TableRecord): boolean =>
  editSelect.multiple === true && !Array.isArray(record[editSelect.field])

/** The row's current values of the edited field, as strings. */
const currentOf = (editSelect: EditSelect, record: TableRecord): readonly string[] => {
  const stored = record[editSelect.field]
  if (Array.isArray(stored)) return stored.map(String)
  return stored === undefined || stored === null ? [] : [String(stored)]
}

/** The check a chosen option shows, lucide's `check`. */
const CHECK = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="size-4"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
)

const OPTION_ITEM = `${computeMenuItemClasses()} pr-8`
const INDICATOR = 'pointer-events-none absolute right-2 flex size-4 items-center justify-center'

/** A single-value editor: base-nova's `DropdownMenuRadioGroup`, committing on the pick. */
function RadioOptions({
  options,
  value,
  onCommit,
}: {
  readonly options: readonly EditOption[]
  readonly value: string
  readonly onCommit: (value: string) => void
}): ReactElement {
  return (
    <Menu.RadioGroup
      value={value}
      onValueChange={(next: string) => onCommit(next)}
    >
      {options.map((option) => (
        <Menu.RadioItem
          key={option.value}
          value={option.value}
          closeOnClick
          className={OPTION_ITEM}
        >
          {option.label}
          <Menu.RadioItemIndicator className={INDICATOR}>{CHECK}</Menu.RadioItemIndicator>
        </Menu.RadioItem>
      ))}
    </Menu.RadioGroup>
  )
}

/** A list editor: checkbox items the reader ticks, then one item that saves the list. */
function CheckboxOptions({
  options,
  initial,
  saveLabel,
  onCommit,
}: {
  readonly options: readonly EditOption[]
  readonly initial: readonly string[]
  readonly saveLabel: string
  readonly onCommit: (values: readonly string[]) => void
}): ReactElement {
  const [ticked, setTicked] = useState<readonly string[]>(initial)
  return (
    <>
      {options.map((option) => (
        <Menu.CheckboxItem
          key={option.value}
          checked={ticked.includes(option.value)}
          closeOnClick={false}
          onCheckedChange={(checked) =>
            setTicked((now) =>
              checked ? [...now, option.value] : now.filter((v) => v !== option.value)
            )
          }
          className={OPTION_ITEM}
        >
          {option.label}
          <Menu.CheckboxItemIndicator className={INDICATOR}>{CHECK}</Menu.CheckboxItemIndicator>
        </Menu.CheckboxItem>
      ))}
      <div className={computeMenuSeparatorClasses()} />
      <Menu.Item
        className={computeMenuItemClasses()}
        onClick={() => onCommit(options.map((o) => o.value).filter((v) => ticked.includes(v)))}
      >
        {saveLabel}
      </Menu.Item>
    </>
  )
}

/**
 * An `editSelect` action inside the row's `…` menu: a submenu named by the
 * action's label, holding the field's options as base-nova's
 * `DropdownMenuRadioItem`s with the row's value checked; picking one commits it.
 * With `multiple`, the options are checkbox items the reader ticks, and the
 * submenu's last entry saves the ticked list (an empty list is the answer
 * "none"). The commit goes through the same row-action handler as a press, with
 * the picked value overriding `$record.<field>`.
 */
export function RowEditSubmenu(props: RowActionEntryProps): ReactElement {
  const { action, record, onActionClick, labels, origin, focusKey } = props
  const editSelect = action.editSelect as EditSelect
  const options = optionsOf(editSelect)
  const commit = (value: string | readonly string[]) => {
    void Promise.resolve(
      onActionClick(action, { ...record, [editSelect.field]: value }, origin())
    ).finally(() => refocusMenuTrigger(focusKey))
  }
  return (
    <Menu.SubmenuRoot>
      <Menu.SubmenuTrigger
        data-slot="dropdown-menu-sub-trigger"
        data-action-type={actionTypeAttr(action)}
        disabled={isUnreadList(editSelect, record) || options.length === 0}
        className={computeMenuItemClasses()}
      >
        {action.label}
      </Menu.SubmenuTrigger>
      <Menu.Portal>
        <Menu.Positioner
          side="right"
          align="start"
          positionMethod="fixed"
          className="isolate z-50 outline-none"
        >
          <Menu.Popup
            data-slot="dropdown-menu-sub-content"
            aria-label={editSelect.label ?? action.label}
            className={computeMenuPopupClasses()}
          >
            {editSelect.multiple === true ? (
              <CheckboxOptions
                options={options}
                initial={currentOf(editSelect, record)}
                saveLabel={editSelect.saveLabel ?? labels.save}
                onCommit={commit}
              />
            ) : (
              <RadioOptions
                options={options}
                value={currentOf(editSelect, record)[0] ?? ''}
                onCommit={commit}
              />
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.SubmenuRoot>
  )
}
