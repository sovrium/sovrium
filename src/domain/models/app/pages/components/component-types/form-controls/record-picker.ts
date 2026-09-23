/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { DataFilterSchema, DataSortSchema } from '../../data-source'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

/**
 * `record-picker` — search another table and link the row you find.
 *
 * ─── WHY THIS IS A TYPE, AFTER [internal ref] REFUSED ONE ─────────────────────────
 *
 * [internal ref] (2026-09-09) refused a `record-picker` component type on the grounds
 * that a `relationship` COLUMN already resolves to this widget wherever it is
 * bound, so a type would be a second way to declare one control. That reasoning
 * holds for the bound case and is unchanged: a `form` or a `table` over a table
 * with a `relationship` column still needs no `type: record-picker`, and the
 * dispatch that gives it one is not going anywhere.
 *
 * [internal ref] (2026-09-11) overturns it for the UNBOUND case, which the earlier
 * decision did not weigh. A page that is not a crud-form — a filter bar, a
 * console panel, a step in a wizard that writes somewhere else — has no column
 * to dispatch from, and therefore no way to offer a search over a table at all.
 * The refusal's own invalidation signal named this: *"an author reaching for a
 * searchable picker NOT backed by a table relationship."*
 *
 * ─── WHY `select` IS NOT THIS, IN ITS OWN WORDS ────────────────────────────
 *
 * `select-option-source.ts` anticipated this control and declined to be it:
 * *"A picker over a large table is a DIFFERENT capability — a searchable,
 * debounced, server-side candidate fetch … and is deliberately NOT expressed
 * here."* The difference is bounded-ness. A `select` resolves its options
 * SERVER-SIDE BEFORE RENDER and inlines them into the HTML, so it is capped at
 * 100 (hard max 1000) because an uncapped bind would inline a table into a
 * page. A picker never inlines anything: it fetches one capped page per
 * keystroke, from the server, and says when there are more.
 *
 * ─── THE SECURITY JUDGEMENT, STATED RATHER THAN IMPLIED ────────────────────
 *
 * `select`'s resolve-ahead design keeps the table name and any `filter` out of
 * the client bundle. **A picker cannot, and must not pretend to.** Its whole
 * mechanism is a live query, so the candidate endpoint is reached from the
 * browser and the table it names is visible there. That is acceptable, and it
 * is not a weakening of rule S4, for three reasons that must all keep holding:
 *
 *  1. the table is the OPERATOR's own, declared in their own config — it is not
 *     a secret from the operator's own signed-in users;
 *  2. every candidate read goes through the ordinary records route, so RBAC and
 *     field-level permissions apply unchanged, and an unauthorised caller gets
 *     **404** rather than a filtered list (anti-enumeration);
 *  3. the `filter` below is applied SERVER-SIDE and is not merely a hint — a
 *     caller who edits the request cannot widen the candidate set past it.
 *
 * Point 3 is the one an implementation can silently get wrong, and the one the
 * specs pin: a filter enforced only in the island is a filter that does not
 * exist.
 *
 * @example
 * ```yaml
 * - type: record-picker
 *   dataSource:
 *     table: companies
 *     displayField: name        # required — what a row is CALLED
 *     filter: [{ field: city, operator: eq, value: Lyon }]
 *     pageSize: 20
 *   allowCreate: true
 *   multiple: true
 *   maxLinked: 3
 *   props: { label: Companies }
 * ```
 */
export const RecordPickerTypeLiteral = Schema.Literal('record-picker')

/**
 * Where the candidates come from.
 *
 * Shaped after `SelectOptionSourceSchema` on purpose — an author who has bound
 * one control to a table should not have to learn a second vocabulary for the
 * next — minus `limit` (a picker pages rather than caps) and plus `pageSize`.
 */
