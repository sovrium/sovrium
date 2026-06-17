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
  computeSelectItemClasses,
  computeSelectItemIndicatorClasses,
  computeSelectPopupClasses,
} from './select-default-classes'
import { CheckMark } from './select-icons'
import type { OptionItem } from './select-island-types'
import type { ReactElement } from 'react'

export function SelectOption({ option }: { readonly option: OptionItem }): ReactElement {
  return (
    <Select.Item
      value={option.value}
      disabled={option.disabled}
      className={computeSelectItemClasses()}
    >
      <Select.ItemText>{option.label}</Select.ItemText>
      <Select.ItemIndicator className={computeSelectItemIndicatorClasses()}>
        <CheckMark />
      </Select.ItemIndicator>
    </Select.Item>
  )
}

export function ComboboxItemRenderer(item: OptionItem): ReactElement {
  return (
    <Combobox.Item
      key={item.value}
      value={item}
      disabled={item.disabled}
      className={computeSelectItemClasses()}
    >
      {item.label}
      <Combobox.ItemIndicator className={computeSelectItemIndicatorClasses()}>
        <CheckMark />
      </Combobox.ItemIndicator>
    </Combobox.Item>
  )
}

export function ComboboxPopupContent(): ReactElement {
  return (
    <Combobox.Portal>
      <Combobox.Positioner sideOffset={4}>
        <Combobox.Popup className={computeSelectPopupClasses()}>
          <Combobox.Empty className={computeComboboxEmptyClasses()}>No results</Combobox.Empty>
          <Combobox.List>{ComboboxItemRenderer}</Combobox.List>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  )
}
