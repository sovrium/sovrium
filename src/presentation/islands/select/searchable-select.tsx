/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Combobox } from '@base-ui/react/combobox'
import { useId, useMemo, type KeyboardEventHandler, type ReactElement } from 'react'
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
  /** The text input's id, which the visible caption's `for` names. */
  readonly inputId: string
  readonly inputPlaceholder: string
  readonly label: string | undefined
  /** The `field` label naming the input when the combobox draws no caption. */
  readonly labelledBy: string | undefined
  readonly triggerLabel: string
  readonly allowCustomValue: boolean
  readonly onInputKeyDown: KeyboardEventHandler<HTMLInputElement>
}

function ComboboxInputGroup({
  inputId,
  inputPlaceholder,
  label,
  labelledBy,
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
        id={inputId}
        placeholder={inputPlaceholder}
        aria-label={label}
        // Base UI gives the input its own id once hydrated, so a field label's
        // `for` stops reaching it: the field names it by its label's id instead.
        {...(label === undefined && labelledBy !== undefined
          ? { 'aria-labelledby': labelledBy }
          : {})}
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

/**
 * The visible caption: shadcn/ui's `Label`, as a native `<label>` for the text
 * input. Base UI's `Combobox.Label` labels the TRIGGER only, so a reader who
 * clicked it landed nowhere; the input is the field a reader types into, and a
 * native label both names it and focuses it on click.
 */
function ComboboxCaption({
  label,
  inputId,
}: {
  readonly label: string | undefined
  readonly inputId: string
}): ReactElement | null {
  if (!label) return null
  return (
    <label
      htmlFor={inputId}
      className={computeSelectLabelClasses()}
      data-slot="label"
    >
      {label}
    </label>
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
        inputId={group.inputId}
        label={group.label}
        placeholder={group.inputPlaceholder}
      />
    )
  return <ComboboxInputGroup {...group} />
}

/**
 * The name the input carries: the caption, else — with no field label naming
 * it either — the author's `aria-label`.
 */
const controlName = (
  caption: string | undefined,
  labelledBy: string | undefined,
  ariaLabel: string | undefined
): string | undefined => caption || (labelledBy === undefined ? ariaLabel : undefined)

/**
 * The trigger's accessible name and the input's prompt. `searchPlaceholder`
 * (schema-author intent for the search-input affordance) overrides the generic
 * `placeholder` and the fallback "Select..." prompt.
 */
const comboboxPrompts = (
  label: string | undefined,
  searchPlaceholder: string | undefined,
  placeholder: string | undefined,
  words: Readonly<Record<string, string>> | undefined
) => ({
  triggerLabel: label
    ? (words?.['select.openNamed'] ?? 'Open {label}').split('{label}').join(label)
    : (words?.['select.open'] ?? 'Open options'),
  inputPlaceholder: searchPlaceholder ?? placeholder ?? 'Select...',
})

export function SearchableSelect({
  options,
  placeholder,
  searchPlaceholder,
  allowCustomValue,
  defaultValue,
  disabled,
  label: caption,
  labelledBy,
  ariaLabel,
  className,
  publishes,
  multiple,
  chips,
  name,
  uiStrings,
}: SelectIslandProps): ReactElement {
  // Same publisher wiring as `PlainSelect`: a searchable filter is an ordinary
  // authoring choice, and leaving `publishes` inert on this half would be a
  // declaration that validates and silently does nothing.
  const publish = useSharedFilterPublisher(publishes)
  const items: readonly OptionItem[] = options ?? []
  const defaultItem =
    defaultValue !== undefined ? items.find((o) => o.value === defaultValue) : undefined
  const label = controlName(caption, labelledBy, ariaLabel)
  const prompts = comboboxPrompts(label, searchPlaceholder, placeholder, uiStrings)
  const custom = useCustomValueWiring(allowCustomValue === true && multiple !== true)
  const inputId = useId()

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
        <ComboboxCaption
          label={caption}
          inputId={inputId}
        />
        <ComboboxField
          chips={chips === true && multiple === true}
          inputId={inputId}
          inputPlaceholder={prompts.inputPlaceholder}
          label={label}
          labelledBy={labelledBy}
          triggerLabel={prompts.triggerLabel}
          allowCustomValue={custom.enabled}
          onInputKeyDown={custom.onInputKeyDown}
        />
        <ComboboxPopupContent emptyLabel={uiStrings?.['select.noResults']} />
      </Combobox.Root>
    </div>
  )
}
