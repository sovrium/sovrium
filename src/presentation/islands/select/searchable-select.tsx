/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Combobox } from '@base-ui/react/combobox'
import { useMemo, type KeyboardEventHandler, type ReactElement } from 'react'
import { cn } from '@/presentation/design/class-merge'
import {
  computeComboboxAddonClasses,
  computeComboboxInputClasses,
  computeComboboxInputGroupClasses,
  computeComboboxTriggerClasses,
  computeSelectIconClasses,
  computeSelectLabelClasses,
} from '../../design/select-default-classes'
import { useSharedFilterPublisher } from '../hooks/use-shared-filter-publisher'
import { ComboboxChipsField } from './combobox-chips'
import { ChevronDown } from './select-icons'
import { ComboboxPopupContent } from './select-option-renderers'
import { useComboboxCustomValue } from './use-combobox-custom-value'
import type { OptionItem, SelectIslandProps } from './select-island-types'

interface ComboboxInputGroupProps {
  readonly inputPlaceholder: string
  readonly label: string | undefined
  readonly triggerLabel: string
  readonly allowCustomValue: boolean
  readonly onInputKeyDown: KeyboardEventHandler<HTMLInputElement>
}

function ComboboxInputGroup({
  inputPlaceholder,
  label,
  triggerLabel,
  allowCustomValue,
  onInputKeyDown,
}: ComboboxInputGroupProps): ReactElement {
  return (
    <Combobox.InputGroup
      className={computeComboboxInputGroupClasses()}
      data-slot="input-group"
      role="group"
    >
      <Combobox.Input
        placeholder={inputPlaceholder}
        aria-label={label}
        data-allow-custom-value={allowCustomValue ? 'true' : undefined}
        onKeyDown={onInputKeyDown}
        className={computeComboboxInputClasses()}
        data-slot="input-group-control"
      />
      <div
        className={computeComboboxAddonClasses()}
        data-slot="input-group-addon"
        data-align="inline-end"
      >
        <Combobox.Trigger
          aria-label={triggerLabel}
          className={computeComboboxTriggerClasses()}
          data-slot="combobox-trigger"
        >
          <ChevronDown className={computeSelectIconClasses()} />
        </Combobox.Trigger>
      </div>
    </Combobox.InputGroup>
  )
}

/** The visible caption: shadcn/ui's `Label`, as Base UI's `Combobox.Label`. */
function ComboboxCaption({ label }: { readonly label: string }): ReactElement {
  return (
    <Combobox.Label
      className={computeSelectLabelClasses()}
      data-slot="label"
    >
      {label}
    </Combobox.Label>
  )
}

/**
 * `allowCustomValue: true` lets the user type a value not in the option list.
 * Base UI's Combobox has no dedicated prop, so it is wired through a controlled
 * `inputValue` plus an Enter handler that locks the typed string. A typed value
 * completes ONE choice, so a combobox holding a set does not take it.
 */
function useCustomValueWiring(enabled: boolean) {
  const { inputValue, onInputKeyDown, onInputValueChange } = useComboboxCustomValue(enabled)
  const controlledOnInputValueChange = useMemo(
    () => (enabled ? onInputValueChange : undefined),
    [enabled, onInputValueChange]
  )
  return {
    enabled,
    onInputKeyDown,
    inputValue: enabled ? inputValue : undefined,
    onInputValueChange: controlledOnInputValueChange,
  }
}

/** The field the reader types into: removable chips for a set, else the input group. */
function ComboboxField({
  chips,
  ...group
}: ComboboxInputGroupProps & { readonly chips: boolean }): ReactElement {
  if (chips)
    return (
      <ComboboxChipsField
        label={group.label}
        placeholder={group.inputPlaceholder}
      />
    )
  return <ComboboxInputGroup {...group} />
}

export function SearchableSelect({
  options,
  placeholder,
  searchPlaceholder,
  allowCustomValue,
  defaultValue,
  disabled,
  label,
  className,
  publishes,
  multiple,
  chips,
  name,
}: SelectIslandProps): ReactElement {
  // Same publisher wiring as `PlainSelect`: a searchable filter is an ordinary
  // authoring choice, and leaving `publishes` inert on this half would be a
  // declaration that validates and silently does nothing.
  const publish = useSharedFilterPublisher(publishes)
  const items: readonly OptionItem[] = options ?? []
  const defaultItem =
    defaultValue !== undefined ? items.find((o) => o.value === defaultValue) : undefined
  const triggerLabel = label ? `Open ${label}` : 'Open options'
  // `searchPlaceholder` (schema-author intent for the search-input affordance)
  // overrides the generic `placeholder` and the fallback "Select..." prompt.
  const inputPlaceholder = searchPlaceholder ?? placeholder ?? 'Select...'
  const custom = useCustomValueWiring(allowCustomValue === true && multiple !== true)

  return (
    <div className={cn(className)}>
      <Combobox.Root
        items={items}
        multiple={multiple}
        name={name}
        defaultValue={multiple === true ? undefined : defaultItem}
        disabled={disabled}
        onValueChange={publish}
        inputValue={custom.inputValue}
        onInputValueChange={custom.onInputValueChange}
      >
        {label && <ComboboxCaption label={label} />}
        <ComboboxField
          chips={chips === true && multiple === true}
          inputPlaceholder={inputPlaceholder}
          label={label}
          triggerLabel={triggerLabel}
          allowCustomValue={custom.enabled}
          onInputKeyDown={custom.onInputKeyDown}
        />
        <ComboboxPopupContent />
      </Combobox.Root>
    </div>
  )
}
