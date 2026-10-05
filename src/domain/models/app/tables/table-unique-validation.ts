/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/** The part of a top-level `unique` entry the reference check reads. */
interface UniqueForValidation {
  readonly fields: ReadonlyArray<string>
}

/**
 * Check that every top-level `unique` entry names fields the table declares.
 *
 * An entry is folded into a field's `unique: true` (one field) or a unique
 * index (several), so a misspelt name used to validate and surface as a
 * database error at boot. An entry has no name of its own, so the message
 * names it by position and by the fields it lists. Only declared fields
 * count, as for `indexes`, which a composite entry becomes.
 *
 * Returns the first problem found, or `undefined`.
 */
export const validateUniqueConstraints = (
  unique: ReadonlyArray<UniqueForValidation>,
  fieldNames: ReadonlySet<string>
): { readonly message: string; readonly path: ReadonlyArray<string> } | undefined => {
  const offending = unique
    .flatMap((entry, position) =>
      entry.fields
        .filter((field) => !fieldNames.has(field))
        .map((field) => ({ entry, position, field }))
    )
    .at(0)
  if (offending === undefined) return undefined
  const listed = offending.entry.fields.join(', ')
  return {
    message: `Unique constraint unique[${offending.position}] (fields: ${listed}) references non-existent field "${offending.field}"`,
    path: ['unique'],
  }
}
