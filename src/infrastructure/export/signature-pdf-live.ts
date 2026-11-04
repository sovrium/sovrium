/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `SignaturePdf` over pdf-lib.
 *
 * The signed document is the frozen copy followed by one incremental
 * revision: the copy is loaded for an incremental update (metadata left as it
 * is) and saved without object streams, so the writer appends only the
 * objects completion changed or added, then one cross-reference section and
 * one `%%EOF`. Each placed signer adds a `Stamp` annotation to her page: its
 * `/Contents` names her and her signing instant (as UTF-16, so any script is
 * kept exactly), and its appearance draws her PNG or her typed name inside
 * the box, in the base font. A stamp is not a signature field: the one
 * signature field the file declares stays the seal's, declared when the copy
 * was frozen.
 *
 * Sealing extends this same revision rather than adding a second one: the seal
 * is declared on the loaded document between {@link drawMarks} and the save,
 * and its placeholder filled in the saved bytes, so the file still carries the
 * frozen copy plus exactly one update.
 *
 * Text drawn into an appearance is encoded by the font (`<hex> Tj`), never
 * spliced into the content stream as a literal string, so a name holding
 * PDF syntax is drawn as the characters it holds.
 */

import { Effect, Layer } from 'effect'
import {
  SignaturePdf,
  SignaturePdfFailure,
  type MarkToDraw,
  type SealPlaceholderRequest,
} from '@/application/ports/services/signature-pdf'
import { printableText } from '@/domain/models/app/signatures/signature-proof-service'
import { SIGNATURE_SEAL_FIELD_NAME } from '@/domain/models/app/signatures/signature-request-service'
import { pdfLib, reasonOf, type PdfLib } from './pdf-editor-library'
import { buildProofFile } from './signature-proof-pdf'
import { declareSealPlaceholder, sealFieldOf } from './signature-seal-placeholder'
import type {
  PdfFieldBox,
  SignatureDocumentLayout,
} from '@/domain/models/app/signatures/signature-placement-service'
import type { PDFDict, PDFDocument, PDFFont, PDFImage, PDFObject } from '@cantoo/pdf-lib'

/** Annotation flags of a stamp: printed (4) and locked (128), so a reader neither hides nor moves it. */
const STAMP_FLAGS = 4 | 128

/** Inner margin of a mark, in points. */
const MARK_PADDING = 2

/** The ink of a mark: a dark blue, as a pen would leave. */
const MARK_INK = '0.1 0.16 0.42 rg'

const failure = (message: string) => (cause: unknown) =>
  new SignaturePdfFailure({ message: `${message}: ${reasonOf(cause)}`, cause })

const numberOf = (lib: PdfLib, value: PDFObject | undefined): number =>
  value instanceof lib.PDFNumber ? value.asNumber() : 0

/** The text a field dictionary holds under `/T`, decoded. */
const partialName = (lib: PdfLib, dict: PDFDict): string | undefined => {
  const name = dict.lookup(lib.PDFName.of('T'))
  return name instanceof lib.PDFString || name instanceof lib.PDFHexString
    ? name.decodeText()
    : undefined
}

/** The fully qualified name of a widget: its own `/T` and its parents', joined by dots. */
const qualifiedName = (lib: PdfLib, widget: PDFDict): string | undefined => {
  const parts = Array.from({ length: 32 }).reduce<{
    readonly dict: PDFDict | undefined
    readonly names: readonly string[]
  }>(
    (walk) => {
      if (walk.dict === undefined) return walk
      const name = partialName(lib, walk.dict)
      const parent = walk.dict.lookup(lib.PDFName.of('Parent'))
      return {
        dict: parent instanceof lib.PDFDict ? parent : undefined,
        names: name === undefined ? walk.names : [name, ...walk.names],
      }
    },
    { dict: widget, names: [] }
  ).names
  return parts.length === 0 ? undefined : parts.join('.')
}

/** Every named box a page's annotations hold. */
const fieldsOnPage = (lib: PdfLib, doc: PDFDocument, page: number): readonly PdfFieldBox[] => {
  const annots = doc.getPage(page).node.Annots()
  if (annots === undefined) return []
  return annots.asArray().flatMap((ref) => {
    const widget = doc.context.lookup(ref)
    if (!(widget instanceof lib.PDFDict)) return []
    const rect = widget.lookup(lib.PDFName.of('Rect'))
    const name = qualifiedName(lib, widget)
    if (!(rect instanceof lib.PDFArray) || rect.size() !== 4 || name === undefined) return []
    const [x1, y1, x2, y2] = rect.asArray().map((value) => numberOf(lib, value))
    return [{ name, page, rect: [x1 ?? 0, y1 ?? 0, x2 ?? 0, y2 ?? 0] as const }]
  })
}

/** The pages and named boxes of a frozen copy. */
const readLayout = async (frozen: Uint8Array): Promise<SignatureDocumentLayout> => {
  const lib = await pdfLib()
  const doc = await lib.PDFDocument.load(frozen, { updateMetadata: false })
  const pages = doc.getPages().map((page) => page.getMediaBox())
  return {
    pages,
    fields: pages.flatMap((_, index) => fieldsOnPage(lib, doc, index)),
  }
}

/** The fonts a mark is drawn with: the name in the oblique face, the date upright. */
interface MarkFonts {
  readonly name: PDFFont
  readonly date: PDFFont
}

/** `text` as `font` can draw it. */
const drawable = (font: PDFFont, text: string): string => {
  const coverage = new Set(font.getCharacterSet())
  return printableText(text, (codePoint) => coverage.has(codePoint))
}

