/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The date picker's words (`datePicker.pick`, `datePicker.choose`) in the page
 * language, handed by the record drawer to every date control it draws — its
 * own fields, a linked record stacked over it, and a related section's create
 * form — without threading them through each field.
 */

import { createContext, useContext } from 'react'

type DatePickerWords = Readonly<Record<string, string>> | undefined

export const DatePickerWordsContext = createContext<DatePickerWords>(undefined)

/** The words the drawer's host resolved, or none (the picker then speaks English). */
export const useDatePickerWords = (): DatePickerWords => useContext(DatePickerWordsContext)
