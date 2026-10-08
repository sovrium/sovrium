/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isRecord, type Raw } from '../action-handlers/document-run'
import {
  attrOf,
  allMatches,
  decodeXmlText,
  innerText,
  readSharedStrings,
} from '../action-handlers/file-xlsx-xml'
import { entryText, readOoxmlPackage, textEntry, writeOoxmlPackage } from './ooxml-package'
import { movedRow, moveReferences, type RowInsertion } from './xlsx-references'
import type { ZipEntry } from '../action-handlers/file-zip'

/**
 * Fill a workbook template (`.xlsx`) with data. Pure: bytes and data in, bytes
 * out; never throws.
 *
 * On every worksheet, a cell whose text holds tags is rendered: a cell that is
 * ONE tag naming a value takes that value's type (a number stays a number, an
 * ISO date becomes the date serial its cell's own number format displays, a
 * boolean a boolean); any other is text. A row whose first cell opens
 * `{{#each list}}` and whose last cell closes `{{/each}}` repeats once per
 * item, the rows below move down and every reference follows them
 * (`xlsx-references.ts`). Styles (`xl/styles.xml`), merged cells, column
 * widths, sheet names and untagged cells are kept byte for byte where nothing
 * moved; the workbook is marked to recalculate when it opens, since no cached
 * value is written. Values are XML-escaped as they are written.
 *
 * `render(text, context)` renders tag text WITHOUT escaping (the cell writer
 * escapes); the action hands in the template engine in its text mode, in the
 * template's trust tier.
 */

export const XLSX_TEMPLATE_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export type XlsxRender = (text: string, context: Readonly<Record<string, unknown>>) => string

export interface XlsxFillInput {
  readonly template: Uint8Array
  /** How the template is named in errors: its asset path or bucket key. */
  readonly templateName: string
  readonly data: Readonly<Record<string, unknown>>
  readonly render: XlsxRender
}

export type XlsxFillResult =
  | { readonly ok: true; readonly bytes: Uint8Array; readonly contentType: string }
  | { readonly ok: false; readonly message: string }

interface Cell {
  readonly column: string
  readonly attributes: string
  readonly inner: string
  /** The text the cell shows, for a text cell. */
  readonly text: string | undefined
}

interface Row {
  readonly number: number
  readonly attributes: string
  readonly cells: ReadonlyArray<Cell>
}

