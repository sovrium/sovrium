/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { buildStoredZip } from './file-zip'

/**
 * `.xlsx` writer over the same closed subset `file-xlsx-parse.ts` reads.
 *
 * Emits the minimal part set an OOXML consumer requires — `[Content_Types].xml`,
 * `_rels/.rels`, `xl/workbook.xml` + its rels, one `xl/worksheets/sheetN.xml`
 * per sheet, and `xl/sharedStrings.xml` — plus `xl/styles.xml` ONLY when a date
 * cell is present, since a date is a number plus a number-format and cannot be
 * expressed without one.
 *
 * A value that has no representation in the subset (an object, an array, a
 * bigint) is REFUSED by name rather than coerced. `String({})` would write
 * `[object Object]` into the cell and the loss would only ever be discovered
 * downstream, in Excel — which is precisely the silent misparse the closed
 * subset exists to prevent, pointed the other way.
 *
 * The container is written by the existing STORE-only `buildStoredZip`: stored
 * entries are fully-valid ZIP, and compressing a spreadsheet Sovrium just
 * generated buys nothing the reader needs.
 */

export interface XlsxSheetInput {
  readonly name: string
  /** Optional header row, emitted above `rows`. */
  readonly header?: ReadonlyArray<string>
  readonly rows: ReadonlyArray<ReadonlyArray<unknown>>
}

export type XlsxWriteResult =
  | { readonly ok: true; readonly bytes: Uint8Array }
  | { readonly ok: false; readonly message: string }

const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30)
const DAY_MS = 86_400_000

/** `cellXfs` index carrying the built-in `m/d/yyyy` date format. */
const DATE_STYLE_INDEX = 1

/**
 * Date -> Excel serial, the exact inverse of the reader's `serialToIso`.
 *
 * Excel numbers the non-existent 1900-02-29 as serial 60, so serials at or
 * below it sit one day ahead of the plain 1899-12-30 anchor. The reader
 * compensates; without the same compensation here a January-1900 date would
 * come back one day off its own round-trip.
 */
const dateToSerial = (epochMs: number): number => {
  const naive = (epochMs - EXCEL_EPOCH_UTC) / DAY_MS
  return naive <= 60 ? naive - 1 : naive
}

type EncodedCell =
  | { readonly kind: 'empty' }
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'number'; readonly value: number }
  | { readonly kind: 'boolean'; readonly value: boolean }
  | { readonly kind: 'date'; readonly serial: number }

/** Typed cell, or `undefined` when the value falls outside the subset. */
const encodeValue = (value: unknown): EncodedCell | undefined => {
  if (value === null || value === undefined || value === '') return { kind: 'empty' }
  if (typeof value === 'string') return { kind: 'text', text: value }
  if (typeof value === 'boolean') return { kind: 'boolean', value }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? { kind: 'number', value } : undefined
  }
  if (value instanceof Date) {
    return Number.isFinite(value.getTime())
      ? { kind: 'date', serial: dateToSerial(value.getTime()) }
      : undefined
  }
  return undefined
}

const escapeXml = (raw: string): string =>
  raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // Control characters are illegal in XML 1.0 and would make the package
    // unopenable; drop them rather than emit a file Excel refuses.
    // eslint-disable-next-line no-control-regex -- stripping the XML-illegal C0 range is the point
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')

/** 0 -> "A", 26 -> "AA". */
export const columnRef = (index: number): string =>
  index < 26
    ? String.fromCodePoint(65 + index)
    : `${columnRef(Math.floor(index / 26) - 1)}${String.fromCodePoint(65 + (index % 26))}`

interface EncodedSheet {
  readonly name: string
  readonly rows: ReadonlyArray<ReadonlyArray<EncodedCell>>
}

/** Encode every cell of every sheet, or name the first value that cannot be. */
const encodeSheets = (
  sheets: ReadonlyArray<XlsxSheetInput>
): { readonly ok: true; readonly sheets: ReadonlyArray<EncodedSheet> } | XlsxWriteResult => {
  const encoded = sheets.map((sheet) => {
    const grid = [...(sheet.header ? [sheet.header as ReadonlyArray<unknown>] : []), ...sheet.rows]
    return { name: sheet.name, rows: grid.map((row) => row.map((cell) => encodeValue(cell))) }
  })
  const bad = encoded.flatMap((sheet, sheetIndex) =>
    sheet.rows.flatMap((row, rowIndex) =>
      row.flatMap((cell, column) =>
        cell === undefined
          ? [
              `unsupported cell value in sheet ${JSON.stringify(sheets[sheetIndex]?.name ?? '')} at ${columnRef(column)}${rowIndex + 1}: generateXlsx writes strings, numbers, booleans and dates only`,
            ]
          : []
      )
    )
  )
  if (bad[0] !== undefined) return { ok: false, message: bad[0] }
  return {
    ok: true,
    sheets: encoded as ReadonlyArray<EncodedSheet>,
  }
}

