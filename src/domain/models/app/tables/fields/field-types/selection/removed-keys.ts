/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The keys removed from a selection field (`tables[].fields[]`), and what
 * replaces each.
 *
 * `conditions` on a `single-select` field locked the whole record while the
 * field held a given value (`conditions: [{ when: completed, then: { readOnly: true } }]`).
 * Only three of the doors a record is written through applied it, and no form,
 * drawer or grid showed it. It is replaced by the table's `rules`, whose `lock`
 * kind does the same on every door and can lock chosen fields only. Refused
 * from 0.46 without a deprecation release, because the replacement ships in the
 * same release ([internal ref] D2j).
 */

/** The node path of one field of a table. */
const TABLE_FIELD_PATH = /^tables\[\d+\]\.fields\[\d+\]$/

/** Keys removed from a `single-select` field. */
const REMOVED_ON_SINGLE_SELECT: ReadonlyMap<string, string> = new Map([
  [
    'conditions',
    '`conditions` has been removed from single-select fields: declare the lock on the table instead, `rules: [{ name: <name>, kind: lock, when: { field: <this field>, operator: eq, value: <the value> } }]`. The lock refuses every change to the record while the field holds that value, on every way a record is written; add `fields` to lock only some fields, or `except` to leave some free.',
  ],
])

/**
 * The migration message for a key removed from a selection field, or
 * `undefined` when this module has nothing to say about it.
 *
 * @param path - Dotted path of the NODE holding the key, e.g. `tables[0].fields[2]`.
 * @param discriminant - The field's `type` literal.
 * @param key - The property name the author wrote.
 */
export const migrationHintForRemovedSelectionFieldKey = (
  path: string,
  discriminant: string | undefined,
  key: string
): string | undefined =>
  TABLE_FIELD_PATH.test(path) && discriminant === 'single-select'
    ? REMOVED_ON_SINGLE_SELECT.get(key)
    : undefined

/** Every removed key, for the test that pins each message names its replacement. @internal */
export const REMOVED_SELECTION_FIELD_KEYS: readonly string[] = [...REMOVED_ON_SINGLE_SELECT.keys()]
