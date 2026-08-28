/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * XML primitives and OOXML part decoders for the `.xlsx` codec.
 *
 * The parsing is deliberately pattern-based rather than a full XML tree walk.
 * That is only defensible because the SUBSET is closed (see `parse-xlsx.ts`):
 * we read a known handful of element shapes out of parts we have already
 * verified carry nothing outside that subset. A general OOXML consumer would
 * need a real parser; this one refuses everything a real parser would be needed
 * for.
 */

/** Named XML entities, plus numeric forms, as they appear in SpreadsheetML. */
const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
}

/** Decode XML text content — named entities plus decimal/hex character refs. */
export const decodeXmlText = (raw: string): string =>
  raw.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      return String.fromCodePoint(Number.parseInt(body.slice(2), 16))
    }
    if (body.startsWith('#')) return String.fromCodePoint(Number.parseInt(body.slice(1), 10))
    return NAMED_ENTITIES[body] ?? whole
  })

/** Read one attribute off a raw start-tag body (`r="A1" t="s"`). */
export const attrOf = (tag: string, name: string): string | undefined =>
  new RegExp(`(?:^|\\s)${name.replace(':', '\\:')}\\s*=\\s*"([^"]*)"`).exec(tag)?.[1]

/**
 * All matches of `pattern` (which must be global) as a plain array.
 *
 * `Readonly<RegExp>` rather than `RegExp` because the FP lint rules judge the
 * built-in as mutable; `matchAll` clones the regex internally, so no `lastIndex`
 * state leaks between calls and the readonly view is honest.
 */
export const allMatches = (
  source: string,
  pattern: Readonly<RegExp>
): ReadonlyArray<RegExpMatchArray> => [...source.matchAll(pattern as RegExp)]

/**
 * Inner text of every `<t>` element inside a shared-string item.
 *
 * Concatenating rather than taking the first is what makes RICH TEXT work: a
 * styled string is stored as several `<r><t>` runs whose concatenation is the
 * logical value, and taking only the first would silently truncate it to its
 * first formatting run.
 */
const T_PATTERN = /<t\b[^>]*\/>|<t\b[^>]*>([\s\S]*?)<\/t>/g

export const innerText = (fragment: string): string =>
  allMatches(fragment, T_PATTERN)
    .map((m) => decodeXmlText(m[1] ?? ''))
    .join('')

const SI_PATTERN = /<si\b[^>]*\/>|<si\b[^>]*>([\s\S]*?)<\/si>/g

/** `xl/sharedStrings.xml` -> the string table, indexed as `t="s"` cells cite it. */
export const readSharedStrings = (xml: string): ReadonlyArray<string> =>
  allMatches(xml, SI_PATTERN).map((m) => innerText(m[1] ?? ''))

// ---------------------------------------------------------------------------
// Styles — the ONLY thing separating a date from a number in OOXML
// ---------------------------------------------------------------------------

/**
 * Built-in number-format ids that denote a date or time (ECMA-376 §18.8.30).
 * A cell whose style resolves to one of these carries a date SERIAL; the very
 * same `<v>` without that style is a plain number.
 */
const BUILTIN_DATE_NUM_FMTS: ReadonlySet<number> = new Set([
  14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47,
])

const NUM_FMT_PATTERN = /<numFmt\b([^>]*)\/?>/g
const XF_PATTERN = /<xf\b([^>]*?)\/?>/g

/**
 * A custom format code is a date format when — with quoted literals removed —
 * it still contains a year/day token or a month token. `m` is ambiguous in
 * OOXML (month vs minute), but either reading makes the cell temporal, which is
 * the only distinction this codec draws.
 */
const isDateFormatCode = (code: string): boolean =>
  /[yd]/i.test(code.replace(/"[^"]*"/g, '')) || /m/i.test(code.replace(/"[^"]*"/g, ''))

/** Custom `numFmtId -> formatCode` pairs declared in `<numFmts>`. */
const readCustomNumFmts = (xml: string): ReadonlyMap<number, string> =>
  new Map(
    allMatches(xml, NUM_FMT_PATTERN).flatMap((m) => {
      const id = Number(attrOf(m[1] ?? '', 'numFmtId'))
      const code = attrOf(m[1] ?? '', 'formatCode')
      return Number.isFinite(id) && code !== undefined ? ([[id, decodeXmlText(code)]] as const) : []
    })
  )

/**
 * `xl/styles.xml` -> the set of `cellXfs` INDEXES that render as a date.
 *
 * Only the `<cellXfs>` block is read: `<cellStyleXfs>` holds `<xf>` elements
 * too, and folding both together shifts every style index a cell cites.
 */
export const readDateStyleIndexes = (xml: string): ReadonlySet<number> => {
  const customs = readCustomNumFmts(xml)
  const block = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(xml)?.[1]
  if (block === undefined) return new Set()
  const dated = allMatches(block, XF_PATTERN).flatMap((m, index) => {
    const id = Number(attrOf(m[1] ?? '', 'numFmtId'))
    if (!Number.isFinite(id)) return []
    const custom = customs.get(id)
    const isDate = custom === undefined ? BUILTIN_DATE_NUM_FMTS.has(id) : isDateFormatCode(custom)
    return isDate ? [index] : []
  })
  return new Set(dated)
}

// ---------------------------------------------------------------------------
// Workbook part + relationships
// ---------------------------------------------------------------------------

export interface SheetRef {
  readonly name: string
  readonly relationshipId: string
}

const SHEET_PATTERN = /<sheet\b([^>]*?)\/?>/g
const RELATIONSHIP_PATTERN = /<Relationship\b([^>]*?)\/?>/g

/** `xl/workbook.xml` -> the declared sheets, in the order the tabs appear. */
export const readSheetRefs = (xml: string): ReadonlyArray<SheetRef> =>
  allMatches(xml, SHEET_PATTERN).flatMap((m) => {
    const name = attrOf(m[1] ?? '', 'name')
    const relationshipId = attrOf(m[1] ?? '', 'r:id') ?? attrOf(m[1] ?? '', 'id')
    return name !== undefined && relationshipId !== undefined
      ? [{ name: decodeXmlText(name), relationshipId }]
      : []
  })

/** `xl/_rels/workbook.xml.rels` -> `Id -> Target`. */
export const readRelationships = (xml: string): ReadonlyMap<string, string> =>
  new Map(
    allMatches(xml, RELATIONSHIP_PATTERN).flatMap((m) => {
      const id = attrOf(m[1] ?? '', 'Id')
      const target = attrOf(m[1] ?? '', 'Target')
      return id !== undefined && target !== undefined
        ? ([[id, decodeXmlText(target)] as const] as const)
        : []
    })
  )

/**
 * Resolve a relationship target against the part that declared it.
 *
 * A leading `/` means "from the package root"; anything else is relative to the
 * declaring part's directory (`xl/` for the workbook rels).
 */
export const resolveRelTarget = (base: string, target: string): string =>
  target.startsWith('/') ? target.slice(1) : `${base}${target}`
