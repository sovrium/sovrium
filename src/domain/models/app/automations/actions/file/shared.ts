/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'

export const FileActionResultSchema = Schema.Struct({
  key: Schema.String.pipe(Schema.annotations({ description: 'Storage key identifying the file' })),

  filename: Schema.String.pipe(
    Schema.annotations({ description: 'Original or generated filename' })
  ),

  contentType: Schema.String.pipe(
    Schema.annotations({ description: 'MIME content type (e.g., "application/pdf")' })
  ),

  size: Schema.Number.pipe(Schema.annotations({ description: 'File size in bytes' })),

  signedUrl: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({ description: 'Signed URL for direct file access (S3 only)' })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'FileActionResult',
    title: 'File Action Result',
    description: 'Standard result shape for all file actions',
  })
)

export type FileActionResult = Schema.Schema.Type<typeof FileActionResultSchema>

export const DestinationPropSchema = Schema.optional(
  TemplateStringSchema.pipe(
    Schema.annotations({
      description:
        'Storage key for the output file. If omitted, file is stored in temporary storage and auto-cleaned after STORAGE_TEMP_CLEANUP_AFTER (default: 24 hours).',
    })
  )
)

export const TEMP_STORAGE_PREFIX = 'tmp/automations/'
