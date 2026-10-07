/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The options projection of the design-system console: every key path one
 * component type accepts, and the Configuration headings they print under.
 */

import {
  schemaOptionGroupRows,
  schemaOptionTree,
} from '@/domain/models/app/design/schema-option-tree'
import { categoryOf } from './design-system-schema'
import type { ComponentTypeOptionsResponse } from '@/domain/models/api/admin/design-system/component-types'
import type { SchemaOption, SchemaOptionGroup } from '@/domain/models/app/design/schema-option-tree'

/**
 * One option row, narrowed to the fields the response contract publishes.
 *
 * Projected FIELD BY FIELD rather than spread, which is {@link publishedField}
 * one endpoint over and the same reasoning: the walker's row is a DOMAIN value
 * that legitimately carries more than this endpoint publishes, and `strictKeys`
 * on the response refuses the excess — so a spread makes every field a future
 * reader adds to `SchemaOption` a 500 here, on whichever types happen to reach
 * it.
 *
 * `publishedField` states that as "a spread would fail the encode rather than
 * leak", and treats failing loudly as the safe half of the trade. It is only the
 * safe half where the projection is explicit: the same `strictKeys` that refuses
 * a smuggled field is what turns an unprojected one into an outage.
 *
 * That is not hypothetical. `defaultNote` and `howTo` were added to the walk for
 * the `sovrium docs` manual — a schema-STATED fallback no decode can surface —
 * and would reach this response through a spread. The result
 * was a 500 on 14 of the 90 catalogued types and a clean 200 on the other 76,
 * because the failure needs a type whose option tree descends into an annotated
 * node: `button` never does, `table` and `form` do.
 *
 * Each optional field is OMITTED rather than set to `undefined`, because absence
 * is the contract for all four — `truncated` absent means the walk reached the
 * row in full — and `optionalField` would decode a present `undefined` into a
 * key the console then has to treat as meaningful.
 */
const publishedOption = (row: SchemaOption): ComponentTypeOptionsResponse['items'][number] => ({
  path: row.path,
  kind: row.kind,
  ...(row.values === undefined ? {} : { values: row.values }),
  ...(row.defaultValue === undefined ? {} : { defaultValue: row.defaultValue }),
  ...(row.description === undefined ? {} : { description: row.description }),
  ...(row.truncated === undefined ? {} : { truncated: row.truncated }),
})

/**
 * One Configuration heading, narrowed the same way and for the same reason.
 *
 * No field of `SchemaOptionGroup` is excess TODAY, so this projection changes
 * nothing about the bytes on the wire. It is here because the row projection
 * above would otherwise close the defect for `items[]` and leave its twin open
 * one field away on `groups[]` — the same walker, the same `strictKeys`, and a
 * reader who adds a heading-level annotation next.
 */
const publishedGroup = (
  group: SchemaOptionGroup
): ComponentTypeOptionsResponse['groups'][number] => ({
  key: group.key,
  kind: group.kind,
  ...(group.description === undefined ? {} : { description: group.description }),
  ...(group.defaultValue === undefined ? {} : { defaultValue: group.defaultValue }),
  hasDefault: group.hasDefault,
  total: group.total,
})

/**
 * Every option one type accepts, or `undefined` when the name is not catalogued.
 *
 * ─── THE 404 IS THE DETAIL ROUTE'S, ONE LEVEL DOWN ─────────────────────────
 *
 * `undefined` covers exactly the case its sibling's does — a name the catalogue
 * does not publish, whether a typo or a type in a withheld category. A distinct
 * status would let a caller enumerate which types exist but are withheld.
 *
 * A type the catalogue LISTS but refuses to DRAW — `form` — is
 * SERVED, for the reason {@link componentTypeDetail} gives at length: refusing
 * to render a live submit control is a bound on the preview frame, and it says
 * nothing about whether an author may read what the type accepts. Their fields
 * are exactly as real as `button`'s, and an author writing one needs them
 * documented more than most.
 */
export const componentTypeOptions = (
  type: string,
  group?: string
): ComponentTypeOptionsResponse | undefined => {
  if (categoryOf(type) === undefined) return undefined

  // `groups` is published beside `items`, never instead of it: the flat list
  // answers "which key paths does this type accept", and the headings answer
  // "what does a Configuration section print". A page cannot derive one from
  // the other — a row template binds ONE rows source and cannot iterate an
  // array hanging off the row it is drawing — so both cross the wire.
  const { items, groups, capped } = schemaOptionTree(type)
  const headings = groups.map(publishedGroup)
  if (group === undefined) {
    const published = items.map(publishedOption)
    return { type, items: published, groups: headings, total: published.length, capped }
  }

  // ─── THE INNER READ OF THE TWO ───────────────────────────────────────────
  //
  // Narrowed in BOTH fields: the rows this group draws, and that group alone.
  // Leaving `groups` whole would let the inner read be mistaken for a second
  // copy of the outer one, and a page binding it would print every heading
  // again under each heading.
  //
  // An unknown group answers EMPTY rather than falling back to the whole list.
  // A silent fallback would draw every option of the type under one heading and
  // look exactly like a working page — the confident wrong answer, which is
  // worse than a blank section that says what it is.
  // `value` is added on TOP of the shared projection rather than carried through
  // it: it is the one field that tells a group read apart from the flat list, so
  // spelling it here keeps that difference where a reader of the two branches
  // looks for it.
  const rows = schemaOptionGroupRows(type, group).map((row) => ({
    ...publishedOption(row),
    value: row.value,
  }))
  return {
    type,
    items: rows,
    groups: headings.filter((heading) => heading.key === group),
    total: rows.length,
    capped,
  }
}
