/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'
import { DocumentOutputSchema, FileRefSchema } from '../document/shared'
import { pageRangesSchema } from './merge'
import {
  PagePointSchema,
  fontSizeSchema,
  hexColorSchema,
  imageWidthSchema,
  marginSchema,
  markAngleSchema,
  opacitySchema,
  pageAnchorSchema,
} from './placement'

/**
 * Page numbers: a format whose `{n}` and `{total}` are filled page by page.
 *
 * Single braces on purpose: `{{…}}` is the run's template syntax and is
 * resolved once, before the step runs, so it cannot carry a value that
 * changes from page to page.
 */
const PageNumbersSchema = Schema.Struct({
  format: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        defaultNote: "'{n}'",
        description:
          "Text of each page number: {n} is the page's number and {total} the number the last numbered page carries (e.g. '{n}/{total}', 'Page {n} of {total}')",
      })
    )
  ),
  startAt: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        defaultNote: 'the position of the first numbered page in the file',
        description:
          "Number the first numbered page carries; with `pages: '2-'` and `startAt: 1`, the page after the cover reads 1",
      }),
      Schema.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0))
    )
  ),
}).pipe(
  Schema.annotate({
    description:
      'Number the pages: one number per page listed in `pages`, drawn where `position` says (bottom-center unless told otherwise)',
  })
)

/** Exactly one of the three marks a stamp can carry. */
const markCount = (props: {
  readonly text?: unknown
  readonly image?: unknown
  readonly pageNumbers?: unknown
}): number =>
  [props.text, props.image, props.pageNumbers].filter((mark) => mark !== undefined).length

/**
 * PDF Stamp Action (type: pdf, operator: stamp)
 *
 * Place one mark at a precise spot of chosen pages: a line of text (a date, a
 * reference, "Paid"), an image (a logo, the picture of a handwritten
 * signature) or page numbers. Solid and upright unless told otherwise. A
 * signature image is a picture on the page, not a cryptographic signature.
 */
export const PdfStampActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('pdf').pipe(
    Schema.annotate({
      description: "Constant value 'pdf' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('stamp').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'pdf' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    file: FileRefSchema,
    text: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          description:
            "The text to stamp, drawn as written (supports template variables, e.g. 'Received {{trigger.data.receivedOn}}')",
        })
      )
    ),
    image: Schema.optional(FileRefSchema),
    pageNumbers: Schema.optional(PageNumbersSchema),
    position: Schema.optional(pageAnchorSchema('bottom-right; bottom-center for pageNumbers')),
    at: Schema.optional(PagePointSchema),
    margin: Schema.optional(marginSchema('36 (half an inch)')),
    fontSize: Schema.optional(fontSizeSchema('12')),
    color: Schema.optional(hexColorSchema('#000000')),
    opacity: Schema.optional(opacitySchema('1')),
    angle: Schema.optional(markAngleSchema('0')),
    width: Schema.optional(imageWidthSchema("the image's own width in pixels, read as points")),
    pages: Schema.optional(
      pageRangesSchema({
        defaultNote: 'every page',
        description: "The pages to stamp (e.g. '3' for the signature page, '2-' after a cover)",
      })
    ),
    output: DocumentOutputSchema,
  })
    .annotate({
      description:
        'The PDF, the mark — `text`, `image` (a file reference: a logo or a signature picture) or `pageNumbers` — where it goes (`position` or `at`), how it is drawn, the pages it goes on, and where the result is written.',
    })
    .pipe(
      Schema.check(
        Schema.makeFilter((props) => markCount(props) === 1, {
          message: 'stamp takes exactly one of `text`, `image` or `pageNumbers`',
        }),
        Schema.makeFilter((props) => props.position === undefined || props.at === undefined, {
          message: 'stamp takes `position` or `at`, not both',
        })
      )
    ),
}).pipe(
  Schema.annotate({
    identifier: 'PdfStampAction',
    title: 'PDF Stamp Action',
    description:
      'Stamp text, an image (a logo or a signature picture) or page numbers at a chosen spot of chosen pages of a PDF',
  })
)

/** @public */
export type PdfStampAction = Schema.Schema.Type<typeof PdfStampActionSchema>
