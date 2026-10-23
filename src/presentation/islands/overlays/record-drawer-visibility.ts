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
    (entry) =>
      entry.visibleWhen === undefined ||
      (known && satisfiesFieldCondition(entry.visibleWhen, record))
  )
}
