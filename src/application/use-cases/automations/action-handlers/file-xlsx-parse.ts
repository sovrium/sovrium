/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  allMatches,
  attrOf,
  decodeXmlText,
  innerText,
  readDateStyleIndexes,
  readRelationships,
  readSharedStrings,
  readSheetRefs,
  resolveRelTarget,
} from './file-xlsx-xml'
import { readZipEntries } from './file-zip-read'

/**
 * `.xlsx` reader over the CLOSED OOXML subset declared in
 * `src/domain/models/app/automations/actions/file/parse-xlsx.ts`.
 *
 * ## Where the subset boundary actually falls
 *
 * The declared rule is "everything outside the subset is refused by name". The
 * operative reading, and the one implemented here, is: a package is refused
 * when it contains a part that carries DATA OUTSIDE THE CELL GRID — a chart, a
 * drawing, an embedded image, a pivot table, a macro. Reading such a file
 * would hand back the cells and silently drop the part of the document the
 * author probably cared about, which is exactly the failure the closed subset
 * exists to make impossible.
 *
 * Cosmetic style records — fonts, fills, borders — are NOT refused; they are
 * ignored. They carry no data, and refusing them would refuse essentially every
 * real workbook, which makes the action useless rather than safe. The one style
 * fact this reader does consume is `numFmt`, because in OOXML a date is a plain
 * number plus a date format and nothing else.
 *
 * ## Values
 *
 * Dates are surfaced as ISO 8601 STRINGS, not `Date` objects: a step output is
 * JSON-persisted to run history, re-read by templates and returned in the
 * webhook body, and a `Date` survives none of those hops with its type intact.
 * An ISO string does, and is unambiguous at every one of them.
 */

/**
 * An empty cell is `undefined`, not `null`: `JSON.stringify` renders both as
 * `null` INSIDE an array, so the wire shape a caller sees is identical, and
 * `undefined` is the repo-wide spelling for absence.
 */
export type XlsxCell = string | number | boolean | undefined

export interface XlsxParsed {
  readonly sheetNames: ReadonlyArray<string>
  readonly sheetName: string
  readonly rows: ReadonlyArray<ReadonlyArray<XlsxCell>>
}

export type XlsxReadResult =
  | { readonly ok: true; readonly parsed: XlsxParsed }
  | { readonly ok: false; readonly message: string }

// ---------------------------------------------------------------------------
// Subset gate
// ---------------------------------------------------------------------------

interface FeatureRule {
  readonly test: RegExp
  readonly feature: string
}

