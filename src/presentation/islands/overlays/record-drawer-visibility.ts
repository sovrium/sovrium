/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A sheet's per-record `visibleWhen`: which `recordFields` entries and footer
 * actions the open record keeps.
 *
 * Read against the record the sheet LOADED — the one its footer actions fire
 * against — never against the values being typed into its controls, and through
 * `satisfiesFieldCondition`, the matcher a grid's row actions, a `button` field
 * and `visibility.record` share. An unmet condition leaves the entry out: the
 * caller never sees it, so a hidden button cannot fire and a hidden field is
 * neither drawn nor sent by Save — which is how hiding a field never clears it.
 *
 * Until the record has loaded there is nothing to read the condition against,
 * so a conditional entry waits for it rather than flashing in on an empty
 * record. A NEW record has no stored values: its conditions read that blank.
 */

import { satisfiesFieldCondition } from '@/domain/models/app/tables/condition-match-service'
import type { FieldCondition } from '@/domain/models/app/tables/condition-operators'

/** Anything the sheet may draw conditionally. */
interface Conditional {
  readonly visibleWhen?: FieldCondition | undefined
}

/**
 * The value a sheet entry or a condition names: the key of that name when the
 * record carries one, else — for a dotted name such as `_admin.submitter` — the
 * value at that path through the record's nested objects. A read-only entry
 * over an envelope a system read nests reads the same way a grid column does.
 */
export function readRecordPath(record: Readonly<Record<string, unknown>>, name: string): unknown {
  if (name in record || !name.includes('.')) return record[name]
  return name
    .split('.')
    .reduce<unknown>(
      (value, segment) =>
        typeof value === 'object' && value !== null && !Array.isArray(value)
          ? (value as Readonly<Record<string, unknown>>)[segment]
          : undefined,
      record
    )
}

/** A condition read against `record`, its field resolved as a path. */
const satisfiedBy = (
  condition: FieldCondition,
  record: Readonly<Record<string, unknown>>
): boolean =>
  satisfiesFieldCondition(condition, {
    ...record,
    [condition.field]: readRecordPath(record, condition.field),
  })

/**
 * The entries `record` keeps. `known` is false while the record has not
 * loaded yet: only the unconditional entries are kept then.
 */
export function visibleForRecord<T extends Conditional>(
  entries: ReadonlyArray<T>,
  record: Readonly<Record<string, unknown>>,
  known: boolean
): ReadonlyArray<T> {
  if (!entries.some((entry) => entry.visibleWhen !== undefined)) return entries
  return entries.filter(
    (entry) => entry.visibleWhen === undefined || (known && satisfiedBy(entry.visibleWhen, record))
  )
}
