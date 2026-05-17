/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'

/**
 * Shared file action result schema.
 *
 * All file actions return this shape in {{steps.actionName.result}}.
 * Storage key is the primary identifier — binary data flows between
 * steps via keys, not in-memory buffers.
 */
export const FileActionResultSchema = Schema.Struct({
  /** Storage key identifying the file */
  key: Schema.String.pipe(Schema.annotations({ description: 'Storage key identifying the file' })),

  /** Original or generated filename */
  filename: Schema.String.pipe(
    Schema.annotations({ description: 'Original or generated filename' })
  ),

  /** MIME content type */
  contentType: Schema.String.pipe(
    Schema.annotations({ description: 'MIME content type (e.g., "application/pdf")' })
  ),

  /** File size in bytes */
  size: Schema.Number.pipe(Schema.annotations({ description: 'File size in bytes' })),

  /** Signed URL for direct access (populated when storage supports it) */
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

/** @public */
export type FileActionResult = Schema.Schema.Type<typeof FileActionResultSchema>

/**
 * Optional destination prop for file generation/transformation actions.
 *
 * When set, the file is stored at the specified storage key.
 * When omitted, the file is stored in temporary storage under
 * TEMP_STORAGE_PREFIX and auto-cleaned after STORAGE_TEMP_CLEANUP_AFTER.
 */
export const DestinationPropSchema = Schema.optional(
  TemplateStringSchema.pipe(
    Schema.annotations({
      description:
        'Storage key for the output file. If omitted, file is stored in temporary storage and auto-cleaned after STORAGE_TEMP_CLEANUP_AFTER (default: 24 hours).',
    })
  )
)

/**
 * Prefix for temporary automation files.
 * Files under this prefix are subject to automatic cleanup.
 */
export const TEMP_STORAGE_PREFIX = 'tmp/automations/'
