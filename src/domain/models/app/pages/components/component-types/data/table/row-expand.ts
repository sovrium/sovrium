/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Row expand — the grid's own record panel.
 *
 * Opening a row's full record is a first-class property of the grid in the
 * parity target, not something an author assembles. Today it is hand-wired:
 * `onRowClick: { action: 'openDrawer', component: <id> }` plus a sibling
 * `drawer` carrying the same `dataSource.table`, connected by a matching
 * id. Three declarations, two components, one id to keep in step — to express
 * the single most ordinary thing a grid does.
 *
 * `rowExpand: true` replaces all of it.
 *
 * ## What an expand with no field list shows
 *
 * **Every declared field of the bound table, in declared order** — resolved by
 * the same `resolveRecordDrawerFields` the standalone drawer already uses, which
 * carries each field's `label` and `description` through.
 *
 * Deliberately NOT the grid's `columns[]`. The reason to expand a row is to see
 * what the row cannot show, so deriving from the columns would make expand a
 * no-op on a grid that already shows everything, and would silently hide a field
 * the author never asked to hide. Columns govern the GRID; they neither narrow
 * nor order the expand.
 *
 * This matters because the drawer island's own fallback is an EMPTY list
 * (`EMPTY_FIELDS`), which renders a panel that fetches the record and then shows
 * nothing but a Save button. A shorthand whose whole promise is "expand this
 * row" must not be able to land there — which is why the system-source case
 * below is refused rather than defaulted.
 *
 * ## Why `boolean | object` rather than one or the other
 *
 * The question is how each shape fails while only half the system understands
 * it, because a schema key always lands before every consumer reads it:
 *
 *  - **Boolean alone** cannot express a narrowed field list or a read-only
 *    panel, so it forces a union widening later — the churn, just deferred.
 *  - **Object alone** makes `rowExpand: {}` the spelling of "yes", which is a
 *    worse thing to write and to read than `rowExpand: true`.
 *  - **`boolean | object`** (chosen) degrades to CORRECT: a consumer reading
 *    `.fields` off `true` gets `undefined` and falls through to the derived
 *    default, which is the behaviour `true` asks for anyway. TypeScript forces
 *    the normalisation at compile time, so the mistake is caught rather than
 *    silent. `comments.moderation` already carries a `Schema.Union(Schema.Boolean, …)`
 *    in AppSchema, so the shape is established here.
 *
 * ## Where this deliberately stops
 *
 * `rowExpand` is the 90% shorthand, not a replacement for a record-bound `drawer`. The
 * hand-wired form stays valid and unchanged, because it can do four things this
 * cannot and should not learn: bind a DIFFERENT table from the grid's, bind a
 * `system` detail endpoint, be shared by two grids, and carry footer `actions`
 * with `$record` interpolation. An author who needs per-entry `renderAs`, a
 * `region` role, or a footer action uses the drawer — which is exactly why
 * `rowExpand.fields` is a list of NAMES rather than a second field-entry
 * vocabulary that could drift from `RecordDrawerFieldSchema`.
 *
 * @example
 * ```yaml
 * # The whole declaration. One control per declared field of `deals`.
 * rowExpand: true
 * ```
 *
 * @example
 * ```yaml
 * # Narrowed and read-only.
 * rowExpand:
 *   fields: [name, stage, amount, notes] # `notes` need not be a column
 *   canEdit: false
 *   title: Deal detail
 * ```
 */
export const DataTableRowExpandSchema = Schema.Struct({
  /**
   * The fields the panel shows, in this order. Omit it and every declared field
   * of the bound table is shown, in declared order.
   *
   * Field NAMES only. Each entry's type, display label and guidance text resolve
   * from the bound table's field schema — restating them here would be a second
   * vocabulary able to drift from the field it describes, and the grid is always
   * table-bound (a system-source grid may not declare `rowExpand` at all). A
   * field named here need not be a visible column: showing a field the row omits
   * is the point of expanding.
   */
  fields: Schema.optional(
    Schema.Array(
      Schema.String.annotate({ description: 'One field name, as the bound table declares it' })
    ).pipe(
      Schema.annotate({
        description:
          "Field names shown in the expanded record, in this order (default: every declared field of the bound table). Types, labels and descriptions resolve from the table's field schema.",
        examples: [['name', 'stage', 'amount']],
      }),
      Schema.check(
        Schema.isMinLength(1, {
          message:
            'rowExpand.fields must name at least one field, or be omitted to show every field of the bound table',
        })
      )
    )
  ),
  /** `false` renders a read-only record with no save affordance (default: true). */
  canEdit: Schema.optional(
    Schema.Boolean.annotate({
      description: 'Whether the expanded record can be edited and saved (default: true)',
    })
  ),
  /**
   * Accessible name of the expanded panel. Defaults to the record drawer's
   * existing default name, so an expand is announced exactly as a hand-wired
   * drawer is.
   */
  title: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description: 'Accessible name of the expanded record panel',
        examples: ['Deal detail', "Détail de l'enregistrement"],
      }),
      Schema.check(Schema.isNonEmpty({ message: 'rowExpand.title must not be empty' }))
    )
  ),
}).annotate({
  title: 'Data Table Row Expand',
  description: 'Expanded record panel opened from a row, derived from the bound table',
})

/**
 * `rowExpand` as written in config: `true` for the derived panel, or the object
 * form to narrow it.
 *
 * `false` is accepted and means the same as omitting the key — it exists so an
 * author can switch an expand off in place without deleting the line.
 */
export const DataTableRowExpandConfigSchema = Schema.Union([
  Schema.Boolean,
  DataTableRowExpandSchema,
]).annotate({
  title: 'Data Table Row Expand Config',
  description:
    'true to expand rows into a record panel derived from the bound table, or an object to narrow the fields, make it read-only, or name it',
})

export type DataTableRowExpand = Schema.Schema.Type<typeof DataTableRowExpandConfigSchema>
