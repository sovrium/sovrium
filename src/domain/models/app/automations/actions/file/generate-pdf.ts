/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'
import { DestinationPropSchema } from './shared'

export const FileGeneratePdfActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('file'),
  operator: Schema.Literal('generatePdf'),
  props: Schema.Struct({
    template: TemplateStringSchema.pipe(
      Schema.annotations({
        description: 'HTML template for PDF content (supports template variables)',
      })
    ),

    filename: TemplateStringSchema.pipe(
      Schema.annotations({
        description: 'Output filename (e.g., "invoice-{{trigger.data.id}}.pdf")',
      })
    ),

    data: Schema.optional(
      Schema.Record({ key: Schema.String, value: Schema.Unknown }).pipe(
        Schema.annotations({
          description: 'Additional data context for template rendering',
        })
      )
    ),

    pageSize: Schema.optional(
      Schema.Literal('A4', 'A3', 'Letter', 'Legal').pipe(
        Schema.annotations({ description: 'Page size (default: A4)' })
      )
    ),

    orientation: Schema.optional(
      Schema.Literal('portrait', 'landscape').pipe(
        Schema.annotations({ description: 'Page orientation (default: portrait)' })
      )
    ),

    margins: Schema.optional(
      Schema.Struct({
        top: Schema.optional(
          Schema.String.pipe(
            Schema.annotations({ description: 'Top margin (e.g., "1cm", "0.5in")' })
          )
        ),
        right: Schema.optional(
          Schema.String.pipe(Schema.annotations({ description: 'Right margin' }))
        ),
        bottom: Schema.optional(
          Schema.String.pipe(Schema.annotations({ description: 'Bottom margin' }))
        ),
        left: Schema.optional(
          Schema.String.pipe(Schema.annotations({ description: 'Left margin' }))
        ),
      }).pipe(Schema.annotations({ description: 'Page margins' }))
    ),

    destination: DestinationPropSchema,
  }),
}).pipe(
  Schema.annotations({
    identifier: 'FileGeneratePdfAction',
    title: 'File Generate PDF Action',
    description: 'Generate a PDF document from an HTML template',
  })
)

export type FileGeneratePdfAction = Schema.Schema.Type<typeof FileGeneratePdfActionSchema>
