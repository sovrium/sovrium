/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import { PdfInputError, PdfToolkit, type LoadedPdf } from '@/application/ports/services/pdf-toolkit'
import type { PDFDocument } from '@cantoo/pdf-lib'

/**
 * `@cantoo/pdf-lib` (the maintained fork of pdf-lib, pure JavaScript) behind
 * the `PdfToolkit` port. Imported on first use, so a server that never merges
 * a PDF never loads it.
 */

const pdfLib = () => import('@cantoo/pdf-lib')

const reason = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause))

const asDocument = (pdf: LoadedPdf): PDFDocument => pdf.handle as PDFDocument

export const PdfToolkitLive = Layer.succeed(PdfToolkit, {
  load: (bytes, index) =>
    Effect.tryPromise({
      try: async () => {
        const { PDFDocument: Document } = await pdfLib()
        const document = await Document.load(bytes, { updateMetadata: false })
        return { pageCount: document.getPageCount(), handle: document }
      },
      catch: (cause) =>
        new PdfInputError({ index, message: `is not a readable PDF (${reason(cause)})` }),
    }).pipe(Effect.withSpan('documents.pdf-load')),
  merge: (parts) =>
    Effect.tryPromise({
      try: async () => {
        const { PDFDocument: Document } = await pdfLib()
        const merged = await Document.create()
        await parts.reduce(async (previous, part) => {
          await previous
          const copied = await merged.copyPages(asDocument(part.pdf), [...part.pages])
          copied.forEach((page) => merged.addPage(page))
        }, Promise.resolve())
        return { bytes: await merged.save(), pages: merged.getPageCount() }
      },
      catch: (cause) =>
        new PdfInputError({
          index: -1,
          message: `the PDFs could not be merged (${reason(cause)})`,
        }),
    }).pipe(Effect.withSpan('documents.pdf-merge')),
})
