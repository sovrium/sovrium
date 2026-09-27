/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { MAX_PAGE_SIZE } from '@/domain/kernel/sql/page-window'

/**
 * A page size at or below the rows per page the records API serves.
 *
 * The API REFUSES a larger `limit` rather than clamping it, so a page size above
 * the ceiling validates, boots, renders its option — and fails the moment a
 * reader picks it. Refusing it here tells the author instead, naming the number
 * they wrote and the one they may use. The message is built per value, which
 * is why this is a filter of its own rather than a bare `isLessThanOrEqualTo`;
 * it still publishes `maximum` into the JSON Schema.
 *
 * @param label how the message names the key (`pageSize`, `pageSizeOptions entry`)
 */
export const isWithinPageWindow = (label: string) =>
  Schema.makeFilter<number>(
    (size) =>
      size <= MAX_PAGE_SIZE ||
      `${label} ${size} is above the ${MAX_PAGE_SIZE} rows per page the records API serves; use ${MAX_PAGE_SIZE} or fewer`,
    {
      expected: `a page size of at most ${MAX_PAGE_SIZE}`,
      toJsonSchema: () => ({ maximum: MAX_PAGE_SIZE }),
    }
  )

/**
 * Data table pagination with UI-specific options.
 *
 * @example
 * ```yaml
 * pagination:
 *   pageSize: 25
 *   pageSizeOptions: [10, 25, 50]
 *   position: bottom
 * ```
 */
export const DataTablePaginationSchema = Schema.Struct({
  /** Default rows per page */
  pageSize: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        description: `Default rows per page (default: 25, at most ${MAX_PAGE_SIZE} — the rows per page the records API serves)`,
        examples: [10, 25, 50],
      }),
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0), isWithinPageWindow('pageSize'))
    )
  ),
  /** Dropdown options for page size */
  pageSizeOptions: Schema.optional(
    Schema.Array(
      Schema.Finite.annotate({
        description: `One page size offered in the dropdown, at most ${MAX_PAGE_SIZE}`,
      }).pipe(
        Schema.check(
          Schema.isInt(),
          Schema.isGreaterThan(0),
          isWithinPageWindow('pageSizeOptions entry')
        )
      )
    ).pipe(
      Schema.annotate({
        description: 'Page size dropdown options',
        examples: [[10, 25, 50, 100]],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  /** Position of pagination controls */
  position: Schema.optional(
    Schema.Literals(['top', 'bottom', 'both']).annotate({
      description: 'Position of pagination controls (default: bottom)',
    })
  ),
  /**
   * How the reader reaches the rows past the first page. `numbered` (the
   * default) draws page controls; `loadMore` appends the next page under the
   * rows and draws no page-size selector. There is deliberately no "show all":
   * one request is capped at the rows per page the records API serves.
   */
  style: Schema.optional(
    Schema.Literals(['numbered', 'loadMore']).annotate({
      description:
        '`numbered` (default) shows page controls; `loadMore` appends the next page under the rows and hides the page-size selector.',
    })
  ),
  /** Enable server-side pagination */
  serverSide: Schema.optional(
    Schema.Boolean.annotate({
      description: 'Enable server-side pagination (default: false)',
    })
  ),
}).annotate({
  title: 'Data Table Pagination',
  description: 'Pagination configuration for the data table',
})

export type DataTablePagination = Schema.Schema.Type<typeof DataTablePaginationSchema>
