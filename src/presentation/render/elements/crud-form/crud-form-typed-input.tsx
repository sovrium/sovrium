/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  nativeInputTypeOf,
  numericAdornmentOf,
  numericInputAttributes,
  toDateInputValue,
  type ControlAttributeField,
} from '@/presentation/design/field-control-attributes'
import { fieldWidgetOf } from '@/presentation/design/field-type-behavior'
import { LOCAL_ZONE, toLocalInputValue } from '@/presentation/design/zoned-datetime'
import type { ReactElement } from 'react'

/**
 * The typed half of the skeleton's plain input — its native `type`, a number's
 * `step`/`min`/`max`, the value a `date` or `datetime-local` input holds, and the
 * unit drawn beside it. Every decision is read from `field-control-attributes`,
 * which the hydrated island reads too, so the two agree on each column.
 */
type TypedInputField = ControlAttributeField

export function inputTypeOf(field: TypedInputField): string {
  return nativeInputTypeOf(field.type)
}

/**
 * The typed half of a plain input: a number's `step`/`min`/`max`. Shared with
 * the island through `field-control-attributes`, so the skeleton and the
 * hydrated control carry the same attributes.
 */
export function typedInputAttributes(field: TypedInputField): Record<string, unknown> {
  return fieldWidgetOf(field.type) === 'number' ? numericInputAttributes(field) : {}
}

/**
 * A stored value as the typed input holds it: a `date` input takes the
 * `YYYY-MM-DD` head, a `datetime-local` input the wall-clock reading in the
 * column's zone.
 */
export function inputValueOf(field: TypedInputField, value: string): string {
  const widget = fieldWidgetOf(field.type)
  if (widget === 'date') return toDateInputValue(value)
  if (widget === 'datetime') return toLocalInputValue(value, field.timeZone ?? LOCAL_ZONE)
  return value
}

/** The unit shown beside a number input (`€`, `%`), drawn as the island draws it. */
export function withAdornment(field: TypedInputField, input: ReactElement): ReactElement {
  const adornment = numericAdornmentOf(field)
  if (adornment === undefined) return input
  // `aria-hidden`: the control sits inside its `<label>`, and a visible unit
  // there would be read into the control's name ("Budget €").
  const unit = (
    <span
      className="text-foreground-muted text-sm"
      aria-hidden="true"
    >
      {adornment.text}
    </span>
  )
  return (
    <div className="flex items-center gap-2">
      {adornment.position === 'before' && unit}
      {input}
      {adornment.position === 'after' && unit}
    </div>
  )
}
