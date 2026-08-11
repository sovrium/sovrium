/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * The keys ONE grouping level accepts.
 *
 * Declared once and spread into both {@link DataTableGroupBySchema} (the primary
 * level) and the `thenBy` element schema (the sub-levels), so the two can never
 * drift into offering different options at different depths. One list, both jobs
 * — the same convergence `dataTableFields` applies to the component's own surface.
 */
const groupByLevelFields = {
  /** Field to group rows by */
  field: Schema.String.annotations({ description: 'Field name to group rows by' }),
  /**
   * Order of the group HEADERS at THIS level.
   *
   * This orders the group buckets themselves: `desc` on a `status` grouping
   * renders the `shipped` header above the `pending` one. It is NOT the sort of
   * the rows INSIDE a group — that is `dataSource.sort` and the column headers.
   *
   * Per level, and independent between levels: the outer level may open on a
   * declared pipeline order while the inner one reads Z→A. A `direction` on a
   * sub-level orders that sub-level's headers WITHIN each parent group and has no
   * effect on the order of the parents.
   *
   * ⚠️ HOMOGRAPH — do not conflate with `ViewGroupBySchema.direction`
   * (`src/domain/models/app/tables/views/group-by.ts`). The two share this name
   * but are DIFFERENT options with different mechanisms: that one compiles into
   * the generated view's SQL `ORDER BY` clause (`view-generators.ts` →
   * `generateOrderByClause`), while this one orders the grid's rendered group
   * headers presentation-side. Changing one has no effect on the other.
   */
  direction: Schema.optional(
    Schema.Literal('asc', 'desc').annotations({
      description:
        'Order of this level’s group headers themselves, not the row sort within a group (default: asc)',
    })
  ),
  /**
   * Start the groups AT THIS LEVEL collapsed.
   *
   * Per level, because "fold everything so I can compare the top-level totals"
   * and "show every stage but fold the owners inside each one" are different
   * requests and both are useful. A single grid-wide flag can express only one of
   * them.
   *
   * Collapsing a level nests: a collapsed primary group hides everything beneath
   * it, sub-level headers included. So `collapsed: true` on the primary level
   * with `collapsed: false` on a sub-level is coherent rather than contradictory
   * — nothing at the sub-level is visible until its parent is opened, at which
   * point its sub-groups are open.
   */
  collapsed: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Start this level’s groups collapsed (default: false)',
    })
  ),
}

/**
 * One sub-level of grouping — the same options the primary level accepts.
 *
 * Deliberately module-local: nothing outside this file names the level type
 * today, and exporting a type no importer uses is what `knip` exists to catch.
 * Export it when a consumer needs it rather than ahead of one.
 */
const DataTableGroupByLevelSchema = Schema.Struct(groupByLevelFields).annotations({
  title: 'Data Table Group By Level',
  description: 'One additional grouping level nested inside the level before it',
})

/**
 * Grouping configuration for rows — up to THREE levels deep.
 *
 * The primary level is this object itself; `thenBy` carries up to two more,
 * applied in order, each nested inside the one before it. `groupBy` alone means
 * "group by stage"; `groupBy` + a one-element `thenBy` means "group by stage,
 * then by owner within each stage".
 *
 * ## Why three, and why this shape
 *
 * Three levels is the parity target's limit (one group plus two subgroups), and
 * a limit is worth enforcing: grouping is a reading aid, and a grid nested four
 * deep has more header rows than data rows. `maxItems(2)` says so at validation
 * rather than letting an author discover it from an unreadable grid.
 *
 * The shape is **purely additive** — one optional key on the object that already
 * existed. Two properties follow from that, and both were the reason for choosing
 * it over the alternatives:
 *
 *  1. **Every config that names one field is untouched**, in behaviour and in
 *     type. Nine shipped templates declare `groupBy`; none of them changes.
 *  2. **A consumer that has not yet learned about `thenBy` still groups
 *     correctly** — it reads `field` exactly as before and loses depth, not
 *     grouping. The alternative shapes (widening `field` to `string | string[]`,
 *     or making the property a union of an object and an array) both fail the
 *     other way: a consumer that forgets to normalise reads `.field` off an array,
 *     gets `undefined`, and grouping silently DISAPPEARS. Degrading to today's
 *     correct behaviour beats degrading to nothing.
 *
 * A `then`-chained recursive shape was rejected for a third reason: `Schema.suspend`
 * recursion inflates the decoded type's depth, and this component's config sits
 * inside the union TypeScript already resolves at the edge of its instantiation
 * budget.
 *
 * ## Honoured end to end
 *
 * Every level partitions, orders its own headers, counts across the whole view,
 * summarises and folds independently of the levels around it. Two mechanics
 * follow from nesting and are worth knowing where they live:
 *
 *  - The grid partitions its own rows rather than delegating to the table
 *    library's grouping, which is what lets a level name a field the grid does
 *    not SHOW as a column — the group header is what carries its value.
 *  - All levels ride ONE comma-separated `?groupBy=`, and the response answers
 *    per group PATH. A group's own value stops identifying it the moment two
 *    parents can each hold the same one.
 *
 * @example
 * ```yaml
 * # One level — unchanged.
 * groupBy:
 *   field: status
 *   direction: desc
 *   collapsed: false
 * ```
 *
 * @example
 * ```yaml
 * # Three levels: region, then stage within each region, then owner within each
 * # stage. Each level orders its own headers.
 * groupBy:
 *   field: region
 *   direction: asc
 *   thenBy:
 *     - field: stage
 *       direction: desc
 *     - field: owner
 *       collapsed: true
 * ```
 */
export const DataTableGroupBySchema = Schema.Struct({
  ...groupByLevelFields,
  /**
   * Additional grouping levels, applied in order inside the primary one.
   *
   * Capped at two so the grid never nests deeper than three levels total. The
   * fields named here are cross-checked against the bound table by
   * `validateDataTableColumns`, on the same terms as the primary level: the field
   * must EXIST on the table, and need not be a visible column — grouping by a
   * field you do not show is legitimate, and the group header carries its value.
   */
  thenBy: Schema.optional(
    Schema.Array(DataTableGroupByLevelSchema).pipe(
      Schema.minItems(1, {
        message: () => 'groupBy.thenBy must name at least one field, or be omitted entirely',
      }),
      Schema.maxItems(2, {
        message: () =>
          'groupBy.thenBy accepts at most 2 levels — a data table groups at most 3 levels deep (the primary groupBy plus two nested levels)',
      }),
      Schema.annotations({
        description:
          'Up to 2 additional grouping levels, applied in order inside the primary level (3 levels total)',
      })
    )
  ),
}).annotations({
  title: 'Data Table Group By',
  description: 'Row grouping configuration, up to 3 levels deep',
})

export type DataTableGroupBy = Schema.Schema.Type<typeof DataTableGroupBySchema>
