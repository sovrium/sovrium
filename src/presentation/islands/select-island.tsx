/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Combobox } from '@base-ui/react/combobox'
import { Select } from '@base-ui/react/select'
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
  /**
   * TODO(escp/select): `multiple` is plumbed end-to-end (schema → renderer
   * → island) but is currently ignored here. Implementing it requires Base
   * UI's `Select.Root` `multiple` prop AND a chip/tag display in the
   * trigger. Out of scope for the F-2 page-level select work.
   */
  readonly multiple?: boolean
  readonly searchable?: boolean
  readonly defaultValue?: string
  readonly disabled?: boolean
  readonly label?: string
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
}

/**
 * TODO(escp/forms): selection state is client-only — `onValueChange` is
 * not wired into form state. F-1 (form trigger) and Phase D (top-level
 * `forms[]`) will need to hand the selected value to the surrounding
 * form via a hidden input or controlled binding. Tracked at the schema
 * level by `name`/`value` pairs in form-control schemas.
 */

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
      className="flex cursor-pointer items-center px-3 py-2 text-sm text-gray-900 outline-none data-[disabled]:cursor-not-allowed data-[disabled]:text-gray-400 data-[highlighted]:bg-gray-100"
    >
      <Select.ItemText>{option.label}</Select.ItemText>
      <Select.ItemIndicator className="ml-auto text-blue-600">
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
      className="flex cursor-pointer items-center px-3 py-2 text-sm text-gray-900 outline-none data-[disabled]:cursor-not-allowed data-[disabled]:text-gray-400 data-[highlighted]:bg-gray-100"
    >
      {item.label}
      <Combobox.ItemIndicator className="ml-auto text-blue-600">
        <CheckMark />
      </Combobox.ItemIndicator>
    </Combobox.Item>
  )
}

function ComboboxPopupContent(): ReactElement {
  return (
    <Combobox.Portal>
      <Combobox.Positioner sideOffset={4}>
        <Combobox.Popup className="max-h-60 overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg">
          <Combobox.Empty className="px-3 py-2 text-sm text-gray-500">No results</Combobox.Empty>
          <Combobox.List>{(item: OptionItem) => ComboboxItemRenderer(item)}</Combobox.List>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  )
}

/**
 * Searchable select rendered with Base UI Combobox primitives.
 *
 * Combobox is "a filterable Select" — pressing the trigger opens the popup,
 * and typing in the input filters the list automatically.
 *
 * A11y note: the input carries the field's `aria-label` so the combobox
 * announces as the named field, and the trigger gets a distinct
 * `Open <label>` label so screen readers can describe both controls
 * unambiguously. When `label` is missing we fall back to the generic
 * `'Open options'` so the trigger is never unlabelled.
 *
 * Identity props (`id`, `data-testid`) are intentionally NOT applied to this
 * inner wrapper. The SSR island marker rendered by `island-form-components.tsx`
 * already carries them on the outer `<div data-island="select">`, which
 * survives hydration as the React mount root. Re-emitting them here would
 * produce duplicate DOM attributes and break Playwright strict-mode locators.
 */
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
    <div className={className}>
      <Combobox.Root
        items={items}
        defaultValue={defaultItem}
        disabled={disabled}
      >
        {label && (
          <Combobox.Label className="mb-1 block text-sm font-medium text-gray-700">
            {label}
          </Combobox.Label>
        )}
        <Combobox.InputGroup className="flex w-full items-center rounded-md border border-gray-300 bg-white shadow-sm transition-colors focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50">
          <Combobox.Input
            placeholder={placeholder ?? 'Select...'}
            aria-label={label}
            className="flex-1 bg-transparent px-3 py-2 text-sm outline-none"
          />
          <Combobox.Trigger
            aria-label={triggerLabel}
            className="px-2 text-gray-400"
          >
            <ChevronDown />
          </Combobox.Trigger>
        </Combobox.InputGroup>
        <ComboboxPopupContent />
      </Combobox.Root>
    </div>
  )
}

/**
 * Non-searchable select rendered with Base UI Select primitives.
 *
 * Passing `items` to Select.Root lets `<Select.Value>` render the selected
 * option's label automatically when only the value is known.
 *
 * Identity props (`id`, `data-testid`) are intentionally NOT applied to this
 * inner wrapper. The SSR island marker rendered by `island-form-components.tsx`
 * already carries them on the outer `<div data-island="select">`, which
 * survives hydration as the React mount root. Re-emitting them here would
 * produce duplicate DOM attributes and break Playwright strict-mode locators.
 */
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
    <div className={className}>
      <Select.Root
        items={items}
        defaultValue={defaultValue}
        disabled={disabled}
      >
        {label && (
          <Select.Label className="mb-1 block text-sm font-medium text-gray-700">
            {label}
          </Select.Label>
        )}

        <Select.Trigger className="flex w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition-colors data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[open]:border-blue-500 data-[open]:ring-1 data-[open]:ring-blue-500">
          <Select.Value placeholder={placeholder ?? 'Select...'}>
            {(value: string | null) =>
              value === null || value === undefined
                ? (placeholder ?? 'Select...')
                : (valueLabelMap.get(value) ?? value)
            }
          </Select.Value>
          <Select.Icon className="ml-2 text-gray-400">
            <ChevronDown />
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Positioner sideOffset={4}>
            <Select.Popup className="max-h-60 overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg">
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

/**
 * Select island — wraps Base UI Select for custom dropdown selection.
 *
 * Replaces native `<select>` with floating positioning, keyboard navigation,
 * custom option rendering, and theme-aware styling via data attributes.
 *
 * When `searchable: true`, switches to Base UI Combobox primitives, which
 * provide built-in type-ahead filtering — Base UI's plain Select supports
 * only basic keyboard typeahead (no list filtering).
 */
export default function SelectIsland(props: SelectIslandProps): ReactElement {
  return props.searchable ? <SearchableSelect {...props} /> : <PlainSelect {...props} />
}
