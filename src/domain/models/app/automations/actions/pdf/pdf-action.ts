/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { PdfFillFormActionSchema } from './fill-form'
import { PdfFromImagesActionSchema } from './from-images'
import { PdfInspectActionSchema } from './inspect'
import { PdfMergeActionSchema } from './merge'
import { PdfPagesActionSchema } from './pages'
import { PdfSplitActionSchema } from './split'
import { PdfStampActionSchema } from './stamp'
import { PdfWatermarkActionSchema } from './watermark'

/**
 * PDF Action — union of the operators that work on PDFs that already exist,
 * all inside the binary: no browser and no office suite. Generating a PDF from
 * a template is `document/generatePdf`.
 */
export const PdfActionSchema = Schema.Union([
  PdfMergeActionSchema,
  PdfSplitActionSchema,
  PdfPagesActionSchema,
  PdfWatermarkActionSchema,
  PdfStampActionSchema,
  PdfFillFormActionSchema,
  PdfInspectActionSchema,
  PdfFromImagesActionSchema,
]).pipe(
  Schema.annotate({
    identifier: 'PdfAction',
    title: 'PDF Action',
    description:
      'Work on existing PDFs: merge, split, change pages, watermark, stamp, fill a form, inspect, or make one from pictures',
  })
)

/** @public */
export type PdfAction = Schema.Schema.Type<typeof PdfActionSchema>
