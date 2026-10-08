/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionBaseFields } from '../base'
import { DocumentOutputSchema, FileRefSchema } from './shared'

/**
 * The file types `document/convert` turns into a PDF, grouped by who converts
 * them.
 *
 * @public
 */
export const CONVERT_OFFICE_TYPES = ['docx', 'xlsx', 'pptx', 'odt', 'ods', 'odp'] as const

/** @public */
export const CONVERT_INPUT_TYPES = [...CONVERT_OFFICE_TYPES, 'html', 'image'] as const

/** @public */
export type ConvertInputType = (typeof CONVERT_INPUT_TYPES)[number]

/**
 * Document Convert Action (type: document, operator: convert)
 *
 * Turn an existing file into a PDF. Nothing is templated: the file is
 * converted as it is.
 *
 * - **Office files** (`docx`, `xlsx`, `pptx`, `odt`, `ods`, `odp`) go to the
 *   office engine (`OFFICE_*`): Gotenberg's LibreOffice route on a server, a
 *   user-installed LibreOffice (`soffice`) on the desktop app. Before the file
 *   leaves Sovrium, its external links and fetching field codes are removed,
 *   and it travels under a fixed name of Sovrium's carrying only its
 *   extension, so the converter is never asked to fetch anything and never
 *   sees the name it was stored under. RTF is not accepted: it has no package
 *   boundary to clean against.
 * - **HTML** goes to the browser engine (`RENDERER_*`), in the render sandbox
 *   of every HTML render (scripts off, sub-resources from `assets` and `data:`
 *   only).
 * - **Images** (PNG, JPEG, WebP) become one page each, exactly as
 *   `pdf/fromImages` lays them out with its defaults; no engine is needed.
 *
 * The type comes from `inputType` when set, else from the stored content type,
 * else from the file name's extension. With the needed engine off the step
 * fails with `office_unavailable` or `renderer_unavailable`, naming the
 * variable to set.
 */
export const DocumentConvertActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('document').pipe(
    Schema.annotate({
      description: "Constant value 'document' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('convert').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'document' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    input: FileRefSchema,
    inputType: Schema.optional(
      Schema.Literals(CONVERT_INPUT_TYPES).pipe(
        Schema.annotate({
          description:
            "What the input is: docx, xlsx, pptx, odt, ods or odp (converted by the office engine), html (by the browser engine) or image (laid out in the binary). Omit it to take the type from the stored content type, then from the file name's extension.",
        })
      )
    ),
    output: DocumentOutputSchema,
  }).pipe(
    Schema.annotate({
      description:
        'The file to convert, its type when the name does not say, and where the PDF is written.',
    })
  ),
}).pipe(
  Schema.annotate({
    identifier: 'DocumentConvertAction',
    title: 'Document Convert Action',
    description: 'Convert a Word, Excel, PowerPoint, OpenDocument, HTML or image file into a PDF',
  })
)

/** @public */
export type DocumentConvertAction = Schema.Schema.Type<typeof DocumentConvertActionSchema>