export const RecordPickerSourceSchema = Schema.Struct({
  /**
   * Table the candidates are searched in.
   *
   * Cross-validated against `app.tables` at config load, by
   * `validateTableNameReferences` — which keys on the SHAPE that binds a table
   * (`dataSource.table`) rather than on a list of component types, so this
   * bespoke struct is covered without naming `record-picker` anywhere. It was
   * not, until [internal ref]: its sibling `SelectOptionSourceSchema`, which
   * this schema is shaped after, was checked, but `validateAllSelectOptionSources`
   * gates on `type === 'select'` and the picker fell through.
   */
  table: Schema.String.pipe(
    Schema.annotate({
      description: 'Table the candidates are searched in (validated against app.tables)',
      examples: ['companies', 'contacts'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
  /**
   * Row field that NAMES a candidate — what the reader searches and sees.
   *
   * Optional here where `select` makes it required, and the difference is not
   * an inconsistency. A `select` without it renders a list of blank labels,
   * which is a control that validates and shows nothing. A picker without it
   * degrades to something honest and still usable: it offers ids and SAYS it is
   * searching by id, which is the `no displayField` state the console draws.
   * Guessing a column would be worse than either.
   */
  displayField: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Row field that names a candidate — what is searched and shown. Omit and the picker searches by id and says so, rather than guessing a column.',
        examples: ['name', 'title'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  /** Row field supplying the linked VALUE. Defaults to `id`, which every table has. */
  valueField: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        defaultNote: 'id',
        description: "Row field supplying the linked value (default: 'id')",
        examples: ['id', 'slug'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  /**
   * Conditions (AND logic) narrowing which rows can be found at all.
   *
   * Applied SERVER-SIDE on every candidate read, including the first page and
   * every keystroke after it. It scopes the control for everyone who can see it
   * — it is not a per-caller permission, which is what table and field
   * permissions are for.
   */
  filter: Schema.optional(
    Schema.Array(DataFilterSchema).annotate({
      description:
        'Conditions (AND logic) narrowing the candidate set. Enforced server-side on every page and every search.',
    })
  ),
  /** Sort rules applied in order — omit at the cost of a non-deterministic order. */
  sort: Schema.optional(
    Schema.Array(DataSortSchema).annotate({
      description: 'Sort rules applied in order (omit at the cost of a non-deterministic order)',
    })
  ),
  /**
   * How many candidates one page holds. Default 20, hard max 100.
   *
   * A picker is a shortlist, and the cap is what keeps it one. The list says
   * when there are more rather than truncating silently, and it reports a
   * total only once the list is COMPLETE — a count over a paged result would
   * be a claim about the table that the response cannot support.
   */
  pageSize: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        description: 'Candidates per page. Default 20, hard max 100 — a picker is a shortlist.',
        examples: [20, 50],
      }),
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0), Schema.isLessThanOrEqualTo(100))
    )
  ),
}).annotate({
  identifier: 'RecordPickerSource',
  title: 'Record Picker Source',
  description:
    'The table a record picker searches, how a row is named, and how the candidate set is narrowed and paged. Every read is server-side.',
})

export const recordPickerFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  /** Where the candidates come from. Required — a picker with no table has nothing to search. */
  dataSource: RecordPickerSourceSchema,
  /**
   * Offer to CREATE the record the search did not find, and link it in one
   * gesture, with the typed text going into `displayField`.
   *
   * Off by default, because on it is a write path from a control whose job is
   * to read. Three refusals ride with it and are behaviour rather than
   * decoration: a table with another required column cannot be filled from one
   * text box and the picker must name the column that blocks it; a caller
   * without insert permission gets NO create affordance rather than a disabled
   * one; and a picker with no `displayField` cannot offer it at all, because
   * there is no column for the typed text to go into.
   */
  allowCreate: Schema.optional(
    Schema.Boolean.annotate({
      description:
        'Offer to create the missing record from the typed text and link it (default: false). Absent — never disabled — for a caller who cannot insert into the table.',
    })
  ),
  /** Link more than one record. Picking a second REPLACES the first when false. */
  multiple: Schema.optional(
    Schema.Boolean.annotate({
      description: 'Link more than one record, as accumulating chips (default: false)',
    })
  ),
  /**
   * Cap the number of linked records. Only meaningful with `multiple`.
   *
   * At the cap the search closes and the control reads "N of N linked", rather
   * than inviting a search that cannot add anything — an affordance that
   * accepts input and discards it is the failure this exists to prevent.
   */
  maxLinked: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        description:
          'Maximum linked records; the search closes at the cap. Only meaningful alongside `multiple: true`.',
        examples: [3, 10],
      }),
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
    )
  ),
  /** Placeholder shown while nothing is linked — "No company linked" rather than a blank box. */
  placeholder: Schema.optional(
    Schema.String.annotate({
      description: 'Shown while nothing is linked. An unset link should say so in words.',
      examples: ['No company linked', 'Search companies'],
    })
  ),
  /** Render the linked value without a search box, for a caller who may read but not relink. */
  readOnly: Schema.optional(
    Schema.Boolean.annotate({
      description:
        'Render the linked value only. A reader who cannot change the link gets the value, not a disabled search box.',
    })
  ),
} as const
