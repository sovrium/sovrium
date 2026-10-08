/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionBaseFields } from '../base'
import { FileRefSchema } from '../document/shared'

/**
 * PDF Inspect Action (type: pdf, operator: inspect)
 *
 * Read what a PDF holds — pages, sizes, metadata, encryption, form fields —
 * and write nothing. A later step branches on it: an encrypted upload is
 * refused politely, a form is filled with the fields it really has.
 */
export const PdfInspectActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('pdf').pipe(
    Schema.annotate({
      description: "Constant value 'pdf' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('inspect').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'pdf' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    file: FileRefSchema,
  }).pipe(Schema.annotate({ description: '`file` is the PDF to read. Nothing is written.' })),
}).pipe(
  Schema.annotate({
    identifier: 'PdfInspectAction',
    title: 'PDF Inspect Action',
    description: 'Read the page count, page sizes, metadata, encryption and form fields of a PDF',
  })
)

/** @public */
export type PdfInspectAction = Schema.Schema.Type<typeof PdfInspectActionSchema>

/** The kinds of form field a PDF can hold. */
export const PDF_FORM_FIELD_TYPES = [
  'text',
  'checkbox',
  'radio',
  'dropdown',
  'list',
  'button',
  'signature',
] as const

const optionalText = (description: string) =>
  Schema.optional(Schema.String.pipe(Schema.annotate({ description })))

/**
 * What `pdf/inspect` returns. `encrypted` is reported, never a failure: an
 * encrypted file still reports its page count, and its form fields as empty.
 *
 * @public
 */
export const PdfInspectResultSchema = Schema.Struct({
  pages: Schema.Finite.pipe(Schema.annotate({ description: 'Page count' })),
  pageSizes: Schema.Array(
    Schema.Struct({
      width: Schema.Finite.pipe(Schema.annotate({ description: 'Width in points' })),
      height: Schema.Finite.pipe(Schema.annotate({ description: 'Height in points' })),
      rotation: Schema.Finite.pipe(
        Schema.annotate({
          description: 'Rotation the page is shown at, clockwise: 0, 90, 180 or 270',
        })
      ),
    })
  ).pipe(Schema.annotate({ description: "Each page's size, in order" })),
  metadata: Schema.Struct({
    title: optionalText('Document title'),
    author: optionalText('Author'),
    subject: optionalText('Subject'),
    keywords: optionalText('Keywords'),
    creator: optionalText('Application the document was written in'),
    producer: optionalText('Application that produced the PDF'),
    creationDate: optionalText('Creation date, ISO 8601'),
    modificationDate: optionalText('Last modification date, ISO 8601'),
  }).pipe(Schema.annotate({ description: 'The document information the file declares' })),
  encrypted: Schema.Boolean.pipe(
    Schema.annotate({ description: 'Whether the file is password-protected or encrypted' })
  ),
  formFields: Schema.Array(
    Schema.Struct({
      name: Schema.String.pipe(Schema.annotate({ description: 'Full name of the field' })),
      type: Schema.Literals(PDF_FORM_FIELD_TYPES).pipe(
        Schema.annotate({ description: 'Kind of field' })
      ),
      value: Schema.optional(
        Schema.Union([Schema.String, Schema.Boolean, Schema.Array(Schema.String)]).pipe(
          Schema.annotate({ description: 'Current value, when the field has one' })
        )
      ),
      options: Schema.optional(
        Schema.Array(Schema.String).pipe(
          Schema.annotate({ description: 'The choices of a radio group, a dropdown or a list' })
        )
      ),
    })
  ).pipe(Schema.annotate({ description: 'The form fields, empty for a PDF with no form' })),
}).pipe(
  Schema.annotate({
    identifier: 'PdfInspectResult',
    title: 'PDF Inspect Result',
    description: 'What a pdf/inspect step returns',
  })
)

/** @public */
export type PdfInspectResult = Schema.Schema.Type<typeof PdfInspectResultSchema>
