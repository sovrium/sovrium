/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui combobox (https://ui.shadcn.com), registry commit 3464245c4513.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

import { Combobox } from '@base-ui/react/combobox'
import {
  computeComboboxChipClasses,
  computeComboboxChipInputClasses,
  computeComboboxChipRemoveClasses,
  computeComboboxChipsClasses,
} from '../../design/select-default-classes'
import { XMark } from './select-icons'
import type { OptionItem } from './select-island-types'
import type { ReactElement } from 'react'

/** One chosen value as a chip, with the button that removes it named after it. */
function ComboboxChip({ item }: { readonly item: OptionItem }): ReactElement {
  return (
    <Combobox.Chip
      className={computeComboboxChipClasses()}
      data-slot="combobox-chip"
    >
      {item.label}
      <Combobox.ChipRemove
        aria-label={`Remove ${item.label}`}
        className={computeComboboxChipRemoveClasses()}
        data-slot="combobox-chip-remove"
      >
        <XMark className="pointer-events-none size-3" />
      </Combobox.ChipRemove>
    </Combobox.Chip>
  )
}

/** The chips of every chosen value, in the order chosen. */
const renderChips = (values: readonly OptionItem[]): ReactElement => (
  <>
    {values.map((item) => (
      <ComboboxChip
        key={item.value}
        item={item}
      />
    ))}
  </>
)

/**
 * shadcn/ui's `ComboboxChips`: a combobox holding a set draws each chosen
 * value as a removable chip inside the field, before the text input the reader
 * types into. Backspace in the empty input removes the last chip.
 */
export function ComboboxChipsField({
  label,
  placeholder,
}: {
  readonly label: string | undefined
  readonly placeholder: string
}): ReactElement {
  return (
    <Combobox.Chips
      className={computeComboboxChipsClasses()}
      data-slot="combobox-chips"
    >
      <Combobox.Value>{renderChips}</Combobox.Value>
      <Combobox.Input
        aria-label={label}
        placeholder={placeholder}
        className={computeComboboxChipInputClasses()}
        data-slot="combobox-chip-input"
      />
    </Combobox.Chips>
  )
}
