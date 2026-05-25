/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Combobox } from '@base-ui/react/combobox'
import { Select } from '@base-ui/react/select'
import { CheckMark } from './select-icons'
import type { OptionItem } from './select-island-types'
import type { ReactElement } from 'react'

export function SelectOption({ option }: { readonly option: OptionItem }): ReactElement {
  return (
    <Select.Item
      value={option.value}
      disabled={option.disabled}
      className="text-foreground data-[disabled]:text-foreground-subtle data-[highlighted]:bg-background-subtle flex cursor-pointer items-center px-3 py-2 text-sm outline-none data-[disabled]:cursor-not-allowed"
    >
      <Select.ItemText>{option.label}</Select.ItemText>
      <Select.ItemIndicator className="text-primary ml-auto">
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
      className="text-foreground data-[disabled]:text-foreground-subtle data-[highlighted]:bg-background-subtle flex cursor-pointer items-center px-3 py-2 text-sm outline-none data-[disabled]:cursor-not-allowed"
    >
      {item.label}
      <Combobox.ItemIndicator className="text-primary ml-auto">
        <CheckMark />
      </Combobox.ItemIndicator>
    </Combobox.Item>
  )
}

export function ComboboxPopupContent(): ReactElement {
  return (
    <Combobox.Portal>
      <Combobox.Positioner sideOffset={4}>
        <Combobox.Popup className="border-border bg-background-overlay max-h-60 overflow-auto rounded-md border py-1 shadow-lg">
          <Combobox.Empty className="text-foreground-muted px-3 py-2 text-sm">
            No results
          </Combobox.Empty>
          <Combobox.List>{ComboboxItemRenderer}</Combobox.List>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  )
}