/** Parts whose presence means the workbook carries data outside the cell grid. */
const UNSUPPORTED_PARTS: ReadonlyArray<FeatureRule> = [
  { test: /^xl\/charts?\//i, feature: 'chart' },
  { test: /^xl\/chartsheets\//i, feature: 'chart' },
  { test: /^xl\/drawings\//i, feature: 'drawing' },
  { test: /^xl\/media\//i, feature: 'embedded image' },
  { test: /^xl\/pivot(Tables|Cache)\//i, feature: 'pivot table' },
  { test: /^xl\/macrosheets\//i, feature: 'macro' },
  { test: /vbaProject\.bin$/i, feature: 'macro' },
]

/**
 * The same features as declared in `[Content_Types].xml`. Checked IN ADDITION
 * to the part names because the two can disagree: a package may declare a chart
 * override whose part lives at a non-standard path, or ship a part with no
 * override at all. Refusing on either is the conservative direction.
 */
const UNSUPPORTED_CONTENT_TYPES: ReadonlyArray<FeatureRule> = [
  { test: /chart/i, feature: 'chart' },
  { test: /drawing/i, feature: 'drawing' },
  { test: /pivot/i, feature: 'pivot table' },
  { test: /macroEnabled|vbaProject/i, feature: 'macro' },
]

const OVERRIDE_PATTERN = /<Override\b([^>]*?)\/?>/g

/** First out-of-subset feature found, as `feature` + the evidence that named it. */
const findUnsupportedFeature = (
  names: ReadonlyArray<string>,
  contentTypesXml: string | undefined
): { readonly feature: string; readonly evidence: string } | undefined => {
  const byPart = names.flatMap((name) => {
    const rule = UNSUPPORTED_PARTS.find((r) => r.test.test(name))
    return rule ? [{ feature: rule.feature, evidence: name }] : []
  })
  if (byPart[0]) return byPart[0]

  const byType = allMatches(contentTypesXml ?? '', OVERRIDE_PATTERN).flatMap((m) => {
    const contentType = attrOf(m[1] ?? '', 'ContentType') ?? ''
    const rule = UNSUPPORTED_CONTENT_TYPES.find((r) => r.test.test(contentType))
    return rule
      ? [{ feature: rule.feature, evidence: attrOf(m[1] ?? '', 'PartName') ?? contentType }]
      : []
  })
  return byType[0]
}

// ---------------------------------------------------------------------------
// Cell decoding
// ---------------------------------------------------------------------------

const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30)
const DAY_MS = 86_400_000

/**
 * Excel numbers the non-existent 1900-02-29 as serial 60, so every serial below
 * it sits one day ahead of the 1899-12-30 anchor that is correct from 61 on.
 */
const serialToIso = (serial: number): string =>
  new Date(
    (serial < 60 ? EXCEL_EPOCH_UTC + DAY_MS : EXCEL_EPOCH_UTC) + serial * DAY_MS
  ).toISOString()

const V_PATTERN = /<v\b[^>]*>([\s\S]*?)<\/v>/
const IS_PATTERN = /<is\b[^>]*>([\s\S]*?)<\/is>/

interface CellContext {
  readonly sharedStrings: ReadonlyArray<string>
  readonly dateStyles: ReadonlySet<number>
}

/**
 * Cells whose `t` attribute fully determines the value; `undefined` for the
 * numeric case, which needs the style index too.
 *
 * `str` is a formula's cached STRING result and `e` is an error literal
 * (`#DIV/0!`); both are surfaced verbatim rather than refused, because each is
 * a value the authoring application itself displays — not a feature we cannot
 * read.
 */
const decodeTaggedCell = (type: string, raw: string, ctx: CellContext): XlsxCell => {
  if (type === 's') return ctx.sharedStrings[Number(raw)] ?? ''
  if (type === 'b') return raw.trim() === '1'
  if (type === 'str' || type === 'e') return decodeXmlText(raw)
  if (type === 'd') return raw
  return undefined
}

/** A bare `<v>`: a number, unless its style says the serial is a date. */
const decodeNumericCell = (raw: string, attrs: string, ctx: CellContext): XlsxCell => {
  const numeric = Number(raw)
  if (!Number.isFinite(numeric)) return decodeXmlText(raw)
  const styleIndex = Number(attrOf(attrs, 's') ?? Number.NaN)
  return ctx.dateStyles.has(styleIndex) ? serialToIso(numeric) : numeric
}

/**
 * Decode one `<c>` element to its value.
 *
 * A formula cell is read through its CACHED `<v>` and its `<f>` is never
 * evaluated — Sovrium ships no formula engine, and inventing one would make the
 * answer disagree with what the authoring application last displayed.
 */
const decodeCell = (attrs: string, body: string, ctx: CellContext): XlsxCell => {
  const type = attrOf(attrs, 't') ?? 'n'
  if (type === 'inlineStr') return innerText(IS_PATTERN.exec(body)?.[1] ?? '')
  const raw = V_PATTERN.exec(body)?.[1]
  if (raw === undefined) return undefined
  return decodeTaggedCell(type, raw, ctx) ?? decodeNumericCell(raw, attrs, ctx)
}

/** `"BC12"` -> 54. Falls back to `fallback` when the cell carries no `r`. */
const columnIndexOf = (ref: string | undefined, fallback: number): number => {
  const letters = /^[A-Za-z]+/.exec(ref ?? '')?.[0]
  if (letters === undefined) return fallback
  return (
    [...letters.toUpperCase()].reduce((acc, ch) => acc * 26 + (ch.codePointAt(0) ?? 0) - 64, 0) - 1
  )
}

// ---------------------------------------------------------------------------
// A1-style ranges
// ---------------------------------------------------------------------------

const A1_RANGE_PATTERN = /^([A-Za-z]+)(\d+):([A-Za-z]+)(\d+)$/

export interface CellRange {
  readonly firstRow: number
  readonly lastRow: number
  readonly firstColumn: number
  readonly lastColumn: number
}

/**
 * Parse an A1-style range such as `"A1:C10"`, or `undefined` when malformed.
 *
 * Validated HERE rather than in the schema because `range` is a template
 * string: a config-time pattern check would reject a legitimate
 * `"{{trigger.data.range}}"` that only resolves to `A1:C10` at run time.
 */
export const parseCellRange = (raw: string): CellRange | undefined => {
  const match = A1_RANGE_PATTERN.exec(raw.trim())
  if (match === null) return undefined
  const [, startColumn, startRow, endColumn, endRow] = match
  return {
    firstRow: Number(startRow) - 1,
    lastRow: Number(endRow) - 1,
    firstColumn: columnIndexOf(startColumn, 0),
    lastColumn: columnIndexOf(endColumn, 0),
  }
}

/** Clip an A1-anchored grid to `range`. */
export const applyCellRange = (
  rows: ReadonlyArray<ReadonlyArray<XlsxCell>>,
  range: CellRange
): ReadonlyArray<ReadonlyArray<XlsxCell>> =>
  rows
    .slice(range.firstRow, range.lastRow + 1)
    .map((row) => row.slice(range.firstColumn, range.lastColumn + 1))

const CELL_PATTERN = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g
const ROW_PATTERN = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g

/** One `<row>` -> `[absoluteRowIndex, cellsByColumnIndex]`. */
const decodeRow = (
  attrs: string,
  body: string,
  ctx: CellContext,
  fallbackIndex: number
): readonly [number, ReadonlyMap<number, XlsxCell>] => {
  const declared = Number(attrOf(attrs, 'r') ?? Number.NaN)
  const rowIndex = Number.isFinite(declared) ? declared - 1 : fallbackIndex
  const cells = allMatches(body, CELL_PATTERN).map(
    (m, i) =>
      [columnIndexOf(attrOf(m[1] ?? '', 'r'), i), decodeCell(m[1] ?? '', m[2] ?? '', ctx)] as const
  )
  return [rowIndex, new Map(cells)]
}

/**
 * Materialise a worksheet into a rectangular grid anchored at A1.
 *
 * Anchoring absolutely (rather than packing rows together) is what keeps an
 * A1-style `range` meaningful: a gap in the middle of a sheet stays a gap
 * instead of silently closing up and shifting every row beneath it.
 */
const decodeSheetGrid = (xml: string, ctx: CellContext): ReadonlyArray<ReadonlyArray<XlsxCell>> => {
  const rows = allMatches(xml, ROW_PATTERN).map((m, i) => decodeRow(m[1] ?? '', m[2] ?? '', ctx, i))
  if (rows.length === 0) return []
  const height = Math.max(...rows.map(([index]) => index + 1))
  const width = Math.max(
    0,
    ...rows.flatMap(([, cells]) => [...cells.keys()].map((column) => column + 1))
  )
  const byRow = new Map(rows)
  return Array.from({ length: height }, (_unused, rowIndex) => {
    const cells = byRow.get(rowIndex)
    return Array.from({ length: width }, (_u, column) => cells?.get(column))
  })
}

// ---------------------------------------------------------------------------
// Package walk
// ---------------------------------------------------------------------------

const WORKBOOK_PART = 'xl/workbook.xml'
const WORKBOOK_RELS_PART = 'xl/_rels/workbook.xml.rels'

/** Resolve `sheet` (name, index, or absent) against the declared sheet order. */
const selectSheet = (
  names: ReadonlyArray<string>,
  sheet: string | number | undefined
): number | undefined => {
  if (sheet === undefined) return names.length > 0 ? 0 : undefined
  if (typeof sheet === 'number') return sheet < names.length ? sheet : undefined
  const byName = names.indexOf(sheet)
  if (byName !== -1) return byName
  // A numeric string reaches here when the index arrived through a template
  // (`{{trigger.data.sheet}}`), which resolves every value to a string.
  const asIndex = Number(sheet)
  return Number.isInteger(asIndex) && asIndex >= 0 && asIndex < names.length ? asIndex : undefined
}

/** Resolve a sheet's worksheet part path from the workbook relationships. */
const worksheetPartFor = (
  relationships: ReadonlyMap<string, string>,
  relationshipId: string
): string | undefined => {
  const target = relationships.get(relationshipId)
  return target === undefined ? undefined : resolveRelTarget('xl/', target)
}

const decodeText = (bytes: Uint8Array | undefined): string | undefined =>
  bytes === undefined ? undefined : new TextDecoder().decode(bytes)

type PartMap = ReadonlyMap<string, Uint8Array>

/**
 * Open the package: read the container, then run the subset gate BEFORE any
 * cell is looked at, so an out-of-subset workbook can never half-parse.
 */
const openPackage = (
  bytes: Uint8Array
):
  | { readonly ok: true; readonly parts: PartMap }
  | { readonly ok: false; readonly message: string } => {
  const entries = readZipEntries(bytes)
  if (entries === undefined) {
    return { ok: false, message: 'not a valid .xlsx package: no readable ZIP container found' }
  }
  const parts: PartMap = new Map(entries.map((entry) => [entry.name, entry.bytes] as const))
  const unsupported = findUnsupportedFeature(
    [...parts.keys()],
    decodeText(parts.get('[Content_Types].xml'))
  )
  return unsupported === undefined
    ? { ok: true, parts }
    : {
        ok: false,
        message: `unsupported .xlsx feature: ${unsupported.feature} (${unsupported.evidence}). parseXlsx reads a closed subset — strings, numbers, booleans, numFmt dates and cached formula values only`,
      }
}

interface LocatedSheet {
  readonly names: ReadonlyArray<string>
  readonly name: string
  readonly xml: string
}

/** Resolve the requested sheet to its worksheet XML, or name what was missing. */
const locateSheet = (
  parts: PartMap,
  sheet: string | number | undefined
):
  | { readonly ok: true; readonly sheet: LocatedSheet }
  | { readonly ok: false; readonly message: string } => {
  const workbookXml = decodeText(parts.get(WORKBOOK_PART))
  if (workbookXml === undefined) {
    return { ok: false, message: `not a valid .xlsx workbook: ${WORKBOOK_PART} is missing` }
  }
  const refs = readSheetRefs(workbookXml)
  const names = refs.map((ref) => ref.name)
  const index = selectSheet(names, sheet)
  const selected = index === undefined ? undefined : refs[index]
  if (selected === undefined) {
    return {
      ok: false,
      message: `sheet not found: ${JSON.stringify(sheet)} (workbook has ${JSON.stringify(names)})`,
    }
  }
  const relationships = readRelationships(decodeText(parts.get(WORKBOOK_RELS_PART)) ?? '')
  const part = worksheetPartFor(relationships, selected.relationshipId)
  const xml = part === undefined ? undefined : decodeText(parts.get(part))
  return xml === undefined
    ? {
        ok: false,
        message: `not a valid .xlsx workbook: worksheet part for sheet ${JSON.stringify(selected.name)} is missing`,
      }
    : { ok: true, sheet: { names, name: selected.name, xml } }
}

/**
 * Read a `.xlsx` package into a single sheet's grid, or a NAMED failure.
 *
 * Never returns partial data: an unreadable container, an out-of-subset
 * feature, a missing workbook part and an unknown sheet all fail, because each
 * of them would otherwise read downstream as "the sheet had no rows".
 */
export const readXlsx = (bytes: Uint8Array, sheet: string | number | undefined): XlsxReadResult => {
  const opened = openPackage(bytes)
  if (!opened.ok) return opened
  const located = locateSheet(opened.parts, sheet)
  if (!located.ok) return located

  const { parts } = opened
  const selected = located.sheet
  const ctx: CellContext = {
    sharedStrings: readSharedStrings(decodeText(parts.get('xl/sharedStrings.xml')) ?? ''),
    dateStyles: readDateStyleIndexes(decodeText(parts.get('xl/styles.xml')) ?? ''),
  }
  return {
    ok: true,
    parsed: {
      sheetNames: selected.names,
      sheetName: selected.name,
      rows: decodeSheetGrid(selected.xml, ctx),
    },
  }
}
