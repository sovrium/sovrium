/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

export const FileExtractTextActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('file'),
  operator: Schema.Literal('extractText'),
  props: Schema.Struct({
    key: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotations({
          description: 'Storage key of the file to extract text from',
        })
      )
    ),

    source: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotations({
          description: 'Storage key of the file to extract text from',
        })
      )
    ),

    format: Schema.optional(
      Schema.Literal('plain', 'markdown').pipe(
        Schema.annotations({
          description: 'Output text format (default: plain)',
        })
      )
    ),
  }).pipe(
    Schema.filter((props) => (props.key ?? props.source) !== undefined, {
      message: () => 'extractText requires `key` (or `source`)',
    })
  ),
}).pipe(
  Schema.annotations({
    identifier: 'FileExtractTextAction',
    title: 'File Extract Text Action',
    description: 'Extract plain text content from PDF, DOCX, or HTML files',
  })
)

export type FileExtractTextAction = Schema.Schema.Type<typeof FileExtractTextActionSchema>
