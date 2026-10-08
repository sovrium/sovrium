/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionBaseFields } from '../base'
import { DocumentOutputSchema, FileRefSchema } from '../document/shared'
import { pageRangesSchema } from './merge'

/** The page operations, each its own props shape. */
export const PAGE_OPERATIONS = ['delete', 'extract', 'reorder', 'rotate'] as const

/** The quarter turns a page can be rotated by, clockwise. */
export const PAGE_ROTATIONS = [90, 180, 270] as const

const fileProp = FileRefSchema

const operationLiteral = <const O extends (typeof PAGE_OPERATIONS)[number]>(
  operation: O,
  description: string
) => Schema.Literal(operation).pipe(Schema.annotate({ description }))

const DeletePagesSchema = Schema.Struct({
  file: fileProp,
  operation: operationLiteral('delete', 'Remove the listed pages; the others keep their order'),
  pages: pageRangesSchema({
    description: "The pages to remove (e.g. '2,5-6'); at least one must stay",
  }),
  output: DocumentOutputSchema,
}).pipe(Schema.annotate({ title: 'Delete pages' }))

const ExtractPagesSchema = Schema.Struct({
  file: fileProp,
  operation: operationLiteral('extract', 'Keep only the listed pages, in the order listed'),
  pages: pageRangesSchema({ description: "The pages to keep, in the order listed (e.g. '3,1-2')" }),
  output: DocumentOutputSchema,
}).pipe(Schema.annotate({ title: 'Extract pages' }))

const ReorderPagesSchema = Schema.Struct({
  file: fileProp,
  operation: operationLiteral(
    'reorder',
    'Put every page in a new order; the order must name each page exactly once'
  ),
  pages: pageRangesSchema({
    description:
      "The new order, naming every page exactly once (e.g. '3,1-2' for a three-page file)",
  }),
  output: DocumentOutputSchema,
}).pipe(Schema.annotate({ title: 'Reorder pages' }))

const RotatePagesSchema = Schema.Struct({
  file: fileProp,
  operation: operationLiteral(
    'rotate',
    "Turn pages clockwise by `angle`, added to each page's current rotation"
  ),
  angle: Schema.Literals(PAGE_ROTATIONS).pipe(
    Schema.annotate({
      description:
        "Degrees clockwise: 90, 180 or 270, added to the page's current rotation (a page already at 90 turned by 270 ends upright)",
    })
  ),
  pages: Schema.optional(
    pageRangesSchema({ defaultNote: 'every page', description: "The pages to turn (e.g. '2-3')" })
  ),
  output: DocumentOutputSchema,
}).pipe(Schema.annotate({ title: 'Rotate pages' }))

/**
 * PDF Pages Action (type: pdf, operator: pages)
 *
 * One operator for the four page operations, told apart by `operation`:
 * `delete`, `extract`, `reorder` and `rotate`. A range beyond the end of the
 * file fails the step naming the range and the page count; so does a
 * `reorder` that misses or repeats a page, and a `delete` of every page.
 */
export const PdfPagesActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('pdf').pipe(
    Schema.annotate({
      description: "Constant value 'pdf' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('pages').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'pdf' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Union([
    DeletePagesSchema,
    ExtractPagesSchema,
    ReorderPagesSchema,
    RotatePagesSchema,
  ]).pipe(
    Schema.annotate({
      description:
        'The PDF, the page operation — delete, extract, reorder or rotate — the pages it applies to, and where the result is written.',
    })
  ),
}).pipe(
  Schema.annotate({
    identifier: 'PdfPagesAction',
    title: 'PDF Pages Action',
    description: 'Delete, extract, reorder or rotate the pages of a PDF',
  })
)

/** @public */
export type PdfPagesAction = Schema.Schema.Type<typeof PdfPagesActionSchema>
