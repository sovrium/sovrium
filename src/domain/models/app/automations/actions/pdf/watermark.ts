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
  fontSizeSchema,
  hexColorSchema,
  imageWidthSchema,
  markAngleSchema,
  opacitySchema,
  pageAnchorSchema,
} from './placement'

/**
 * PDF Watermark Action (type: pdf, operator: watermark)
 *
 * Draw one translucent mark — a line of text or an image — across the pages
 * of a PDF, over their content: centred, at 45 degrees, at 30 % opacity
 * unless told otherwise. Exactly one of `text` and `image`.
 */
export const PdfWatermarkActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('pdf').pipe(
    Schema.annotate({
      description: "Constant value 'pdf' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('watermark').pipe(
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
            "The watermark text (supports template variables, e.g. 'COPY — {{trigger.data.client}}')",
        })
      )
    ),
    image: Schema.optional(FileRefSchema),
    opacity: Schema.optional(opacitySchema('0.3')),
    angle: Schema.optional(markAngleSchema('45 for text, 0 for an image')),
    position: Schema.optional(pageAnchorSchema('center')),
    fontSize: Schema.optional(fontSizeSchema('48')),
    color: Schema.optional(hexColorSchema('#808080')),
    width: Schema.optional(imageWidthSchema('half the page width')),
    pages: Schema.optional(
      pageRangesSchema({
        defaultNote: 'every page',
        description: "The pages to watermark (e.g. '2-')",
      })
    ),
    output: DocumentOutputSchema,
  })
    .annotate({
      description:
        'The PDF, the mark — `text` or `image` — how it is drawn, the pages it goes on, and where the result is written.',
    })
    .pipe(
      Schema.check(
        Schema.makeFilter((props) => (props.text === undefined) !== (props.image === undefined), {
          message: 'watermark takes exactly one of `text` or `image`',
        })
      )
    ),
}).pipe(
  Schema.annotate({
    identifier: 'PdfWatermarkAction',
    title: 'PDF Watermark Action',
    description: 'Draw a translucent text or image watermark across the pages of a PDF',
  })
)

/** @public */
export type PdfWatermarkAction = Schema.Schema.Type<typeof PdfWatermarkActionSchema>
