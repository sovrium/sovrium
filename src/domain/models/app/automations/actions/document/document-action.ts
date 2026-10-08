/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { DocumentConvertActionSchema } from './convert'
import { DocumentGenerateDocxActionSchema } from './generate-docx'
import { DocumentGenerateImageActionSchema } from './generate-image'
import { DocumentGeneratePdfActionSchema } from './generate-pdf'
import { DocumentGenerateXlsxActionSchema } from './generate-xlsx'

/**
 * Document Action — union of the operators that generate a document from a
 * template and data. Manipulating an existing PDF is the `pdf` family;
 * storing, moving and converting files is the `file` family.
 */
export const DocumentActionSchema = Schema.Union([
  DocumentGeneratePdfActionSchema,
  DocumentGenerateImageActionSchema,
  DocumentGenerateDocxActionSchema,
  DocumentGenerateXlsxActionSchema,
  DocumentConvertActionSchema,
]).pipe(
  Schema.annotate({
    identifier: 'DocumentAction',
    title: 'Document Action',
    description:
      'Generate a document from a template and data — a PDF, an image, a Word document or a workbook — or convert an existing file into a PDF',
  })
)

/** @public */
export type DocumentAction = Schema.Schema.Type<typeof DocumentActionSchema>
