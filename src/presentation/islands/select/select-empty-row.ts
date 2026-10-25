/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { OptionItem } from './select-island-types'

/** What the empty row's `''` serialises to inside the primitive: any non-empty key. */
const EMPTY_ROW_KEY = '\u0000empty'
const emptyRowAsValue = (value: unknown): string => (value === '' ? EMPTY_ROW_KEY : String(value))

/**
 * Base UI reads a value serialising to `''` as no value, and draws the
 * placeholder over it. A select carrying an empty row (`emptyOption`) holds
 * `''` as a real choice, so its trigger names that row instead.
 */
export const emptyRowProps = (options: readonly OptionItem[] | undefined) =>
  options?.some((option) => option.value === '') === true
    ? { itemToStringValue: emptyRowAsValue }
    : {}
