/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


const padXrefOffset = (n: number): string => n.toString().padStart(10, '0')

const htmlToPlainLines = (html: string): readonly string[] => {
  const withoutTags = html
    .replace(/<\s*(br|\/p|\/h[1-6]|\/div|\/li)\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
  const decoded = withoutTags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
  return decoded
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line !== '')
}

const escapePdfText = (text: string): string =>
  text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')

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

export const renderHtmlToPdf = (html: string): Uint8Array => {
  const content = buildContentStream(htmlToPlainLines(html))
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
