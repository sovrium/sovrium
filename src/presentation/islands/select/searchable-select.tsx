/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Combobox } from '@base-ui/react/combobox'
import { useMemo, type KeyboardEventHandler, type ReactElement } from 'react'
import { cn } from '@/presentation/islands/lib/cn'
import {
  computeComboboxInputClasses,
  computeComboboxInputGroupClasses,
  computeSelectIconClasses,
  computeSelectLabelClasses,
} from './select-default-classes'
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
    <Combobox.InputGroup className={computeComboboxInputGroupClasses()}>
      <Combobox.Input
        placeholder={inputPlaceholder}
        aria-label={label}
        data-allow-custom-value={allowCustomValue ? 'true' : undefined}
        onKeyDown={onInputKeyDown}
        className={computeComboboxInputClasses()}
      />
      <Combobox.Trigger
        aria-label={triggerLabel}
        className={computeSelectIconClasses()}
      >
        <ChevronDown />
      </Combobox.Trigger>
    </Combobox.InputGroup>
  )
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
}: SelectIslandProps): ReactElement {
  const items: readonly OptionItem[] = options ?? []
  const defaultItem =
    defaultValue !== undefined ? items.find((o) => o.value === defaultValue) : undefined
  const triggerLabel = label ? `Open ${label}` : 'Open options'
  const inputPlaceholder = searchPlaceholder ?? placeholder ?? 'Select...'
  const customValueEnabled = allowCustomValue === true
  const { inputValue, onInputKeyDown, onInputValueChange } =
    useComboboxCustomValue(customValueEnabled)
  const controlledInputValue = customValueEnabled ? inputValue : undefined
  const controlledOnInputValueChange = useMemo(
    () => (customValueEnabled ? onInputValueChange : undefined),
    [customValueEnabled, onInputValueChange]
  )

  return (
    <div className={cn(className)}>
      <Combobox.Root
        items={items}
        defaultValue={defaultItem}
        disabled={disabled}
        inputValue={controlledInputValue}
        onInputValueChange={controlledOnInputValueChange}
      >
        {label && <Combobox.Label className={computeSelectLabelClasses()}>{label}</Combobox.Label>}
        <ComboboxInputGroup
          inputPlaceholder={inputPlaceholder}
          label={label}
          triggerLabel={triggerLabel}
          allowCustomValue={customValueEnabled}
          onInputKeyDown={onInputKeyDown}
        />
        <ComboboxPopupContent />
      </Combobox.Root>
    </div>
  )
}
