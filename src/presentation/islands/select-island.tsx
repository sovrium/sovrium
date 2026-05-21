/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Combobox } from '@base-ui/react/combobox'
import { Select } from '@base-ui/react/select'
import { cn } from '@/presentation/islands/lib/cn'
import type { ReactElement } from 'react'

interface OptionItem {
  readonly label: string
  readonly value: string
  readonly disabled?: boolean
  readonly icon?: string
}

interface SelectIslandProps {
  readonly options?: readonly OptionItem[]
  readonly placeholder?: string
  readonly multiple?: boolean
  readonly searchable?: boolean
  readonly defaultValue?: string
  readonly disabled?: boolean
  readonly label?: string
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
}


function ChevronDown(): ReactElement {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
    >
      <path
        d="M3 4.5L6 7.5L9 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CheckMark(): ReactElement {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
    >
      <path
        d="M3.5 7L6 9.5L10.5 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SelectOption({ option }: { readonly option: OptionItem }): ReactElement {
  return (
    <Select.Item
      value={option.value}
      disabled={option.disabled}
      className="text-fg data-[disabled]:text-fg-subtle data-[highlighted]:bg-bg-subtle flex cursor-pointer items-center px-3 py-2 text-sm outline-none data-[disabled]:cursor-not-allowed"
    >
      <Select.ItemText>{option.label}</Select.ItemText>
      <Select.ItemIndicator className="text-primary ml-auto">
        <CheckMark />
      </Select.ItemIndicator>
    </Select.Item>
  )
}

function ComboboxItemRenderer(item: OptionItem): ReactElement {
  return (
    <Combobox.Item
      key={item.value}
      value={item}
      disabled={item.disabled}
      className="text-fg data-[disabled]:text-fg-subtle data-[highlighted]:bg-bg-subtle flex cursor-pointer items-center px-3 py-2 text-sm outline-none data-[disabled]:cursor-not-allowed"
    >
      {item.label}
      <Combobox.ItemIndicator className="text-primary ml-auto">
        <CheckMark />
      </Combobox.ItemIndicator>
    </Combobox.Item>
  )
}

function ComboboxPopupContent(): ReactElement {
  return (
    <Combobox.Portal>
      <Combobox.Positioner sideOffset={4}>
        <Combobox.Popup className="border-border bg-bg-overlay max-h-60 overflow-auto rounded-md border py-1 shadow-lg">
          <Combobox.Empty className="text-fg-muted px-3 py-2 text-sm">No results</Combobox.Empty>
          <Combobox.List>{(item: OptionItem) => ComboboxItemRenderer(item)}</Combobox.List>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  )
}

function SearchableSelect({
  options,
  placeholder,
  defaultValue,
  disabled,
  label,
  className,
}: SelectIslandProps): ReactElement {
  const items = options ?? []
  const defaultItem =
    defaultValue !== undefined ? items.find((o) => o.value === defaultValue) : undefined
  const triggerLabel = label ? `Open ${label}` : 'Open options'

  return (
    <div className={cn(className)}>
      <Combobox.Root
        items={items}
        defaultValue={defaultItem}
        disabled={disabled}
      >
        {label && (
          <Combobox.Label className="text-fg mb-1 block text-sm font-medium">
            {label}
          </Combobox.Label>
        )}
        <Combobox.InputGroup className="border-border bg-bg-raised focus-within:border-primary focus-within:ring-focus-ring flex w-full items-center rounded-md border shadow-sm transition-colors focus-within:ring-1 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50">
          <Combobox.Input
            placeholder={placeholder ?? 'Select...'}
            aria-label={label}
            className="text-fg flex-1 bg-transparent px-3 py-2 text-sm outline-none"
          />
          <Combobox.Trigger
            aria-label={triggerLabel}
            className="text-fg-subtle px-2"
          >
            <ChevronDown />
          </Combobox.Trigger>
        </Combobox.InputGroup>
        <ComboboxPopupContent />
      </Combobox.Root>
    </div>
  )
}

function PlainSelect({
  options,
  placeholder,
  defaultValue,
  disabled,
  label,
  className,
}: SelectIslandProps): ReactElement {
  const items = options ?? []
  const valueLabelMap = new Map(items.map((o) => [o.value, o.label]))
  return (
    <div className={cn(className)}>
      <Select.Root
        items={items}
        defaultValue={defaultValue}
        disabled={disabled}
      >
        {label && (
          <Select.Label className="text-fg mb-1 block text-sm font-medium">{label}</Select.Label>
        )}

        <Select.Trigger className="border-border bg-bg-raised text-fg data-[open]:border-primary data-[open]:ring-focus-ring flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm shadow-sm transition-colors data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[open]:ring-1">
          <Select.Value placeholder={placeholder ?? 'Select...'}>
            {(value: string | null) =>
              value === null || value === undefined
                ? (placeholder ?? 'Select...')
                : (valueLabelMap.get(value) ?? value)
            }
          </Select.Value>
          <Select.Icon className="text-fg-subtle ml-2">
            <ChevronDown />
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Positioner sideOffset={4}>
            <Select.Popup className="border-border bg-bg-overlay max-h-60 overflow-auto rounded-md border py-1 shadow-lg">
              <Select.List>
                {options?.map((option) => (
                  <SelectOption
                    key={option.value}
                    option={option}
                  />
                ))}
              </Select.List>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    </div>
  )
}

export default function SelectIsland(props: SelectIslandProps): ReactElement {
  return props.searchable ? <SearchableSelect {...props} /> : <PlainSelect {...props} />
}