const ROW = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g
const CELL = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g
const SINGLE_TAG = /^\{\{\s*([\w$@]+(?:\.[\w$@]+)*)\s*\}\}$/
const EACH_OPEN = /^\{\{#each\s+([\w.]+)\s*\}\}/
const EACH_CLOSE = /\{\{\/each\}\}$/
const ITEM_SEPARATOR = '\u0002'
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/

const escapeXml = (text: string): string =>
  text
    // eslint-disable-next-line no-control-regex -- the characters XML 1.0 forbids
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

const cellText = (attributes: string, inner: string, shared: ReadonlyArray<string>) => {
  const type = attrOf(attributes, 't')
  if (type === 's') return shared[Number(/<v>([\s\S]*?)<\/v>/.exec(inner)?.[1])]
  if (type === 'inlineStr') return innerText(inner)
  return type === 'str' ? decodeXmlText(/<v>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? '') : undefined
}

const readRows = (sheetData: string, shared: ReadonlyArray<string>): ReadonlyArray<Row> =>
  allMatches(sheetData, ROW).map((row) => ({
    number: Number(attrOf(row[1] ?? '', 'r')),
    attributes: row[1] ?? '',
    cells: allMatches(row[2] ?? '', CELL).map((cell) => ({
      column: /^[A-Z]+/.exec(attrOf(cell[1] ?? '', 'r') ?? '')?.[0] ?? '',
      attributes: cell[1] ?? '',
      inner: cell[2] ?? '',
      text: cellText(cell[1] ?? '', cell[2] ?? '', shared),
    })),
  }))

/** The value a dotted path names: from the loop item first (`this.` names it), then from data. */
const lookup = (path: string, data: Raw, item: unknown): unknown => {
  const [head, ...rest] = path.split('.')
  const from = (root: unknown, keys: ReadonlyArray<string>): unknown =>
    keys.reduce<unknown>((value, key) => (isRecord(value) ? value[key] : undefined), root)
  if (head === 'this') return from(item, rest)
  const fromItem = item === undefined ? undefined : from(item, [head ?? '', ...rest])
  return fromItem ?? from(data, [head ?? '', ...rest])
}

/** Excel's serial of an ISO date or date-time (days since 1899-12-30, the time as a fraction). */
const excelSerial = (iso: string): number | undefined => {
  const match = ISO_DATE.exec(iso)
  if (match === null) return undefined
  const [, y, mo, d, h, mi, s] = match.map((part) => Number(part ?? 0))
  const millis = Date.UTC(y ?? 0, (mo ?? 1) - 1, d ?? 1, h ?? 0, mi ?? 0, s ?? 0)
  return (millis - Date.UTC(1899, 11, 30)) / 86_400_000
}

const styleOf = (attributes: string): string => {
  const style = attrOf(attributes, 's')
  return style === undefined ? '' : ` s="${style}"`
}

/** A cell written with a typed value: a number, a boolean, or text. */
const writeValue = (ref: string, attributes: string, value: unknown): string => {
  const style = styleOf(attributes)
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${ref}"${style}><v>${value}</v></c>`
  }
  if (typeof value === 'boolean') return `<c r="${ref}"${style} t="b"><v>${value ? 1 : 0}</v></c>`
  const serial = typeof value === 'string' ? excelSerial(value) : undefined
  if (serial !== undefined && /^\d{4}-\d{2}-\d{2}/.test(String(value))) {
    return `<c r="${ref}"${style}><v>${serial}</v></c>`
  }
  const text = value === undefined || value === null ? '' : String(value)
  return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`
}

/** An untagged cell, moved to `ref`, its formula's references following the rows. */
const writeKept = (
  cell: Cell,
  ref: string,
  insertions: ReadonlyArray<RowInsertion>,
  copy: number
): string => {
  const attributes = cell.attributes.replace(/(^|\s)r="[^"]*"/, `$1r="${ref}"`)
  const inner = cell.inner.replace(
    /(<f\b[^>]*>)([\s\S]*?)(<\/f>)/,
    (_all, open: string, formula: string, close: string) =>
      `${open}${escapeXml(moveReferences(decodeXmlText(formula), insertions, copy))}${close}`
  )
  return cell.inner === '' ? `<c${attributes}/>` : `<c${attributes}>${inner}</c>`
}

interface SheetContext {
  readonly data: Raw
  readonly render: XlsxRender
  readonly insertions: ReadonlyArray<RowInsertion>
}

/** Where a row of output lands: its row number, and which copy of a loop row it is (0 otherwise). */
interface Placement {
  readonly number: number
  readonly copy: number
}

/** One row of output: its cells, given the values its tagged cells rendered to. */
const writeRow = (
  row: Row,
  { number, copy }: Placement,
  rendered: ReadonlyArray<unknown>,
  context: SheetContext
): string => {
  const cells = row.cells.map((cell, index) => {
    const ref = `${cell.column}${number}`
    const value = rendered[index]
    return value === undefined
      ? writeKept(cell, ref, context.insertions, copy)
      : writeValue(ref, cell.attributes, value)
  })
  const attributes = row.attributes.replace(/(^|\s)r="[^"]*"/, `$1r="${number}"`)
  return `<row${attributes}>${cells.join('')}</row>`
}

const hasTags = (text: string | undefined): text is string =>
  text !== undefined && text.includes('{{')

/** What each cell of a plain row renders to: a typed value for a single tag, else text. */
const renderPlainRow = (row: Row, context: SheetContext): ReadonlyArray<unknown> =>
  row.cells.map((cell) => {
    if (!hasTags(cell.text)) return undefined
    const single = SINGLE_TAG.exec(cell.text)?.[1]
    const value = single === undefined ? undefined : lookup(single, context.data, undefined)
    return value !== undefined && typeof value !== 'object'
      ? value
      : context.render(cell.text, context.data)
  })

/** The list a loop row repeats over, and the cell texts with its open and close tags removed. */
const loopOf = (
  row: Row
): { readonly path: string; readonly texts: ReadonlyArray<string | undefined> } | undefined => {
  const first = row.cells[0]?.text
  const last = row.cells.at(-1)?.text
  const path = first === undefined ? undefined : EACH_OPEN.exec(first)?.[1]
  if (path === undefined || last === undefined || !EACH_CLOSE.test(last)) return undefined
  const texts = row.cells.map((cell, index) => {
    const opened = index === 0 ? (cell.text ?? '').replace(EACH_OPEN, '') : cell.text
    return index === row.cells.length - 1 ? (opened ?? '').replace(EACH_CLOSE, '') : opened
  })
  return { path, texts }
}

/** What each cell of each copy of a loop row renders to, item by item. */
const renderLoopRow = (
  path: string,
  texts: ReadonlyArray<string | undefined>,
  context: SheetContext
): ReadonlyArray<ReadonlyArray<unknown>> => {
  const items = lookup(path, context.data, undefined)
  const list = Array.isArray(items) ? items : []
  const perCell = texts.map((text) => {
    if (!hasTags(text)) return list.map(() => undefined)
    const single = SINGLE_TAG.exec(text)?.[1]
    const pieces = context
      .render(`{{#each ${path}}}${ITEM_SEPARATOR}${text}{{/each}}`, context.data)
      .split(ITEM_SEPARATOR)
      .slice(1)
    return list.map((item, index) => {
      const value = single === undefined ? undefined : lookup(single, context.data, item)
      return value !== undefined && typeof value !== 'object' ? value : (pieces[index] ?? '')
    })
  })
  return list.map((_, index) => perCell.map((values) => values[index]))
}

/** The row insertions a sheet's loop rows make, in template order. */
const insertionsOf = (rows: ReadonlyArray<Row>, data: Raw): ReadonlyArray<RowInsertion> =>
  rows.flatMap((row) => {
    const loop = loopOf(row)
    if (loop === undefined) return []
    const items = lookup(loop.path, data, undefined)
    return [{ row: row.number, added: (Array.isArray(items) ? items.length : 0) - 1 }]
  })

/** One worksheet, filled. */
const fillSheet = (xml: string, shared: ReadonlyArray<string>, input: XlsxFillInput): string => {
  const sheetData = /<sheetData\b[^>]*>([\s\S]*?)<\/sheetData>/.exec(xml)
  if (sheetData === null) return xml
  const rows = readRows(sheetData[1] ?? '', shared)
  const insertions = insertionsOf(rows, input.data)
  const context: SheetContext = { data: input.data, render: input.render, insertions }
  const written = rows.flatMap((row) => {
    const at = movedRow(row.number, insertions)
    const loop = loopOf(row)
    if (loop === undefined)
      return [writeRow(row, { number: at, copy: 0 }, renderPlainRow(row, context), context)]
    return renderLoopRow(loop.path, loop.texts, context).map((values, copy) =>
      writeRow(row, { number: at + copy, copy }, values, context)
    )
  })
  const filled = xml.replace(sheetData[0], `<sheetData>${written.join('')}</sheetData>`)
  return filled
    .replace(
      /(<mergeCell\b[^>]*\bref=")([^"]+)(")/g,
      (_a, open: string, ref: string, close: string) =>
        `${open}${moveReferences(ref, insertions)}${close}`
    )
    .replace(
      /(<dimension\b[^>]*\bref=")([^"]+)(")/,
      (_a, open: string, ref: string, close: string) =>
        `${open}${moveReferences(ref, insertions)}${close}`
    )
}

/** `xl/workbook.xml` marked to recalculate every formula when it opens. */
const recalculateOnOpen = (xml: string): string => {
  if (/<calcPr\b/.test(xml)) {
    return xml.replace(
      /<calcPr\b([^>]*?)(\/?)>/,
      (_all, attributes: string, slash: string) =>
        `<calcPr${attributes.replace(/\s*fullCalcOnLoad="[^"]*"/, '')} fullCalcOnLoad="1"${slash}>`
    )
  }
  return xml.replace('</sheets>', '</sheets><calcPr fullCalcOnLoad="1"/>')
}

/** A relationship or a content-type override naming the calculation chain, removed. */
const withoutCalcChain = (xml: string): string =>
  xml.replace(/<(?:Relationship|Override)\b[^>]*calcChain\.xml[^>]*\/>/g, '')

const WORKBOOK_TYPE = /spreadsheetml\.(?:sheet|template)\.main\+xml/

/** Fill a workbook template with `data`. See the module comment. */
export const fillXlsxTemplate = (input: XlsxFillInput): XlsxFillResult => {
  const notWorkbook = {
    ok: false,
    message: `template "${input.templateName}" is not an .xlsx workbook`,
  } as const
  const read = readOoxmlPackage(input.template)
  if (!read.ok) return notWorkbook
  const text = (name: string) => {
    const entry = read.entries.find((candidate) => candidate.name === name)
    return entry === undefined ? undefined : entryText(entry)
  }
  if (
    !WORKBOOK_TYPE.test(text('[Content_Types].xml') ?? '') ||
    text('xl/workbook.xml') === undefined
  ) {
    return notWorkbook
  }
  const shared = readSharedStrings(text('xl/sharedStrings.xml') ?? '')
  const entries = read.entries.flatMap((entry): ReadonlyArray<ZipEntry> => {
    // The calculation chain names cells by where they were; Excel rebuilds it.
    if (entry.name === 'xl/calcChain.xml') return []
    if (entry.name === 'xl/workbook.xml')
      return [textEntry(entry.name, recalculateOnOpen(entryText(entry)))]
    if (entry.name === 'xl/_rels/workbook.xml.rels' || entry.name === '[Content_Types].xml') {
      return [textEntry(entry.name, withoutCalcChain(entryText(entry)))]
    }
    return /^xl\/worksheets\/[^/]+\.xml$/.test(entry.name)
      ? [textEntry(entry.name, fillSheet(entryText(entry), shared, input))]
      : [entry]
  })
  return { ok: true, bytes: writeOoxmlPackage(entries), contentType: XLSX_TEMPLATE_CONTENT_TYPE }
}
