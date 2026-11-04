/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The proof file of a signing request, printed with pdf-lib and the base
 * fonts: no browser, no font file, so producing it never depends on anything
 * optional on the server.
 *
 * Lines are wrapped at spaces to the page width, so a phrase read back from
 * the page joins with single spaces exactly as written; a word wider than the
 * page (a fingerprint never is) is cut where it overflows. Characters the base
 * fonts cannot draw are printed as `U+XXXX`. Every value is drawn through the
 * font's encoder, so markup and PDF syntax are printed as text.
 *
 * The evidence file is attached as `evidence.json`: the printed pages are its
 * readable copy, the attachment is the record.
 */

import { printableText } from '@/domain/models/app/signatures/signature-proof-service'
import { SIGNATURE_SEAL_FIELD_NAME } from '@/domain/models/app/signatures/signature-request-service'
import { pdfLib } from './pdf-editor-library'
import { addProofSealField, declareSealPlaceholder } from './signature-seal-placeholder'
import type { SealPlaceholderRequest } from '@/application/ports/services/signature-pdf'
import type {
  ProofLine,
  ProofLineStyle,
} from '@/domain/models/app/signatures/signature-proof-service'
import type { PDFDocument, PDFFont, PDFPage } from '@cantoo/pdf-lib'

/** A4 portrait, in points. */
const PAGE_SIZE: readonly [number, number] = [595.28, 841.89]

const MARGIN = 56

/** The space between two lines, as a multiple of the font size. */
const LEADING = 1.4

/** How each style is set: its font and size. */
interface LineSet {
  readonly font: PDFFont
  readonly size: number
}

type StyleSets = Readonly<Record<ProofLineStyle, LineSet>>

const STYLE_SIZES: Readonly<Record<ProofLineStyle, number>> = {
  title: 18,
  heading: 12,
  text: 10,
  fingerprint: 9,
}

/** The fonts of the four styles, embedded once. */
const embedStyles = async (doc: PDFDocument): Promise<StyleSets> => {
  const lib = await pdfLib()
  const regular = await doc.embedFont(lib.StandardFonts.Helvetica)
  const bold = await doc.embedFont(lib.StandardFonts.HelveticaBold)
  const mono = await doc.embedFont(lib.StandardFonts.Courier)
  return {
    title: { font: bold, size: STYLE_SIZES.title },
    heading: { font: bold, size: STYLE_SIZES.heading },
    text: { font: regular, size: STYLE_SIZES.text },
    fingerprint: { font: mono, size: STYLE_SIZES.fingerprint },
  }
}

/** `word` cut into pieces no wider than `width`. */
const cutWord = (word: string, fits: (text: string) => boolean): readonly string[] =>
  [...word].reduce<readonly string[]>((pieces, character) => {
    const last = pieces.at(-1)
    return last !== undefined && fits(last + character)
      ? [...pieces.slice(0, -1), last + character]
      : [...pieces, character]
  }, [])

/** `text` wrapped at spaces so each line is at most `width` wide in `set`. */
const wrap = (text: string, set: LineSet, width: number): readonly string[] => {
  const fits = (candidate: string) => set.font.widthOfTextAtSize(candidate, set.size) <= width
  const words = text.split(' ').flatMap((word) => (fits(word) ? [word] : cutWord(word, fits)))
  return words.reduce<readonly string[]>((lines, word) => {
    const last = lines.at(-1)
    return last !== undefined && fits(`${last} ${word}`)
      ? [...lines.slice(0, -1), `${last} ${word}`]
      : [...lines, word]
  }, [])
}

/** One drawn line: its text, how it is set, and the space it takes. */
interface SetLine {
  readonly text: string
  readonly set: LineSet
  readonly advance: number
}

/** Every proof line, printable and wrapped, ready to be laid out. */
const setLines = (lines: readonly ProofLine[], styles: StyleSets): readonly SetLine[] => {
  const width = PAGE_SIZE[0] - 2 * MARGIN
  return lines.flatMap((line) => {
    const set = styles[line.style]
    const coverage = new Set(set.font.getCharacterSet())
    const text = printableText(line.text, (codePoint) => coverage.has(codePoint))
    const before = line.style === 'heading' ? set.size * 0.6 : 0
    const wrapped = text === '' ? [''] : wrap(text, set, width)
    return wrapped.map((piece, index) => ({
      text: piece,
      set,
      advance: set.size * LEADING + (index === 0 ? before : 0),
    }))
  })
}

/** Lay the lines out page after page, from the top margin down. */
const layOut = (doc: PDFDocument, lines: readonly SetLine[]): void => {
  const bottom = MARGIN
  lines.reduce<{ readonly page: PDFPage; readonly y: number }>(
    (cursor, line) => {
      const next =
        cursor.y - line.advance < bottom
          ? { page: doc.addPage([...PAGE_SIZE]), y: PAGE_SIZE[1] - MARGIN }
          : cursor
      const y = next.y - line.advance
      if (line.text !== '') {
        next.page.drawText(line.text, { x: MARGIN, y, font: line.set.font, size: line.set.size })
      }
      return { page: next.page, y }
    },
    { page: doc.addPage([...PAGE_SIZE]), y: PAGE_SIZE[1] - MARGIN }
  )
}

/**
 * The proof file: its lines printed, `evidence.json` attached. With `seal`,
 * it carries an invisible seal field holding the placeholder the caller
 * fills, and is saved without object streams so the placeholder is found.
 */
export const buildProofFile = async (input: {
  readonly title: string
  readonly lines: readonly ProofLine[]
  readonly evidenceJson: Uint8Array
  readonly seal?: SealPlaceholderRequest | undefined
}): Promise<Uint8Array> => {
  const lib = await pdfLib()
  const doc = await lib.PDFDocument.create()
  const styles = await embedStyles(doc)
  const titleCoverage = new Set(styles.text.font.getCharacterSet())
  doc.setTitle(printableText(input.title, (codePoint) => titleCoverage.has(codePoint)))
  layOut(doc, setLines(input.lines, styles))
  await doc.attach(input.evidenceJson, 'evidence.json', {
    mimeType: 'application/json',
    description: 'Evidence file of the signing request',
  })
  if (input.seal === undefined) return doc.save()
  const field = addProofSealField(lib, doc, SIGNATURE_SEAL_FIELD_NAME)
  declareSealPlaceholder(lib, doc, field, input.seal.signedAt)
  return doc.save({ useObjectStreams: false })
}
