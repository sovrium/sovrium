/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Select } from '@base-ui/react/select'
import { useCallback, type ReactElement } from 'react'
import { CheckGlyph, ChevronDownGlyph } from '@/presentation/design/control-glyphs'
import {
  computeSelectIconClasses,
  computeSelectItemClasses,
  computeSelectItemIndicatorClasses,
  computeSelectItemTextClasses,
  computeSelectListClasses,
  computeSelectPopupClasses,
  computeSelectPositionerClasses,
  computeSelectValueClasses,
} from '@/presentation/design/select-default-classes'
import { modalPortalContainer } from '../runtime/modal-portal-container'
import type { ChoiceItem, ChoiceSelectListProps } from './choice-select'

/**
 * The choice field's Select itself, on Base UI — loaded on demand by
 * `parts/choice-select`, so only a surface that draws a choice downloads it,
 * and every island drawing one shares this single chunk.
 */

/** shadcn/ui `SelectItem`: its text, and the check pinned to its end. */
function ChoiceOption({ item }: { readonly item: ChoiceItem }): ReactElement {
  return (
    <Select.Item
      value={item.value}
      className={computeSelectItemClasses()}
      data-slot="select-item"
      data-value={item.value ?? ''}
    >
      <Select.ItemText className={computeSelectItemTextClasses()}>{item.label}</Select.ItemText>
      <Select.ItemIndicator className={computeSelectItemIndicatorClasses()}>
        <CheckGlyph />
      </Select.ItemIndicator>
    </Select.Item>
  )
}

/**
 * A closed list leaves at once, without the fade it opens with. A form holds
 * several Selects one under the other, and the reader moves straight from one
 * choice to the next: a list still fading out would sit over the next field's
 * list — and answer for it — for the length of its fade.
 */
const NO_EXIT = { animation: 'none' } as const
const leavesAtOnce = (state: { readonly open: boolean }) => (state.open ? undefined : NO_EXIT)

/**
 * shadcn/ui `SelectContent`: below the trigger, pinned to its left edge and
 * placed against the viewport, as the page `select` places it (see
 * `select/plain-select`). Inside a modal dialog or a drawer it portals into
 * that dialog, so it shares the top layer the dialog is drawn in.
 */
function ChoiceList({ items }: { readonly items: readonly ChoiceItem[] }): ReactElement {
  return (
    <Select.Portal container={modalPortalContainer}>
      <Select.Positioner
        className={computeSelectPositionerClasses()}
        sideOffset={4}
        alignItemWithTrigger={false}
        positionMethod="fixed"
        side="bottom"
        align="start"
      >
        <Select.Popup
          className={computeSelectPopupClasses()}
          style={leavesAtOnce}
          data-slot="select-content"
          data-align-trigger="false"
        >
          <Select.List className={computeSelectListClasses()}>
            {items.map((item) => (
              <ChoiceOption
                key={item.value ?? ''}
                item={item}
              />
            ))}
          </Select.List>
        </Select.Popup>
      </Select.Positioner>
    </Select.Portal>
  )
}

/** The loaded Select: its root, its trigger and its list. */
export default function ChoiceSelectList(props: ChoiceSelectListProps): ReactElement {
  const { name, value, onValueChange, emptyLabel, inputRef, items, trigger } = props
  const change = useCallback(
    (next: unknown) => onValueChange(typeof next === 'string' ? next : ''),
    [onValueChange]
  )
  return (
    <Select.Root
      items={items}
      value={value === '' ? null : value}
      onValueChange={change}
      name={name}
      modal={false}
      {...(inputRef === undefined ? {} : { inputRef })}
      {...(props.disabled === true && { disabled: true })}
      {...(props.required === true && { required: true })}
    >
      <Select.Trigger {...trigger}>
        <Select.Value
          placeholder={emptyLabel ?? ''}
          className={computeSelectValueClasses()}
          data-slot="select-value"
        />
        <Select.Icon render={<ChevronDownGlyph className={computeSelectIconClasses()} />} />
      </Select.Trigger>
      <ChoiceList items={items} />
    </Select.Root>
  )
}
