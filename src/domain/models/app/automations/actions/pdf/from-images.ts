/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionBaseFields } from '../base'
import { DocumentOutputSchema, FileRefSchema, fileRefListSchema } from '../document/shared'

/** The page sizes a picture can be laid on, plus `image`: the picture's own size. */
export const FROM_IMAGES_PAGE_SIZES = ['A4', 'A3', 'A5', 'Letter', 'Legal', 'image'] as const

/**
 * PDF From Images Action (type: pdf, operator: fromImages)
 *
 * One page per picture, in order — a JPEG, a PNG or a WebP (converted on the
 * way in) — inside the binary. Scanned receipts, site photos and signed paper
 * forms become one PDF a person can file.
 */
export const PdfFromImagesActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('pdf').pipe(
    Schema.annotate({
      description: "Constant value 'pdf' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('fromImages').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'pdf' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    images: fileRefListSchema(FileRefSchema).pipe(
      Schema.annotate({
        description:
          'The pictures, one page each, in order: a list of file references, or one template resolving to such a list at run time',
      })
    ),
    pageSize: Schema.optional(
      Schema.Literals(FROM_IMAGES_PAGE_SIZES).pipe(
        Schema.annotate({
          defaultNote: 'A4',
          description:
            "Size of each page; 'image' makes each page exactly the size of its picture, one pixel to one point",
        })
      )
    ),
    orientation: Schema.optional(
      Schema.Literals(['auto', 'portrait', 'landscape']).pipe(
        Schema.annotate({
          defaultNote: 'auto',
          description:
            "Orientation of each page; 'auto' turns the page to match its picture (a wide picture gets a landscape page). Ignored with pageSize 'image'.",
        })
      )
    ),
    fit: Schema.optional(
      Schema.Literals(['contain', 'cover', 'stretch']).pipe(
        Schema.annotate({
          defaultNote: 'contain',
          description:
            "How the picture fills the area inside the margin: 'contain' shows all of it, centred, proportions kept; 'cover' fills the area, proportions kept, the overflow cut off; 'stretch' fills it exactly, proportions not kept",
        })
      )
    ),
    margin: Schema.optional(
      Schema.Finite.pipe(
        Schema.annotate({
          defaultNote: '0',
          description: 'Points of blank page kept around the picture on every side',
        }),
        Schema.check(Schema.isGreaterThanOrEqualTo(0))
      )
    ),
    output: DocumentOutputSchema,
  }).pipe(
    Schema.annotate({
      description:
        'The pictures, the page they are laid on, how they fill it, and where the PDF is written.',
    })
  ),
}).pipe(
  Schema.annotate({
    identifier: 'PdfFromImagesAction',
    title: 'PDF From Images Action',
    description: 'Make a PDF of JPEG, PNG or WebP pictures, one page each',
  })
)

/** @public */
export type PdfFromImagesAction = Schema.Schema.Type<typeof PdfFromImagesActionSchema>
