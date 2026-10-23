/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { DataFilterSchema, ViewerRowLookupSchema } from './components/data-source'

/**
 * `pages[].collection` — a template page that generates one route per record
 * of a table.
 *
 * The `slugField` names the field mapped to the dynamic URL parameter, and
 * `$record.*` becomes available in every component, in `meta` and in
 * children. `$collection.previous` and `$collection.next` name the records on
 * either side in the collection's order — within the record's `scope` when one
 * is declared — and `$collection.resume`, with `resume`, the first record of
 * that scope the reader has no row for.
 *
 * @example
 * ```yaml
 * path: /lessons/:slug
 * collection:
 *   table: lessons
 *   slugField: slug
 *   filter: [{ field: status, operator: eq, value: published }]
 *   scope: course
 *   resume: { table: completions, link: lesson, user: member }
 * ```
 */
export const PageCollectionSchema = Schema.Struct({
  /** Table name to generate pages from (must exist in app.tables) */
  table: Schema.String.annotate({
    description: 'Table name to generate collection pages from',
  }),
  /** Field name whose value becomes the URL parameter */
  slugField: Schema.String.annotate({
    description: 'Field used as the URL slug parameter',
  }),
  /** Optional filter to limit which records generate pages */
  filter: Schema.optional(
    Schema.Array(DataFilterSchema).annotate({
      description: 'Filter conditions to limit which records generate pages',
    })
  ),
  /**
   * Keep `$collection.previous` / `$collection.next` (and `resume`) among
   * the records sharing the current record's value of this field: a
   * lesson's neighbours stay in its course, and the last lesson of a course
   * has no next rather than one pointing into another course.
   */
  scope: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          "Field whose value the current record shares with its neighbours: `$collection.previous`, `$collection.next` and `$collection.resume` stay among the records with the same value (a lesson's course). Without it they range over the whole collection",
        examples: ['course', 'section'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  /**
   * Expose `$collection.resume`: the first record, in the collection's
   * order and within `scope`, that has no row of `table` for the reader —
   * the first lesson she has not completed. Empty when every record has one.
   */
  resume: Schema.optional(
    ViewerRowLookupSchema.annotate({
      description:
        "Exposes `$collection.resume`, the first record in the collection's order (within `scope`) for which the reader has no row of `table`: the first lesson she has not completed. Empty when she has a row for every record, and records she may not read are skipped",
    })
  ),
}).annotate({
  identifier: 'PageCollection',
  title: 'Page Collection',
  description: 'Template page configuration that generates one route per table record',
})

/** @public */
export type PageCollection = Schema.Schema.Type<typeof PageCollectionSchema>
