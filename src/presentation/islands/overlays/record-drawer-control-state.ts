/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { fieldDescriptionId } from '@/presentation/design/field-display'
import { refusalIdOf } from './record-drawer-field'
import type { TypedFieldProps } from './record-drawer-typed-input'

/**
 * The state attributes every control carries: required, refused, and the lines
 * describing it — its guidance, then why it was refused.
 */
export function controlStateAttributes(props: TypedFieldProps): Readonly<Record<string, unknown>> {
  const { field, error } = props
  const describedBy = [
    field.description === undefined ? undefined : fieldDescriptionId(field.name),
    error === undefined ? undefined : refusalIdOf(field.name),
  ].filter((id): id is string => id !== undefined)
  return {
    ...(field.required === true ? { required: true } : {}),
    ...(error === undefined ? {} : { 'aria-invalid': 'true' }),
    ...(describedBy.length === 0 ? {} : { 'aria-describedby': describedBy.join(' ') }),
  }
}