/** One line of text, fitted to `width` and at most `size` points, as content operators. */
const textLine = (input: {
  readonly font: PDFFont
  readonly resource: string
  readonly text: string
  readonly width: number
  readonly size: number
  readonly baseline: number
}): string => {
  const text = drawable(input.font, input.text)
  const unit = input.font.widthOfTextAtSize(text, 1)
  const size = unit === 0 ? input.size : Math.min(input.size, input.width / unit)
  const encoded = input.font.encodeText(text).toString()
  return `BT /${input.resource} ${size.toFixed(2)} Tf ${MARK_PADDING} ${input.baseline.toFixed(2)} Td ${encoded} Tj ET`
}

/** The content of a mark's appearance, in its own space `[0 0 width height]`. */
const markContent = (mark: MarkToDraw, fonts: MarkFonts, image: PDFImage | undefined): string => {
  const { width, height } = mark.box
  const inner = Math.max(width - 2 * MARK_PADDING, 1)
  const [name, date] = mark.lines
  if (image === undefined) {
    return [
      'q',
      MARK_INK,
      textLine({
        ...{ font: fonts.name, resource: 'FName', text: name, width: inner },
        ...{ size: height * 0.5, baseline: height * 0.45 },
      }),
      textLine({
        ...{ font: fonts.date, resource: 'FDate', text: date, width: inner },
        ...{ size: height * 0.22, baseline: height * 0.1 },
      }),
      'Q',
    ].join('\n')
  }
  const area = { width: inner, height: Math.max(height * 0.75 - MARK_PADDING, 1) }
  const scale = Math.min(area.width / image.width, area.height / image.height)
  const drawn = { width: image.width * scale, height: image.height * scale }
  const left = (width - drawn.width) / 2
  const bottom = height * 0.25
  return [
    `q ${drawn.width.toFixed(2)} 0 0 ${drawn.height.toFixed(2)} ${left.toFixed(2)} ${bottom.toFixed(2)} cm /Mark Do Q`,
    'q',
    MARK_INK,
    textLine({
      ...{ font: fonts.date, resource: 'FDate', text: date, width: inner },
      ...{ size: height * 0.16, baseline: height * 0.06 },
    }),
    'Q',
  ].join('\n')
}

/** Add `mark` as a stamp on its page of `doc`. */
const addStamp = async (
  lib: PdfLib,
  doc: PDFDocument,
  fonts: MarkFonts,
  mark: MarkToDraw
): Promise<void> => {
  const { box } = mark
  const image = mark.image === undefined ? undefined : await doc.embedPng(mark.image)
  const content = markContent(mark, fonts, image)
  const appearance = doc.context.stream(content, {
    ...{ Type: 'XObject', Subtype: 'Form', BBox: [0, 0, box.width, box.height] },
    Resources: {
      Font: { FName: fonts.name.ref, FDate: fonts.date.ref },
      ...(image === undefined ? {} : { XObject: { Mark: image.ref } }),
    },
  })
  const page = doc.getPage(box.page)
  const stamp = doc.context.obj({
    ...{ Type: 'Annot', Subtype: 'Stamp', F: STAMP_FLAGS, P: page.ref },
    Rect: [box.x, box.y, box.x + box.width, box.y + box.height],
    Contents: lib.PDFHexString.fromText(mark.contents),
    AP: { N: doc.context.register(appearance) },
  })
  page.node.addAnnot(doc.context.register(stamp))
}

/** Every mark, drawn into the revision `doc` is being prepared as. */
const drawMarks = async (
  lib: PdfLib,
  doc: PDFDocument,
  marks: readonly MarkToDraw[]
): Promise<void> => {
  if (marks.length === 0) return
  const fonts: MarkFonts = {
    name: await doc.embedFont(lib.StandardFonts.HelveticaOblique),
    date: await doc.embedFont(lib.StandardFonts.Helvetica),
  }
  await marks.reduce(
    (previous, mark) => previous.then(() => addStamp(lib, doc, fonts, mark)),
    Promise.resolve()
  )
}

/** The frozen copy followed by one revision carrying `marks`, and the seal's placeholder when asked. */
const writeRevision = async (
  frozen: Uint8Array,
  marks: readonly MarkToDraw[],
  seal: SealPlaceholderRequest | undefined
): Promise<Uint8Array> => {
  const lib = await pdfLib()
  const doc = await lib.PDFDocument.load(frozen, {
    forIncrementalUpdate: true,
    updateMetadata: false,
  })
  await drawMarks(lib, doc, marks)
  if (seal !== undefined) {
    const field = sealFieldOf(lib, doc, SIGNATURE_SEAL_FIELD_NAME)
    if (field === undefined) throw new Error('the frozen copy declares no seal field')
    declareSealPlaceholder(lib, doc, field, seal.signedAt)
  }
  return doc.save({ useObjectStreams: false })
}

export const SignaturePdfLive = Layer.succeed(
  SignaturePdf,
  SignaturePdf.of({
    layout: (frozen) =>
      Effect.tryPromise({
        try: () => readLayout(frozen),
        catch: failure('The frozen document could not be read'),
      }).pipe(Effect.withSpan('signatures.read-document-layout')),
    completeRevision: (input) =>
      Effect.tryPromise({
        try: () => writeRevision(input.frozen, input.marks, input.seal),
        catch: failure('The signed document could not be written'),
      }).pipe(
        Effect.withSpan('signatures.complete-revision', {
          attributes: { marks: input.marks.length, sealed: input.seal !== undefined },
        })
      ),
    proofFile: (input) =>
      Effect.tryPromise({
        try: () => buildProofFile(input),
        catch: failure('The proof file could not be written'),
      }).pipe(Effect.withSpan('signatures.build-proof-file')),
  })
)
