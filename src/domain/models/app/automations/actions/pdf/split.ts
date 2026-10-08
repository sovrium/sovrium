/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionBaseFields } from '../base'
import { DocumentOutputSchema, DocumentResultSchema, FileRefSchema } from '../document/shared'
import { PageRangesSchema } from './merge'

/**
 * PDF Split Action (type: pdf, operator: split)
 *
 * Cut one PDF into several, inside the binary. Exactly one way of cutting:
 * `ranges` (one file per selection), `every` (one file per N pages), or
 * neither (one file per page). The output `filename` and `key` take `{n}`, the
 * part number from 1; without it, `-{n}` goes before the extension.
 */
export const PdfSplitActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('pdf').pipe(
    Schema.annotate({
      description: "Constant value 'pdf' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('split').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'pdf' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    file: FileRefSchema,
    ranges: Schema.optional(
      Schema.Array(PageRangesSchema).pipe(
        Schema.annotate({
          description:
            "One output file per item, holding that item's pages in its order (e.g. ['1-2', '3-5', '6-'])",
        }),
        Schema.check(Schema.isMinLength(1))
      )
    ),
    every: Schema.optional(
      Schema.Finite.pipe(
        Schema.annotate({
          description:
            'One output file per this many pages, in order; the last file holds what is left',
        }),
        Schema.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(1))
      )
    ),
    output: DocumentOutputSchema,
  })
    .annotate({
      description:
        "The PDF to split, how to cut it — `ranges`, `every`, or neither for one file per page — and where the parts are written. `{n}` in the output `filename` or `key` is the part number from 1; without it, '-{n}' goes before the extension ('invoice.pdf' → 'invoice-1.pdf').",
    })
    .pipe(
      Schema.check(
        Schema.makeFilter((props) => props.ranges === undefined || props.every === undefined, {
          message: 'split takes `ranges` or `every`, not both; give neither for one file per page',
        })
      )
    ),
}).pipe(
  Schema.annotate({
    identifier: 'PdfSplitAction',
    title: 'PDF Split Action',
    description: 'Split a PDF into several: by page ranges, every N pages, or one file per page',
  })
)

/** @public */
export type PdfSplitAction = Schema.Schema.Type<typeof PdfSplitActionSchema>

/**
 * What `pdf/split` returns: every part it wrote, in order. A later step takes
 * the list as `'{{steps.<name>.files}}'` — a loop over it, or `pdf/merge`.
 *
 * @public
 */
export const PdfSplitResultSchema = Schema.Struct({
  files: Schema.Array(DocumentResultSchema).pipe(
    Schema.annotate({ description: 'The parts, in order, each with its page count' })
  ),
  count: Schema.Finite.pipe(Schema.annotate({ description: 'How many parts were written' })),
}).pipe(
  Schema.annotate({
    identifier: 'PdfSplitResult',
    title: 'PDF Split Result',
    description: 'What a pdf/split step returns',
  })
)

/** @public */
export type PdfSplitResult = Schema.Schema.Type<typeof PdfSplitResultSchema>
