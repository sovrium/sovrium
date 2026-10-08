/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionBaseFields } from '../base'
import { DocumentOutputSchema, FileRefSchema, fileRefListSchema } from '../document/shared'

/**
 * A page selection: a comma list of 1-based pages and ranges, in the order the
 * pages are taken — `'3'`, `'1-3'`, `'5-'` (to the end), `'3,1-2'` — or one
 * template resolving to such a list at run time (`'{{trigger.data.pages}}'`),
 * which the step checks the same way once it is resolved.
 */
const PAGE_RANGES_PATTERN =
  /^(?:[1-9]\d*(?:-(?:[1-9]\d*)?)?(?:,[1-9]\d*(?:-(?:[1-9]\d*)?)?)*|\{\{[^{}]+\}\})$/

/**
 * A page-selection prop with its own sentence (and default), written on the
 * node BEFORE the pattern check so it reaches the published schema.
 */
export const pageRangesSchema = (annotations: {
  readonly description: string
  readonly defaultNote?: string
}) =>
  Schema.String.pipe(
    Schema.annotate(annotations),
    Schema.check(
      Schema.isPattern(PAGE_RANGES_PATTERN, {
        message:
          "pages must be a comma list of 1-based pages and ranges, e.g. '1-3', '5-' or '3,1-2', or one {{template}}",
      })
    )
  )

export const PageRangesSchema = pageRangesSchema({
  description:
    "Pages to take, 1-based, in order: a comma list of pages and ranges such as '3', '1-3', '5-' (to the end) or '3,1-2', or one template resolving to such a list at run time",
})

/** One merge input: a file reference, or `{ file, pages }` to take some of its pages. */
const MergeInputSchema = Schema.Union([
  FileRefSchema,
  Schema.Struct({
    file: FileRefSchema,
    pages: Schema.optional(PageRangesSchema),
  }).pipe(Schema.annotate({ description: 'A file and the pages to take from it' })),
])

/**
 * PDF Merge Action (type: pdf, operator: merge)
 *
 * Join PDFs into one, in the declared order, inside the binary — no engine is
 * needed. An input that is not a PDF fails the step naming its position; a
 * range beyond its input's end fails naming the range.
 */
export const PdfMergeActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('pdf').pipe(
    Schema.annotate({
      description: "Constant value 'pdf' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('merge').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'pdf' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    inputs: fileRefListSchema(MergeInputSchema).pipe(
      Schema.annotate({
        description:
          'The PDFs to merge, in order: a list of file references (or { file, pages }), or one template resolving to such a list at run time. At most 100 inputs, and the pages taken from them all are held to RENDERER_MAX_PAGES',
      })
    ),
    output: DocumentOutputSchema,
  }).pipe(
    Schema.annotate({
      description: 'The PDFs to merge, in order, and where the result is written.',
    })
  ),
}).pipe(
  Schema.annotate({
    identifier: 'PdfMergeAction',
    title: 'PDF Merge Action',
    description: 'Merge PDFs, or chosen pages of them, into one PDF',
  })
)

/** @public */
export type PdfMergeAction = Schema.Schema.Type<typeof PdfMergeActionSchema>
