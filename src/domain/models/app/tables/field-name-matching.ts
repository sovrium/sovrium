/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Case- and separator-insensitive matching between a config's field REFERENCE
 * and a table's declared column NAME.
 *
 * A form's `fields[].field` has always accepted either convention: an author may
 * write `firstName` against a column declared `first_name`, and the CRUD form
 * resolver matches them. This module is the single definition of that folding —
 * it lives in the domain layer because BOTH the presentation renderer that
 * honours the tolerance and the config validator that must not contradict it
 * need it, and a validator may not import from `src/presentation/`.
 *
 * It exists because the two disagreed: the renderer folded, the validator
 * compared exactly, and a config the renderer rendered perfectly was refused at
 * boot with "field 'firstName' not found in table 'contacts'".
 *
 * SCOPE — this is deliberately NOT the universal field-lookup rule. It applies
 * only where the RENDERER folds, which as of today is exactly one config key
 * (`fields[].field`). Every other field reference in the codebase — a
 * data-table's `groupBy`, a kanban/calendar `colorField`, a record-drawer entry,
 * a `dataSource.sort` — is resolved by exact name, including
 * `fieldGroups[].fields[]` inside the very same form component. Folding a
 * validator that guards one of THOSE would make it accept a name the renderer
 * then silently drops, which is worse than a loud refusal: it is the silent
 * failure the validator was written to end.
 */

/**
 * Fold a field name to its comparison form: separators removed, lowercased.
 *
 * @example
 * normalizeFieldName('firstName')  // 'firstname'
 * normalizeFieldName('first_name') // 'firstname'
 * normalizeFieldName('first-name') // 'firstname'
 */
export function normalizeFieldName(name: string): string {
  return name.replace(/[_-]/g, '').toLowerCase()
}

/** Whether two field names refer to the same column under the folding above. */
export function fieldNamesMatch(a: string, b: string): boolean {
  return normalizeFieldName(a) === normalizeFieldName(b)
}

/**
 * The declared column a reference resolves to, or `undefined` when none does.
 *
 * An exact hit wins outright, so a config naming a real column can never be
 * re-pointed at a differently-spelled sibling by the folding.
 */
export function findMatchingFieldName(
  declared: readonly string[],
  reference: string
): string | undefined {
  if (declared.includes(reference)) return reference
  return declared.find((name) => fieldNamesMatch(name, reference))
}
