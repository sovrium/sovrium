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
  // A picker holding a LIST of links holds it JSON-encoded; the API takes the
  // list itself. Sent as held, the encoded string reached an integer key column
  // and every auto-save of a form with one was refused.
  if (widget === 'record-picker' && field.allowMultiple === true) return readLinkedIds(value, true)
  return value
}

/**
 * The key a cleared field is marked with, in the form's value map and in a
 * natively posted form: `<field>__clear`. Clearing is an explicit gesture —
 * an empty control means "untouched" — so the mark travels beside the field.
 */
export const clearMarkOf = (name: string): string => `${name}__clear`

/** Whether the held values mark `name` cleared. */
export const isMarkedCleared = (values: Readonly<Record<string, string>>, name: string): boolean =>
  values[clearMarkOf(name)] === '1'

/**
 * Convert a map of held values into the payload a create or update sends. A
 * field marked cleared is sent as `null` — the records API's "store it empty",
 * which also unlinks every link of a relationship — and the marks themselves
 * are never sent.
 */
export function toWireFields(
  fields: readonly FieldDef[],
  values: Readonly<Record<string, string>>
): Readonly<Record<string, CoercedFieldValue | null>> {
  return Object.fromEntries(
    Object.entries(values)
      .filter(([name]) => !name.endsWith('__clear'))
      .map(([name, value]) => [
        name,
        isMarkedCleared(values, name)
          ? null
          : toWireValue(
              fields.find((f) => f.name === name),
              value
            ),
      ])
  )
}

/**
 * The widgets whose visible controls do not post the value the form holds:
 * a picker posts its search box (the linked record's or account's DISPLAY
 * text), a rating its radio inputs, a multi-select one checkbox entry per
 * ticked option — which a form-encoded body reads back as a single string.
 */
const POSTS_HELD_VALUE: ReadonlySet<string> = new Set([
  'record-picker',
  'user-picker',
  'rating',
  'multi-select',
])

/**
 * Put the value the form HOLDS for each such field into a natively posted
 * form's data, in place of what its controls posted: a picker's key, a rating's
 * rank, a multi-select's options as the JSON list it holds. An empty field
 * posts nothing, so an untouched value is left as it is.
 */
export function postHeldValues(
  formData: FormData,
  fields: readonly FieldDef[],
  values: Readonly<Record<string, string>>
): void {
  fields
    .filter((field) => POSTS_HELD_VALUE.has(fieldWidgetOf(field.type)))
    .forEach((field) => {
      formData.delete(field.name)
      const held = (values[field.name] ?? '').trim()
      if (held !== '') formData.set(field.name, held)
    })
}
