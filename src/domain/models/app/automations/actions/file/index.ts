/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { FileCompressActionSchema } from './compress'
import { FileCopyActionSchema } from './copy'
import { FileDeleteActionSchema } from './delete'
import { FileDownloadActionSchema } from './download'
import { FileExtractTextActionSchema } from './extract-text'
import { FileGenerateCsvActionSchema } from './generate-csv'
import { FileGeneratePdfActionSchema } from './generate-pdf'
import { FileGetMetadataActionSchema } from './get-metadata'
import { FileListActionSchema } from './list'
import { FileMoveActionSchema } from './move'
import { FileParseCsvActionSchema } from './parse-csv'
import { FileSignUrlActionSchema } from './sign-url'
import { FileTransformImageActionSchema } from './transform-image'
import { FileUploadActionSchema } from './upload'

/**
 * File Action — union of all file operation operators
 *
 * Phase 1 (Core): upload, download, delete, copy, move, list, getMetadata, signUrl,
 *                 generateCsv (enhanced), generatePdf (enhanced)
 * Phase 2 (Advanced): parseCsv, extractText, transformImage, compress
 */
export const FileActionSchema = Schema.Union(
  // Phase 1 — Storage Operations
  FileUploadActionSchema,
  FileDownloadActionSchema,
  FileDeleteActionSchema,
  FileCopyActionSchema,
  FileMoveActionSchema,
  FileListActionSchema,
  // Phase 1 — Metadata & Access
  FileGetMetadataActionSchema,
  FileSignUrlActionSchema,
  // Phase 1 — Generation (enhanced with destination)
  FileGenerateCsvActionSchema,
  FileGeneratePdfActionSchema,
  // Phase 2 — Advanced
  FileParseCsvActionSchema,
  FileExtractTextActionSchema,
  FileTransformImageActionSchema,
  FileCompressActionSchema
).pipe(
  Schema.annotations({
    identifier: 'FileAction',
    title: 'File Action',
    description: 'File operations: storage, generation, parsing, transformation, and compression',
  })
)

/** @public */
export type FileAction = Schema.Schema.Type<typeof FileActionSchema>

export * from './shared'
export * from './upload'
export * from './download'
export * from './delete'
export * from './copy'
export * from './move'
export * from './list'
export * from './get-metadata'
export * from './sign-url'
export * from './generate-csv'
export * from './generate-pdf'
export * from './parse-csv'
export * from './extract-text'
export * from './transform-image'
export * from './compress'
