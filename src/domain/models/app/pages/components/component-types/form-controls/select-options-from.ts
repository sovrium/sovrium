/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * A choice control's options, taken from the option list a table FIELD declares.
 *
 * ─── WHAT THE OTHER TWO SOURCES CANNOT SAY ─────────────────────────────────
 *
 * A `select` already resolves its choices from somewhere other than a literal
 * list, through `dataSource` — and both members of that binding read ROWS:
 *
 *  - the table member (`{ table, displayField }`) turns each record of a table
 *    into one option. A `status` field's choices are not records: they are the
 *    `options[]` the field declares, which exist before the table holds a row and
 *    stay complete when it holds none;
 *  - the system member (`{ system, labelKey }`) reads one top-level array of an
 *    endpoint's reply. The only reply that carries a field's options nests them
 *    under `fields[n].options`, at a position no `rowsKey` can name.
 *
 * Writing the list out in `options` works once and then drifts: the field gains
 * a state, the filter above its grid does not. This key names the field
 * instead, so the field stays the one place its choices are declared.
 *
 * ─── WHY IT IS NOT A THIRD MEMBER OF `dataSource` ──────────────────────────
 *
 * The two binding members share a contract — rows, a `limit`, a `sort`, a
 * `filter` — that a declared option list has none of: its order is the declared
 * order and its length is the declared length. And the binding sits in three
 * other positions (`form.fields[].optionsSource`, `filter-bar.fields[]
 * .optionsSource`, `editSelect.optionsSource`) where a table-bound field already
 * offers its own options; widening the union would widen all three for no one.
 * The shape is the select's counterpart of `filter-bar.fieldsFrom`, which
 * derives a bar's whole field list from one table the same way.
 *
 * ─── THE TABLE MAY COME FROM THE ROUTE ─────────────────────────────────────
 *
 * `table` takes a declared table's name, or `$param.<segment>` on a page whose
 * path declares that segment — the spelling a route-bound grid already uses — so
 * one page can carry a facet over whichever table its address names.
 *
 * Resolved on the server before render and replaced by a concrete `options`
 * array, like `dataSource`, so neither name reaches the browser.
 *
 * @example
 * ```yaml
 * - type: select
 *   props: { id: status-facet, label: Status }
 *   emptyOption: { label: Any status }
 *   optionsFrom: { table: tickets, field: status }
 * ```
 */
export const SelectOptionsFromSchema = Schema.Struct({
  /** The table whose field declares the options; a declared name or `$param.<segment>`. */
  table: Schema.String.pipe(
    Schema.annotate({
      description:
        'The table whose field declares the options: a table the app declares, or `$param.<segment>` to take it from the page address',
      examples: ['tickets', '$param.table'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
  /** The choice field (`single-select`, `multi-select` or `status`) whose options are offered. */
  field: Schema.String.pipe(
    Schema.annotate({
      description:
        'The field whose declared options are offered, in their declared order. It must be a single-select, multi-select or status field.',
      examples: ['status', 'priority'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
}).annotate({
  identifier: 'SelectOptionsFrom',
  title: 'Options From',
  description:
    "Offer the options a table field declares, in their declared order, each with the field's label for it. Exclusive with `options` and with `dataSource`.",
})

/** @public */
export type SelectOptionsFrom = Schema.Schema.Type<typeof SelectOptionsFromSchema>
