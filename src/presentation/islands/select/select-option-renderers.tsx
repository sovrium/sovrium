/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Combobox } from '@base-ui/react/combobox'
import { Select } from '@base-ui/react/select'
import {
  computeComboboxEmptyClasses,
  computeComboboxItemClasses,
  computeComboboxListClasses,
  computeComboboxPopupClasses,
  computeSelectGroupLabelClasses,
  computeSelectItemClasses,
  computeSelectItemIndicatorClasses,
  computeSelectItemTextClasses,
  computeSelectPositionerClasses,
} from '../../design/select-default-classes'
import { CheckMark } from './select-icons'
import type { OptionItem } from './select-island-types'
import type { ReactElement } from 'react'

/** shadcn/ui `SelectItem`: `data-slot="select-item"`, its text, and the check pinned to its end. */
export function SelectOption({ option }: { readonly option: OptionItem }): ReactElement {
  return (
    <Select.Item
      value={option.value}
      disabled={option.disabled}
      className={computeSelectItemClasses()}
      data-slot="select-item"
    >
      <Select.ItemText className={computeSelectItemTextClasses()}>{option.label}</Select.ItemText>
      <Select.ItemIndicator className={computeSelectItemIndicatorClasses()}>
        <CheckMark />
      </Select.ItemIndicator>
    </Select.Item>
  )
}

/** A run of consecutive options sharing one `group` (none for ungrouped options). */
interface OptionRun {
  readonly group?: string
  readonly options: readonly OptionItem[]
}

/** The options in written order, cut into runs of one group each. */
const optionRuns = (options: readonly OptionItem[]): readonly OptionRun[] =>
  options.reduce<readonly OptionRun[]>((runs, option) => {
    const last = runs.at(-1)
    return last !== undefined && last.group === option.group
      ? [...runs.slice(0, -1), { ...last, options: [...last.options, option] }]
      : [...runs, { group: option.group, options: [option] }]
  }, [])

/**
 * The options of a select, each run of one `group` drawn as shadcn/ui's
 * `SelectGroup` under its `SelectLabel`, which is no option.
 */
export function SelectOptions({
  options,
}: {
  readonly options: readonly OptionItem[]
}): ReactElement {
  return (
    <>
      {optionRuns(options).map((run, index) =>
        run.group === undefined ? (
          run.options.map((option) => (
            <SelectOption
              key={option.value}
              option={option}
            />
          ))
        ) : (
          <Select.Group
            key={`group-${String(index)}`}
            data-slot="select-group"
          >
            <Select.GroupLabel
              className={computeSelectGroupLabelClasses()}
              data-slot="select-label"
            >
              {run.group}
            </Select.GroupLabel>
            {run.options.map((option) => (
              <SelectOption
                key={option.value}
                option={option}
              />
            ))}
          </Select.Group>
        )
      )}
    </>
  )
}

/** shadcn/ui `ComboboxItem`: `data-slot="combobox-item"` and the check pinned to its end. */
export function ComboboxItemRenderer(item: OptionItem): ReactElement {
  return (
    <Combobox.Item
      key={item.value}
      value={item}
      disabled={item.disabled}
      className={computeComboboxItemClasses()}
      data-slot="combobox-item"
      data-value={item.value}
    >
      {item.label}
      <Combobox.ItemIndicator className={computeSelectItemIndicatorClasses()}>
        <CheckMark />
      </Combobox.ItemIndicator>
    </Combobox.Item>
  )
}

export function ComboboxPopupContent({
  emptyLabel = 'No results',
}: {
  /** What a search that matched nothing says, in the page language (`select.noResults`). */
  readonly emptyLabel?: string
}): ReactElement {
  return (
    <Combobox.Portal>
      {/*
       * `align` defaults to `'center'`, which opens a list narrower than its
       * control in the middle of it. The searchable half is the same control
       * as the plain one and opens on the same edge. (`Combobox.Positioner`
       * has no `alignItemWithTrigger` — it never overlapped its anchor — so
       * the edge is the only thing to correct here.) `positionMethod` is the
       * plain half's reason too: an absolutely-positioned popup opening below
       * the fold grows the document it was portalled into.
       */}
      <Combobox.Positioner
        className={computeSelectPositionerClasses()}
        sideOffset={6}
        positionMethod="fixed"
        align="start"
      >
        <Combobox.Popup
          className={computeComboboxPopupClasses()}
          data-slot="combobox-content"
        >
          <Combobox.Empty
            className={computeComboboxEmptyClasses()}
            data-slot="combobox-empty"
          >
            {emptyLabel}
          </Combobox.Empty>
          <Combobox.List
            className={computeComboboxListClasses()}
            data-slot="combobox-list"
          >
            {ComboboxItemRenderer}
          </Combobox.List>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  )
}
