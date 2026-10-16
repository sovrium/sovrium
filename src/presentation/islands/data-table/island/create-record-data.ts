/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Records-API create helper for the data-table's trailing add-row. It POSTs to
 * the EXISTING record CRUD endpoint `POST /api/tables/:t/records`, so it builds
 * no new backend; the add-row coerces its values through the ONE shared rule in
 * `runtime/field-value-coercion.ts` first, so a typed column never 500s on
 * create.
 */

/** What a create attempt came back with. */
export interface CreateOutcome {
  readonly ok: boolean
  /** The server's own message on a refusal, when it sent one. */
  readonly message?: string
  /**
   * Each refused field's message, keyed by field name — read off the
   * `errors[]` of the canonical validation envelope
   * (`{ success: false, code: 'VALIDATION_ERROR', message, errors: [{ field, message }] }`).
   * Absent when the refusal named no field.
   */
  readonly fieldErrors?: Readonly<Record<string, string>>
}

/** One entry of the validation envelope's `errors[]`, as far as it can be trusted. */
interface FieldErrorEntry {
  readonly field?: unknown
  readonly message?: unknown
}

/** The `errors[]` entries that name a field and say something about it. */
function fieldErrorsOf(errors: unknown): Readonly<Record<string, string>> | undefined {
  if (!Array.isArray(errors)) return undefined
  const entries = (errors as readonly FieldErrorEntry[]).flatMap((entry) =>
    typeof entry?.field === 'string' && typeof entry.message === 'string'
      ? [[entry.field, entry.message] as const]
      : []
  )
  return entries.length === 0 ? undefined : Object.fromEntries(entries)
}

/**
 * Create a record from a field map. Values are already type-coerced by the
 * caller, so the POST body carries the JSON types the records API expects.
 *
 * The message on a refusal is read off the canonical error envelope so a
 * surface that shows refusals inline (the add-row) can name what the server
 * objected to rather than reporting a bare status, and its `errors[]` so the
 * create dialog can draw each one under its own field.
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
  const body = (await res.json().catch(() => undefined)) as
    { readonly message?: string; readonly errors?: unknown } | undefined
  const fieldErrors = res.status < 500 ? fieldErrorsOf(body?.errors) : undefined
  return {
    ok: false,
    ...(body?.message && { message: body.message }),
    ...(fieldErrors && { fieldErrors }),
  }
}
