/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createContext, useContext } from 'react'
import { fieldDescriptionId } from '@/presentation/design/field-display'

/**
 * A prefix for the ids a field's lines are found by — its guidance line and the
 * line saying why its value was refused, which its control names in
 * `aria-describedby`. Empty wherever one copy of a form is drawn, so those ids
 * stay the field's name alone; set where several copies of the same form share a
 * page — the rows a grid opens in place, each scoped by its record — so that each
 * control is described by its own lines, never by another copy's.
 */
export const FieldIdScope = createContext('')

/** The ids of a field's guidance line and of its refusal line, within the nearest scope. */
export function useFieldLineIds(name: string): {
  readonly description: string
  readonly refusal: string
} {
  const description = `${useContext(FieldIdScope)}${fieldDescriptionId(name)}`
  return { description, refusal: `${description}-error` }
}