/** Every distinct text across the workbook, in first-seen order. */
const collectStrings = (sheets: ReadonlyArray<EncodedSheet>): ReadonlyArray<string> => [
  ...new Set(
    sheets.flatMap((sheet) =>
      sheet.rows.flatMap((row) => row.flatMap((cell) => (cell.kind === 'text' ? [cell.text] : [])))
    )
  ),
]

const cellXml = (cell: EncodedCell, ref: string, strings: ReadonlyMap<string, number>): string => {
  if (cell.kind === 'empty') return ''
  if (cell.kind === 'text') return `<c r="${ref}" t="s"><v>${strings.get(cell.text) ?? 0}</v></c>`
  if (cell.kind === 'boolean') return `<c r="${ref}" t="b"><v>${cell.value ? 1 : 0}</v></c>`
  if (cell.kind === 'date') {
    return `<c r="${ref}" s="${DATE_STYLE_INDEX}"><v>${cell.serial}</v></c>`
  }
  return `<c r="${ref}"><v>${cell.value}</v></c>`
}

const sheetXml = (sheet: EncodedSheet, strings: ReadonlyMap<string, number>): string => {
  const rows = sheet.rows
    .map(
      (row, rowIndex) =>
        `<row r="${rowIndex + 1}">${row
          .map((cell, column) => cellXml(cell, `${columnRef(column)}${rowIndex + 1}`, strings))
          .join('')}</row>`
    )
    .join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`
}

const contentTypesXml = (sheetCount: number, withStyles: boolean): string =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${Array.from(
    { length: sheetCount },
    (_unused, i) =>
      `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  ).join(
    ''
  )}<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>${
    withStyles
      ? '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
      : ''
  }</Types>`

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="0"/><fonts count="1"><font/></fonts><fills count="1"><fill/></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>`

const workbookXml = (names: ReadonlyArray<string>): string =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names
    .map((name, i) => `<sheet name="${escapeXml(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join('')}</sheets></workbook>`

const workbookRelsXml = (sheetCount: number, withStyles: boolean): string =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${Array.from(
    { length: sheetCount },
    (_unused, i) =>
      `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
  ).join(
    ''
  )}<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>${
    withStyles
      ? `<Relationship Id="rId${sheetCount + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`
      : ''
  }</Relationships>`

const sharedStringsXml = (strings: ReadonlyArray<string>): string =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">${strings
    .map((s) => `<si><t xml:space="preserve">${escapeXml(s)}</t></si>`)
    .join('')}</sst>`

const encode = (text: string): Uint8Array => new TextEncoder().encode(text)

/** Build a complete `.xlsx` package, or name the value that made it impossible. */
export const buildXlsx = (sheets: ReadonlyArray<XlsxSheetInput>): XlsxWriteResult => {
  if (sheets.length === 0) return { ok: false, message: 'generateXlsx requires at least one sheet' }
  const encoded = encodeSheets(sheets)
  if (!('sheets' in encoded)) return encoded

  const strings = collectStrings(encoded.sheets)
  const index = new Map(strings.map((value, i) => [value, i] as const))
  const withStyles = encoded.sheets.some((sheet) =>
    sheet.rows.some((row) => row.some((cell) => cell.kind === 'date'))
  )

  const worksheets = encoded.sheets.map((sheet, i) => ({
    name: `xl/worksheets/sheet${i + 1}.xml`,
    bytes: encode(sheetXml(sheet, index)),
  }))

  return {
    ok: true,
    bytes: buildStoredZip([
      {
        name: '[Content_Types].xml',
        bytes: encode(contentTypesXml(encoded.sheets.length, withStyles)),
      },
      { name: '_rels/.rels', bytes: encode(ROOT_RELS) },
      {
        name: 'xl/workbook.xml',
        bytes: encode(workbookXml(encoded.sheets.map((sheet) => sheet.name))),
      },
      {
        name: 'xl/_rels/workbook.xml.rels',
        bytes: encode(workbookRelsXml(encoded.sheets.length, withStyles)),
      },
      ...worksheets,
      { name: 'xl/sharedStrings.xml', bytes: encode(sharedStringsXml(strings)) },
      ...(withStyles ? [{ name: 'xl/styles.xml', bytes: encode(STYLES_XML) }] : []),
    ]),
  }
}
