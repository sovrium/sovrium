/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { fieldWidgetOf } from '@/presentation/design/field-type-behavior'
import { coerceFieldValue, type CoercedFieldValue } from '../../runtime/field-value-coercion'
import { type FieldDef, labelOf } from './field-def'
import { readLinkedIds } from './record-picker-value'

/**
 * What the form SENDS for a field, as opposed to what it HOLDS.
 *
 * The form's state is a `Record<string, string>` end to end — every control
 * reports a string, and a list travels JSON-encoded (see `record-picker-value`).
 * The records API takes the column's own kind of value, so the conversion
 * happens once, here, on the way out:
 *
 * - a number or a rating goes through the SHARED `coerceFieldValue`, the rule the
 *   data table's create dialog and paste import already write with, so `"1234.5"`
 *   reaches the column as `1234.5`;
 * - a multi-select sends its options as a LIST, never a joined string;
 * - everything else is sent as held. A `datetime` control already holds the ISO
 *   instant (it converts the wall-clock reading in the column's zone as it is
 *   typed), and a `date` control holds the ISO calendar date.
 *
 * A number the rule refuses is sent as typed rather than dropped: the server
 * answers it with a validation error the form already knows how to show, where a
 * silent drop would store NULL over what the reader meant.
 */
function toWireValue(field: FieldDef | undefined, value: string): CoercedFieldValue {
  if (field === undefined) return value
  const widget = fieldWidgetOf(field.type)
  if (widget === 'number' || widget === 'rating') {
    const coerced = coerceFieldValue(value, field.type, labelOf(field))
    return coerced.ok ? coerced.value : value
  }
  if (widget === 'multi-select') return readLinkedIds(value, true)
  return value
}

/** Convert a map of held values into the payload a create or update sends. */
export function toWireFields(
  fields: readonly FieldDef[],
  values: Readonly<Record<string, string>>
): Readonly<Record<string, CoercedFieldValue>> {
  return Object.fromEntries(
    Object.entries(values).map(([name, value]) => [
      name,
      toWireValue(
        fields.find((f) => f.name === name),
        value
      ),
    ])
  )
}
