/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useFieldLineIds } from '../parts/crud-form/field-id-scope'
import type { TypedFieldProps } from './record-drawer-typed-input'

/**
 * The state attributes every control carries: required, refused, and the lines
 * describing it — its guidance, then why it was refused.
 */
export function useControlStateAttributes(
  props: TypedFieldProps
): Readonly<Record<string, unknown>> {
  const { field, error } = props
  const ids = useFieldLineIds(field.name)
  const describedBy = [
    field.description === undefined ? undefined : ids.description,
    error === undefined ? undefined : ids.refusal,
  ].filter((id): id is string => id !== undefined)
  return {
    ...(field.required === true ? { required: true } : {}),
    ...(error === undefined ? {} : { 'aria-invalid': 'true' }),
    ...(describedBy.length === 0 ? {} : { 'aria-describedby': describedBy.join(' ') }),
  }
}
