/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * The keys one grouping level carries. Shared by the primary level and every
 * nested `thenBy` level, so the two cannot drift apart.
 */
const groupByLevelFields = {
  field: Schema.String.annotate({
    description: 'Field whose value decides which group a record falls into.',
  }),
  direction: Schema.optional(
    Schema.Literals(['asc', 'desc']).annotate({
      description: 'Order the groups themselves appear in (default: asc).',
    })
  ),
  collapsed: Schema.optional(
    Schema.Boolean.annotate({
      description:
        'Draw this level’s groups closed, showing only their headers and counts, until the reader opens one (default: false).',
    })
  ),
}

const ViewGroupByLevelSchema = Schema.Struct(groupByLevelFields).annotate({
  title: 'View Group By Level',
  description: 'One additional grouping level, nested inside the level before it.',
})

/**
 * View Group By Schema
 *
 * Grouping configuration for the view: up to three levels deep, the primary
 * level plus at most two `thenBy` levels.
 *
 * ─── WHY GROUPING LIVES HERE ──────────────────────────────────────────────
 *
 * Grouping is a way of looking at a table, and a way of looking at a table is
 * configuration declared on the table — never a feature of a page component.
 * The `table` page component carries no `groupBy` of its own; `thenBy` and
 * `collapsed` live here so a grid
 * bound to this view through `dataSource.view` loses nothing. Any data
 * component bound to the view draws the grouping it declares.
 *
 * ─── ONE FIELD PER LEVEL ──────────────────────────────────────────────────
 *
 * No field may appear twice across the levels. Grouping by `stage` and then by
 * `stage` again puts exactly one sub-group inside every group — every record in
 * a group shares the value the group was formed on — so the repeated level
 * partitions nothing. It is always an authoring mistake, and it is refused here
 * rather than silently collapsed.
 *
 * @example
 * ```typescript
 * { field: 'status' }
 * { field: 'category', direction: 'asc' }
 * { field: 'stage', collapsed: true, thenBy: [{ field: 'owner' }] }
 * ```
 */
export const ViewGroupBySchema = Schema.Struct({
  ...groupByLevelFields,
  thenBy: Schema.optional(
    Schema.Array(ViewGroupByLevelSchema).pipe(
      Schema.annotate({
        description:
          'Up to two more grouping levels, applied in order inside the primary one (three levels in all). Each level must group by a different field.',
      }),
      Schema.check(
        Schema.isMinLength(1, {
          message: 'groupBy.thenBy must name at least one field, or be omitted entirely',
        }),
        Schema.isMaxLength(2, {
          message:
            'groupBy.thenBy accepts at most 2 levels — a view groups at most 3 levels deep (the primary groupBy plus two nested levels)',
        })
      )
    )
  ),
}).pipe(
  Schema.annotate({
    title: 'View Group By',
    description:
      'Grouping configuration: the field records are grouped by, optionally followed by up to two nested levels. Every data component bound to the view draws these groups.',
  }),
  Schema.check(
    Schema.makeFilter((groupBy) => {
      const levels = [groupBy.field, ...(groupBy.thenBy ?? []).map((level) => level.field)]
      const repeated = levels.find((field, index) => levels.indexOf(field) !== index)
      return repeated === undefined
        ? true
        : `groupBy: field '${repeated}' is used by more than one grouping level. Each level must group by a different field — a repeated field puts exactly one sub-group inside every group, which partitions nothing.`
    })
  )
)

/** @public */
export type ViewGroupBy = Schema.Schema.Type<typeof ViewGroupBySchema>
