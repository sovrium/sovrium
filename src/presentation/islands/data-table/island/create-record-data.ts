/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Records-API create helper for the data-table's two create surfaces — the
 * toolbar modal ([internal ref], dogfooded by the admin Données
 * surface [internal ref]) and the trailing add-row. Both POST
 * to the EXISTING record CRUD endpoint `POST /api/tables/:t/records`, so
 * neither builds new backend, and both coerce through the ONE shared rule in
 * `shared/field-value-coercion.ts` so a typed column never 500s on create.
 */

import {
  coerceFieldValues as coerceWithRule,
  isNumericFieldType as isNumeric,
} from '../../runtime/field-value-coercion'

/** True when a field's value should serialize as a JSON number. */
export function isNumericFieldType(type: string): boolean {
  return isNumeric(type)
}

/**
 * Coerce a create-form value map (all string-valued, the way `<input>` /
 * `<select>` report) into the JSON shape the records API expects.
 *
 * The modal's typed controls cannot produce a value the shared rule refuses —
 * a numeric column renders `<input type="number">` — so a refusal here can
 * only come from a field with no metadata, and it is passed through for the
 * server to judge rather than silently dropped.
 */
export function coerceFieldValues(
  values: Record<string, string>,
  fieldTypes: ReadonlyMap<string, string>
): Record<string, unknown> {
  const { accepted, refused } = coerceWithRule(values, fieldTypes)
  const passedThrough = Object.fromEntries(refused.map(({ field }) => [field, values[field]]))
  return { ...accepted, ...passedThrough }
}

/** What a create attempt came back with. */
export interface CreateOutcome {
  readonly ok: boolean
  /** The server's own message on a refusal, when it sent one. */
  readonly message?: string
}

/**
 * Create a record from a field map. Values are already type-coerced by the
 * caller, so the POST body carries the JSON types the records API expects.
 *
 * The message on a refusal is read off the canonical error envelope so a
 * surface that shows refusals inline (the add-row) can name what the server
 * objected to rather than reporting a bare status.
 */
export async function postRecord(
  table: string,
  fields: Record<string, unknown>
): Promise<CreateOutcome> {
  const res = await fetch(`/api/tables/${table}/records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  if (res.ok) return { ok: true }
  const body = (await res.json().catch(() => undefined)) as { message?: string } | undefined
  return { ok: false, ...(body?.message && { message: body.message }) }
}

/** Create a record from a field map; returns true on a successful (2xx) create. */
export async function createRecord(
  table: string,
  fields: Record<string, unknown>
): Promise<boolean> {
  return (await postRecord(table, fields)).ok
}
