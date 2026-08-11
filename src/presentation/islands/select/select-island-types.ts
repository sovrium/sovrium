/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

export interface OptionItem {
  readonly label: string
  readonly value: string
  readonly disabled?: boolean
  readonly icon?: string
}

export interface SelectIslandProps {
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
  /** Placeholder shown inside the combobox search input (only used when `searchable: true`). */
  readonly searchPlaceholder?: string
  /** Accept typed values not in the option list (combobox free-form input). */
  readonly allowCustomValue?: boolean
  readonly defaultValue?: string
  readonly disabled?: boolean
  readonly label?: string
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
}
