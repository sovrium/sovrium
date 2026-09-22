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
  computeComboboxInputClasses,
  computeComboboxInputGroupClasses,
  computeSelectIconClasses,
  computeSelectLabelClasses,
} from '../../design/select-default-classes'
import { useSharedFilterPublisher } from '../hooks/use-shared-filter-publisher'
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
  const customValueEnabled = allowCustomValue === true
  const { inputValue, onInputKeyDown, onInputValueChange } =
    useComboboxCustomValue(customValueEnabled)
  // `allowCustomValue: true` lets the user type a value not in the
  // option list. Base UI's Combobox doesn't have a dedicated prop, so
  // we wire it via controlled `inputValue` plus an Enter handler that
  // locks the typed string (preserving the display value after the
  // combobox's own selection-clear logic).
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
        onValueChange={publish}
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
