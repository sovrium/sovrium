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
 * reason. `tableColumns` takes the prefix for the opposite one: a bound grid
 * already has `columns`, whose entries name a `field`, and an authored column
 * names none — one key meaning two shapes would be refused in neither.
 */

import { Schema } from 'effect'

/**
 * How one authored column is drawn, index-aligned with `tableHeaders`.
 *
 * A selector from a wrapper (`[&_td:nth-child(3)]:text-right`) names a position
 * in markup rather than the column the author wrote; this entry sits at the
 * column's own index instead. `align` reaches the header and the body cells — a column of
 * figures is right-aligned top to bottom; `className` reaches the body cells
 * only, since a header row reads in one face whatever its columns carry.
 */
const StaticColumnSchema = Schema.Struct({
  align: Schema.optional(
    Schema.Literals(['left', 'center', 'right']).annotate({
      description: "Alignment of the column's header and body cells (default: left)",
    })
  ),
  className: Schema.optional(
    Schema.String.annotate({
      description:
        "Tailwind classes on every body cell of the column — a mono face for a time, a muted ink for a secondary value. The header cell is styled by the table's `header` part",
      examples: ['font-mono', 'text-foreground-muted'],
    })
  ),
}).annotate({
  title: 'Written Table Column',
  description: 'How one written column is drawn: its alignment and the classes of its body cells',
})

/**
 * Header labels, row cells, a caption and per-column drawing — the whole of a
 * table's static mode.
 *
 * Each is optional on its own: a table with headers and no rows is a legal
 * empty state, and a caption belongs to either mode. What is NOT legal is
 * declaring `tableRows` (or `tableColumns`) beside a `dataSource` — the binding would win and the
 * authored rows would vanish with no symptom, so that pair is refused by name
 * in `component-xor-rules.ts` rather than resolved.
 */
export const staticRowFields = {
  tableHeaders: Schema.optional(
    Schema.Array(Schema.String.annotate({ description: 'One column header label' })).pipe(
      Schema.annotate({ description: 'Column header labels for a table with authored rows' }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  tableRows: Schema.optional(
    Schema.Array(
      Schema.Array(
        Schema.String.annotate({ description: 'One cell, in the order the headers declare' })
      ).annotate({ description: 'One row: one string per column' })
    ).pipe(
      Schema.annotate({
        description: 'Row data as an array of string arrays, written in the config',
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  caption: Schema.optional(
    Schema.String.annotate({ description: 'Caption text displayed above or below the table' })
  ),
  tableColumns: Schema.optional(
    Schema.Array(StaticColumnSchema).pipe(
      Schema.annotate({
        description:
          'How each written column is drawn, in the order the headers declare: its alignment and the classes of its body cells. A shorter list leaves the remaining columns as they are',
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
} as const
