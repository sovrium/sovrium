/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Records-API create helper + typed-value coercion for the data-table toolbar
 * create flow ([internal ref], and the dogfooded admin Données surface
 * [internal ref]). POSTs the filled fields to the EXISTING record
 * CRUD endpoint `POST /api/tables/:t/records` — so the toolbar never builds new
 * backend — with each value coerced to the JSON type its column expects
 * (numeric columns as numbers, not `"42"`; booleans as booleans) so a typed
 * column never 500s on create.
 */

/** Column types whose value must POST as a JSON number, not a string. */
const NUMERIC_TYPES: ReadonlySet<string> = new Set([
  'number',
  'integer',
  'decimal',
  'currency',
  'percent',
  'rating',
  'duration',
])

/** True when a field's value should serialize as a JSON number. */
export function isNumericFieldType(type: string): boolean {
  return NUMERIC_TYPES.has(type)
}

/**
 * Coerce a create-form value map (all string-valued, the way `<input>` /
 * `<select>` report) into the JSON shape the records API expects: numeric
 * columns POST as numbers (not `"42"`), booleans as booleans. Unknown types and
 * text columns pass through unchanged. A blank numeric/boolean value is dropped
 * upstream (the create flow filters empties) so this never emits `NaN`.
 */
export function coerceFieldValues(
  values: Record<string, string>,
  fieldTypes: ReadonlyMap<string, string>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(values).map(([name, value]) => {
      const type = fieldTypes.get(name)
      if (type && isNumericFieldType(type)) {
        const num = Number(value)
        return [name, Number.isFinite(num) ? num : value]
      }
      if (type === 'checkbox' || type === 'boolean') return [name, value === 'true']
      return [name, value]
    })
  )
}

/**
 * Create a record from a field map; returns true on a successful (2xx) create.
 * Values are already type-coerced by the caller (numeric columns as numbers)
 * via {@link coerceFieldValues}, so the POST body carries the JSON types the
 * records API expects.
 */
export async function createRecord(
  table: string,
  fields: Record<string, unknown>
): Promise<boolean> {
  const res = await fetch(`/api/tables/${table}/records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  return res.ok
}
