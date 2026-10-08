/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import {
  PdfEditError,
  PdfEditor,
  PdfOpenError,
  PdfPictureError,
  type BuiltPdf,
  type OpenedPdf,
  type PdfPageFacts,
} from '@/application/ports/services/pdf-editor'
import { addRotation } from '@/domain/models/app/automations/actions/pdf/page-plan-service'
import { fillPdfForm, formFieldsOf } from './pdf-editor-forms'
import { EditRefusal, pdfLib, reasonOf } from './pdf-editor-library'
import { drawPdfMark } from './pdf-editor-marks'
import { buildPdfFromPictures, PictureRefusal } from './pdf-editor-pictures'
import type { PdfInspectResult } from '@/domain/models/app/automations/actions/pdf/inspect'
import type { PDFDocument, PDFPage } from '@cantoo/pdf-lib'

/**
 * `@cantoo/pdf-lib` (the maintained fork of pdf-lib, pure JavaScript) behind
 * the `PdfEditor` port. Imported on first use, so a server that never edits
 * a PDF never loads it. Every load keeps the file's own metadata
 * (`updateMetadata: false`).
 */

const asDocument = (pdf: OpenedPdf): PDFDocument => pdf.handle as PDFDocument

/** A page's MediaBox size and its rotation, clockwise, as 0, 90, 180 or 270. */
const factsOf = (page: PDFPage): PdfPageFacts => {
  const box = page.getMediaBox()
  return {
    width: box.width,
    height: box.height,
    rotation: addRotation(page.getRotation().angle, 0),
  }
}

/** Load bytes, encrypted or not; `undefined` when they are not a PDF. */
const loadAny = async (bytes: Uint8Array): Promise<PDFDocument | undefined> => {
  const { PDFDocument: Document } = await pdfLib()
  try {
    return await Document.load(bytes, { updateMetadata: false, ignoreEncryption: true })
  } catch {
    return undefined
  }
}

const notAPdf = () => new PdfOpenError({ reason: 'not-a-pdf', message: 'is not a PDF' })

const open = (bytes: Uint8Array) =>
  Effect.tryPromise({
    try: () => loadAny(bytes),
    catch: notAPdf,
  }).pipe(
    Effect.flatMap((document) => {
      if (document === undefined) return Effect.fail(notAPdf())
      if (document.isEncrypted) {
        return Effect.fail(
          new PdfOpenError({
            reason: 'encrypted',
            message: 'is encrypted (password-protected); PDF actions do not open protected files',
          })
        )
      }
      return Effect.succeed({ pages: document.getPages().map(factsOf), handle: document })
    }),
    Effect.withSpan('documents.pdf-open')
  )

const isoDate = (date: Date | undefined): string | undefined =>
  date === undefined || Number.isNaN(date.getTime()) ? undefined : date.toISOString()

/** The document information the file declares, without the entries it leaves out. */
const metadataOf = (document: PDFDocument): PdfInspectResult['metadata'] => {
  const entries = {
    title: document.getTitle(),
    author: document.getAuthor(),
    subject: document.getSubject(),
    keywords: document.getKeywords(),
    creator: document.getCreator(),
    producer: document.getProducer(),
    creationDate: isoDate(document.getCreationDate()),
    modificationDate: isoDate(document.getModificationDate()),
  }
  return Object.fromEntries(
    Object.entries(entries).filter((entry): entry is [string, string] => entry[1] !== undefined)
  )
}

/** Inspect: an encrypted file is reported with its pages, its strings and form left unread. */
const inspectDocument = (
  lib: Awaited<ReturnType<typeof pdfLib>>,
  document: PDFDocument
): PdfInspectResult => {
  const encrypted = document.isEncrypted
  return {
    pages: document.getPageCount(),
    pageSizes: document.getPages().map(factsOf),
    metadata: encrypted ? {} : metadataOf(document),
    encrypted,
    formFields: encrypted ? [] : formFieldsOf(lib, document),
  }
}

/** Read a PDF's report; `undefined` when the bytes are not a PDF. */
const reportOf = async (bytes: Uint8Array): Promise<PdfInspectResult | undefined> => {
  const document = await loadAny(bytes)
  return document === undefined ? undefined : inspectDocument(await pdfLib(), document)
}

const inspect = (bytes: Uint8Array) =>
  Effect.tryPromise({ try: () => reportOf(bytes), catch: notAPdf }).pipe(
    Effect.filterOrFail((report): report is PdfInspectResult => report !== undefined, notAPdf),
    Effect.withSpan('documents.pdf-inspect')
  )

/** Save a document as a built PDF. */
const built = async (document: PDFDocument): Promise<BuiltPdf> => ({
  bytes: await document.save(),
  pages: document.getPageCount(),
})

/** Run one edit, a refusal keeping its own words and anything else saying what failed. */
const edit = (what: string, span: string, run: () => Promise<BuiltPdf>) =>
  Effect.tryPromise({
    try: run,
    catch: (cause) =>
      new PdfEditError({
        message:
          cause instanceof EditRefusal
            ? cause.message
            : `the PDF could not be ${what} (${reasonOf(cause)})`,
      }),
  }).pipe(Effect.withSpan(span))

const pickGroups = async (source: PDFDocument, groups: readonly (readonly number[])[]) => {
  const { PDFDocument: Document } = await pdfLib()
  return Promise.all(
    groups.map(async (group) => {
      const part = await Document.create()
      const copied = await part.copyPages(source, [...group])
      copied.forEach((page) => part.addPage(page))
      return built(part)
    })
  )
}

const rotatePages = async (document: PDFDocument, rotations: ReadonlyMap<number, number>) => {
  const { degrees } = await pdfLib()
  rotations.forEach((angle, index) => document.getPage(index).setRotation(degrees(angle)))
  return built(document)
}

export const PdfEditorLive = Layer.succeed(PdfEditor, {
  open,
  inspect,
  pick: (pdf, groups) =>
    Effect.tryPromise({
      try: () => pickGroups(asDocument(pdf), groups),
      catch: (cause) =>
        new PdfEditError({ message: `the pages could not be copied (${reasonOf(cause)})` }),
    }).pipe(Effect.withSpan('documents.pdf-pick')),
  rotate: (pdf, rotations) =>
    edit('rotated', 'documents.pdf-rotate', () => rotatePages(asDocument(pdf), rotations)),
  mark: (pdf, request) =>
    edit('marked', 'documents.pdf-mark', () => drawPdfMark(asDocument(pdf), request)),
  fillForm: (pdf, values, flatten) =>
    edit('filled', 'documents.pdf-fill-form', () => fillPdfForm(asDocument(pdf), values, flatten)),
  fromImages: (pictures, layout) =>
    Effect.tryPromise({
      try: () => buildPdfFromPictures(pictures, layout),
      catch: (cause) =>
        cause instanceof PictureRefusal
          ? new PdfPictureError({ index: cause.index, message: cause.message })
          : new PdfPictureError({
              index: -1,
              message: `the pictures could not be laid out (${reasonOf(cause)})`,
            }),
    }).pipe(Effect.withSpan('documents.pdf-from-images')),
})
