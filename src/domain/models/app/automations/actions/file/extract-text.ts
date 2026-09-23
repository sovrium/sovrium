/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

/**
 * File Extract Text Action (type: file, operator: extractText)
 *
 * Extract plain text content from PDF, DOCX, or HTML files.
 * The extracted text is available as the step output for subsequent actions.
 */
export const FileExtractTextActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('file').pipe(
    Schema.annotate({
      description: "Constant value 'file' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('extractText').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'file' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    /** Storage key of the file to extract text from */
    key: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          description: 'Storage key of the file to extract text from',
        })
      )
    ),

    /** Storage key of the file to extract text from (alias of `key`) */
    source: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          description: 'Storage key of the file to extract text from',
        })
      )
    ),

    /** Output text format */
    format: Schema.optional(
      Schema.Literals(['plain', 'markdown']).pipe(
        Schema.annotate({
          description: 'Output text format (default: plain)',
        })
      )
    ),
  })
    .annotate({
      description: 'The file to read text out of, and the format the text is returned in.',
    })
    .pipe(
      Schema.check(
        Schema.makeFilter((props) => (props.key ?? props.source) !== undefined, {
          message: 'extractText requires `key` (or `source`)',
        })
      )
    ),
}).pipe(
  Schema.annotate({
    identifier: 'FileExtractTextAction',
    title: 'File Extract Text Action',
    description: 'Extract plain text content from PDF, DOCX, or HTML files',
  })
)

/** @public */
export type FileExtractTextAction = Schema.Schema.Type<typeof FileExtractTextActionSchema>
