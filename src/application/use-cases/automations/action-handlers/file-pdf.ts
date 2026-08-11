/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Minimal, dependency-free PDF writer for the `file/generatePdf` action.
 *
 * A full HTML-to-PDF engine (headless Chromium / wkhtmltopdf) is a heavy
 * native dependency; the automation `generatePdf` action only needs to
 * produce a *valid* single-page PDF whose visible text is the rendered
 * template. We flatten the HTML to plain text via the canonical
 * parser-based `htmlToTextLines` stripper and emit a hand-rolled PDF 1.4
 * document — one page, one Helvetica text block — with a correct
 * cross-reference table so any conformant reader (and the spec's `%PDF`
 * magic-byte assertion) accepts it.
 */

import { htmlToTextLines } from '@/domain/utils/html-sanitization'

/**
 * Zero-pad a byte offset to PDF's 10-character `xref` entry width.
 * Hoisted to module scope so it isn't reallocated on every render.
 */
const padXrefOffset = (n: number): string => n.toString().padStart(10, '0')

/** Escape the characters that are special inside a PDF literal string. */
const escapePdfText = (text: string): string =>
  text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')

/** Build the page content stream — a stack of text lines at 12pt Helvetica. */
const buildContentStream = (lines: readonly string[]): string => {
  const visible = lines.length > 0 ? lines : ['']
  const textOps = visible
    .map((line, index) => {
      const positioning = index === 0 ? '72 720 Td' : '0 -16 Td'
      return `${positioning}\n(${escapePdfText(line)}) Tj`
    })
    .join('\n')
  return `BT\n/F1 12 Tf\n${textOps}\nET`
}

/**
 * Render an HTML template to a minimal valid PDF document.
 * The returned bytes begin with the `%PDF` magic header.
 */
export const renderHtmlToPdf = (html: string): Uint8Array => {
  const content = buildContentStream(htmlToTextLines(html))
  const contentBytes = new TextEncoder().encode(content)

  const objects: readonly string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ' +
      '/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${contentBytes.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]

  const header = '%PDF-1.4\n'
  // Assemble bodies and track each object's byte offset for the xref table.
  const assembled = objects.reduce<{ body: string; offsets: number[] }>(
    (state, obj, index) => {
      const objNumber = index + 1
      const chunk = `${objNumber} 0 obj\n${obj}\nendobj\n`
      return {
        body: state.body + chunk,
        offsets: [...state.offsets, header.length + state.body.length],
      }
    },
    { body: '', offsets: [] }
  )

  const xrefOffset = header.length + assembled.body.length
  const xrefEntries = assembled.offsets
    .map((offset) => `${padXrefOffset(offset)} 00000 n \n`)
    .join('')
  const xref = `xref\n0 ${objects.length + 1}\n` + `0000000000 65535 f \n${xrefEntries}`
  const trailer =
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` + `startxref\n${xrefOffset}\n%%EOF\n`

  return new TextEncoder().encode(header + assembled.body + xref + trailer)
}
