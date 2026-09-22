/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The three keys that make a `table` draw rows the author WROTE rather than
 * records it binds.
 *
 * ## Why they live beside the bound keys rather than in their own type
 *
 * `static-table` was a second component type for the same thing at a smaller
 * size: a header row, some body rows, a caption. Everything that made it a
 * different type was the absence of a binding — and an absence is not a name.
 * So the two merged, and `dataSource` is now what chooses: declare one and the
 * grid island mounts, omit it and these three keys are drawn as a plain
 * server-rendered `<table>`.
 *
 * ## Why the keys keep their `table` prefix
 *
 * `tableHeaders` and `tableRows` read as a stutter on a type called `table`,
 * and shortening them was considered and refused. Renaming a PROPERTY is a
 * second breaking change on top of the type rename, and it is the worse of the
 * two: a retired `type` value gets a named migration from `retired-types.ts`,
 * while a retired property name falls through to the generic excess-property
 * report — there is no per-component key-migration table, and inventing one for
 * two keys would be a mechanism built for its own first user. An author who
 * renames `data-table` to `table` should not also have to guess at `headers`.
 *
 * `caption` carries no prefix and never did; it is left alone for the same
 * reason.
 */

import { Schema } from 'effect'

/**
 * Header labels, row cells and a caption — the whole of a table's static mode.
 *
 * Each is optional on its own: a table with headers and no rows is a legal
 * empty state, and a caption belongs to either mode. What is NOT legal is
 * declaring `tableRows` beside a `dataSource` — the binding would win and the
 * authored rows would vanish with no symptom, so that pair is refused by name
 * in `component-xor-rules.ts` rather than resolved.
 */
export const staticRowFields = {
  tableHeaders: Schema.optional(
    Schema.Array(Schema.String).pipe(
      Schema.check(Schema.isMinLength(1)),
      Schema.annotate({ description: 'Column header labels for a table with authored rows' })
    )
  ),
  tableRows: Schema.optional(
    Schema.Array(Schema.Array(Schema.String)).pipe(
      Schema.check(Schema.isMinLength(1)),
      Schema.annotate({
        description: 'Row data as an array of string arrays, written in the config',
      })
    )
  ),
  caption: Schema.optional(
    Schema.String.annotate({ description: 'Caption text displayed above or below the table' })
  ),
} as const
