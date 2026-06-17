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
  readonly multiple?: boolean
  readonly searchable?: boolean
  readonly searchPlaceholder?: string
  readonly allowCustomValue?: boolean
  readonly defaultValue?: string
  readonly disabled?: boolean
  readonly label?: string
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
}
