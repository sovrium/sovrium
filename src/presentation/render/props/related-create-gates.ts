/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Merge the per-field related-create gates the data-source resolver stamped
 * into each field's `edit` bag.
 *
 * `canCreateRelated` cannot ride `EDIT_META_KEYS`: that allowlist reads
 * DECLARED FIELD PROPERTIES off `app.tables`, and this is a per-session
 * permission answer that only exists once a session is known. Merging it into
 * the same bag — rather than adding a parallel island prop — means the picker
 * keeps reading one source (`editMetaOf(props.fieldMeta)`) instead of
 * reconciling two for one decision.
 *
 * It lives in its own module rather than beside `EDIT_META_KEYS`
 * (`resolve-field-cell-meta.ts`) because this is the one entry in that bag
 * whose value does NOT come from the table schema — a distinction worth a file
 * boundary. It was also once a `max-lines` necessity, back when the allowlists
 * shared a file with the builder; that half of the reason has expired and the
 * other half has not.
 */

/** A field's metadata bag as the data-table island receives it. */
interface FieldMetaEntry {
  readonly edit?: Record<string, unknown>
}

export function withRelatedCreateGates(
  fieldMeta: Record<string, unknown> | undefined,
  gates: Readonly<Record<string, boolean>> | undefined
): Record<string, unknown> | undefined {
  if (!fieldMeta || !gates) return fieldMeta
  return Object.fromEntries(
    Object.entries(fieldMeta).map(([name, meta]) => {
      const gate = gates[name]
      const entry = meta as FieldMetaEntry | undefined
      // A field with no `edit` bag declares no `relatedTable`, so there is no
      // related table to gate and nothing to merge.
      if (gate === undefined || !entry?.edit) return [name, meta]
      return [name, { ...entry, edit: { ...entry.edit, canCreateRelated: gate } }]
    })
  )
}
