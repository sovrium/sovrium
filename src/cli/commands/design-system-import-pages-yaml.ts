/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Editing a value IN PLACE in a YAML page entry written in block form, so a page write
 * changes the edited value's line and nothing else: not the comments around
 * it, not the quoting of its neighbours, not the order of its keys.
 *
 * ─── WHY A LOCATOR, NOT A YAML LIBRARY ─────────────────────────────────────
 *
 * `Bun.YAML` parses and stringifies, and keeps no source position or comment,
 * so it cannot tell where a value was written. Rather than take a
 * comment-preserving YAML library as a new dependency, this reads the one
 * shape a page entry is written in by hand — block mappings and sequences,
 * each scalar on its own line — and records, for each scalar, the line and the
 * columns it occupies. Anything else (a flow collection, a multi-line scalar,
 * an anchor) is simply not recorded, and a change touching it is left to the
 * caller's whole-entry rewrite.
 *
 * ─── WHAT COUNTS AS AN IN-PLACE EDIT ───────────────────────────────────────
 *
 * The entry before and after has the same shape — the same keys in every
 * mapping, the same length in every sequence — and only scalars differ. Each
 * differing scalar is rewritten in its own quoting style when the new value
 * can be written in it, single-quoted otherwise, and read back to prove it
 * parses to the new value. Any other change (a node moved, added, removed, a
 * key gained) answers `undefined`, and the caller rewrites the entry.
 */

/** Where one scalar of an entry was written: its line and the columns of its value. */
interface ScalarSite {
  readonly line: number
  readonly from: number
  readonly to: number
}

type Path = readonly (string | number)[]

const keyOf = (path: Path): string => JSON.stringify(path)

/** Whether a line holds nothing but whitespace or a comment. */
const isInsignificant = (line: string): boolean => {
  const trimmed = line.trim()
  return trimmed === '' || trimmed.startsWith('#')
}

const indentOf = (line: string): number => line.length - line.trimStart().length

/** The next line at or after `from` holding YAML content, or `-1`. */
const nextSignificant = (lines: readonly string[], from: number): number => {
  const index = lines.findIndex((line, at) => at >= from && !isInsignificant(line))
  return index
}

/**
 * The columns a scalar written from `start` on a line occupies, its trailing
 * comment excluded; `undefined` for a value this locator does not edit (a
 * flow collection, a block scalar indicator, an anchor, an alias, a tag).
 */
const scalarSpanOf = (line: string, start: number): { readonly to: number } | undefined => {
  const text = line.slice(start)
  const first = text[0]
  // A flow collection, a block scalar indicator, an anchor, an alias or a tag.
  if (first === undefined || /^[[{|>&*!]/.test(first)) return undefined
  if (first === "'") {
    const close = /^'(?:[^']|'')*'/.exec(text)
    return close === null ? undefined : { to: start + close[0].length }
  }
  if (first === '"') {
    const close = /^"(?:[^"\\]|\\.)*"/.exec(text)
    return close === null ? undefined : { to: start + close[0].length }
  }
  const comment = text.search(/\s#/)
  const value = (comment === -1 ? text : text.slice(0, comment)).trimEnd()
  return { to: start + value.length }
}

/** A mapping key at a column: `key:` or a quoted key, and the column its value starts at. */
const mappingKeyAt = (
  line: string,
  column: number
): { readonly key: string; readonly valueAt: number } | undefined => {
  const text = line.slice(column)
  const match = /^('(?:[^']|'')*'|"(?:[^"\\]|\\.)*"|[^\s'"#][^:#]*?)\s*:(?:\s+|$)/.exec(text)
  if (match === null) return undefined
  const raw = match[1] ?? ''
  const key = raw.startsWith("'")
    ? raw.slice(1, -1).replaceAll("''", "'")
    : raw.startsWith('"')
      ? (JSON.parse(raw) as string)
      : raw.trimEnd()
  return { key, valueAt: column + match[0].length }
}

/** What reading one node yields: its scalar sites, and the line after it. */
interface Read {
  readonly sites: ReadonlyMap<string, ScalarSite>
  readonly next: number
}

const merge = (
  left: ReadonlyMap<string, ScalarSite>,
  right: ReadonlyMap<string, ScalarSite>
): ReadonlyMap<string, ScalarSite> => new Map([...left, ...right])

/** A position in the lines, and the path of the node written from it. */
interface At {
  readonly line: number
  readonly column: number
  readonly path: Path
}

const NOTHING: ReadonlyMap<string, ScalarSite> = new Map()

/** Whether the text from a column on holds a value rather than nothing or a comment. */
const holdsValue = (rest: string): boolean =>
  rest.trim() !== '' && !rest.trimStart().startsWith('#')

type Lines = readonly string[]

const textAt = (lines: Lines, line: number): string => lines[line] ?? ''

const opensItem = (lines: Lines, line: number): boolean =>
  textAt(lines, line).trimStart().startsWith('-')

/** The node whose first token sits at `at`: a sequence when it opens with `-`, else a mapping. */
const readNode = (lines: Lines, at: At): Read =>
  textAt(lines, at.line).slice(at.column).startsWith('-')
    ? readSequence(lines, at, 0, NOTHING)
    : readMapping(lines, at, NOTHING)

/** A value written on its own key's line: a scalar, or a compact mapping or sequence. */
const readInline = (lines: Lines, at: At, compactMapping: boolean): Read => {
  const text = textAt(lines, at.line)
  const rest = text.slice(at.column)
  if (compactMapping && mappingKeyAt(text, at.column) !== undefined) {
    return readMapping(lines, at, NOTHING)
  }
  if (rest.startsWith('- ') || rest === '-') return readNode(lines, at)
  const span = scalarSpanOf(text, at.column)
  const site = { line: at.line, from: at.column, to: span?.to ?? at.column }
  return {
    sites: span === undefined ? NOTHING : new Map([[keyOf(at.path), site]]),
    next: at.line + 1,
  }
}

/** A value written on the lines below its key, deeper than `parent` (or a same-indent sequence). */
const readBelow = (lines: Lines, at: At, parent: number): Read => {
  const below = nextSignificant(lines, at.line + 1)
  if (below === -1) return { sites: NOTHING, next: lines.length }
  const depth = indentOf(textAt(lines, below))
  const sameIndentSequence = depth === parent && textAt(lines, below).trimStart().startsWith('- ')
  if (depth <= parent && !sameIndentSequence) return { sites: NOTHING, next: at.line + 1 }
  return readNode(lines, { line: below, column: depth, path: at.path })
}

/** The value of a key or an item written from `at`, on its line or below it. */
const readValue = (lines: Lines, at: At, parent: number, compactMapping: boolean): Read =>
  holdsValue(textAt(lines, at.line).slice(at.column))
    ? readInline(lines, at, compactMapping)
    : readBelow(lines, at, parent)

/** The line after `next` continuing a block at `column`, or `undefined`. */
const continuing = (lines: Lines, next: number, column: number): number | undefined => {
  const following = nextSignificant(lines, next)
  return following === -1 || indentOf(textAt(lines, following)) !== column ? undefined : following
}

function readMapping(lines: Lines, at: At, sites: ReadonlyMap<string, ScalarSite>): Read {
  const entry = mappingKeyAt(textAt(lines, at.line), at.column)
  if (entry === undefined) return { sites, next: at.line }
  const keyAt = { line: at.line, column: entry.valueAt, path: [...at.path, entry.key] }
  const value = readValue(lines, keyAt, at.column, false)
  const merged = merge(sites, value.sites)
  const following = continuing(lines, value.next, at.column)
  if (following === undefined || opensItem(lines, following)) {
    return { sites: merged, next: value.next }
  }
  return readMapping(lines, { ...at, line: following }, merged)
}

function readSequence(
  lines: Lines,
  at: At,
  index: number,
  sites: ReadonlyMap<string, ScalarSite>
): Read {
  const text = textAt(lines, at.line)
  if (!text.slice(at.column).startsWith('-')) return { sites, next: at.line }
  const valueAt = at.column + (/^-\s*/.exec(text.slice(at.column))?.[0].length ?? 1)
  const itemAt = { line: at.line, column: valueAt, path: [...at.path, index] }
  const value = readValue(lines, itemAt, at.column, true)
  const merged = merge(sites, value.sites)
  const following = continuing(lines, value.next, at.column)
  if (following === undefined || !opensItem(lines, following)) {
    return { sites: merged, next: value.next }
  }
  return readSequence(lines, { ...at, line: following }, index + 1, merged)
}

type Scalar = string | number | boolean | null

const isScalar = (value: unknown): value is Scalar =>
  value === null || ['string', 'number', 'boolean'].includes(typeof value)

type Changes = readonly Path[] | undefined

/** Two scalars: the path when they differ. */
const scalarChange = (before: unknown, after: unknown, path: Path): Changes => {
  if (!isScalar(before) || !isScalar(after)) return undefined
  return before === after ? [] : [path]
}

/** Two sequences of one length, item by item. */
const sequenceChanges = (before: unknown, after: unknown, path: Path): Changes => {
  if (!Array.isArray(before) || !Array.isArray(after) || before.length !== after.length) {
    return undefined
  }
  return collect(before.map((item, index) => scalarChanges(item, after[index], [...path, index])))
}

const field = (value: object, key: string): unknown =>
  (value as Readonly<Record<string, unknown>>)[key]

/** Two mappings with one key set, key by key. */
const mappingChanges = (before: unknown, after: unknown, path: Path): Changes => {
  if (typeof before !== 'object' || typeof after !== 'object' || before === null || after === null)
    return undefined
  const left = Object.keys(before).toSorted()
  if (left.join('\u0000') !== Object.keys(after).toSorted().join('\u0000')) return undefined
  return collect(
    left.map((key) => scalarChanges(field(before, key), field(after, key), [...path, key]))
  )
}

/**
 * The paths of every scalar that differs between two values of the same
 * shape, or `undefined` when their shapes differ.
 */
function scalarChanges(before: unknown, after: unknown, path: Path): Changes {
  if (isScalar(before) || isScalar(after)) return scalarChange(before, after, path)
  if (Array.isArray(before) || Array.isArray(after)) return sequenceChanges(before, after, path)
  return mappingChanges(before, after, path)
}

const collect = (parts: readonly (readonly Path[] | undefined)[]): readonly Path[] | undefined =>
  parts.some((part) => part === undefined) ? undefined : parts.flatMap((part) => part ?? [])

/** Whether `written`, read as the value of a key, is exactly `value`. */
const readsAs = (written: string, value: Scalar): boolean => {
  try {
    return (Bun.YAML.parse(`k: ${written}`) as { readonly k?: unknown })?.k === value
  } catch {
    // Not YAML at all: certainly not the value.
    return false
  }
}

/** A scalar written in the quoting style of what it replaces, or single-quoted when it cannot be. */
const writtenScalar = (value: Scalar, previous: string): string | undefined => {
  const single = typeof value === 'string' ? `'${value.replaceAll("'", "''")}'` : undefined
  const candidates =
    typeof value !== 'string'
      ? [String(value)]
      : previous.startsWith("'")
        ? [single ?? '']
        : previous.startsWith('"')
          ? [JSON.stringify(value)]
          : [value, single ?? '']
  return candidates.find((candidate) => candidate !== '' && readsAs(candidate, value))
}

/** The lines of a YAML node with its changed scalars rewritten in place, its sites keyed under `prefix`. */
const patchInPlace = (
  lines: readonly string[],
  change: { readonly before: unknown; readonly after: unknown },
  prefix: Path
): readonly string[] | undefined => {
  const changes = scalarChanges(change.before, change.after, [])
  if (changes === undefined) return undefined
  if (changes.length === 0) return lines
  const first = nextSignificant(lines, 0)
  if (first === -1) return undefined
  const { sites } = readNode(lines, {
    line: first,
    column: indentOf(lines[first] ?? ''),
    path: [],
  })
  const edits = changes.map((path) => {
    const site = sites.get(keyOf([...prefix, ...path]))
    const value = path.reduce<unknown>(
      (node, step) => (node as Readonly<Record<string | number, unknown>>)[step],
      change.after
    ) as Scalar
    const line = site === undefined ? undefined : lines[site.line]
    const written =
      site === undefined || line === undefined
        ? undefined
        : writtenScalar(value, line.slice(site.from, site.to))
    return site === undefined || written === undefined ? undefined : { site, written }
  })
  if (edits.some((edit) => edit === undefined)) return undefined
  return edits.reduce<readonly string[]>((acc, edit) => {
    if (edit === undefined) return acc
    const { site, written } = edit
    const line = acc[site.line] ?? ''
    return acc.with(site.line, `${line.slice(0, site.from)}${written}${line.slice(site.to)}`)
  }, lines)
}

/**
 * The lines of one YAML entry with only its changed scalars rewritten in
 * place, or `undefined` when the change is not a set of scalar edits this
 * locator can place.
 *
 * @param lines - the entry's lines as written, its first line opening `- `.
 * @param before - the entry as those lines parse.
 * @param after - the entry to write.
 */
export const patchYamlEntryInPlace = (
  lines: readonly string[],
  before: unknown,
  after: unknown
): readonly string[] | undefined => patchInPlace(lines, { before, after }, [0])

/**
 * A whole YAML document with only its changed scalars rewritten in place, as
 * an entry is: a `$ref` partial holding one page, a fragment, a language's
 * translations or a part of `design`. `undefined` when the change is not a set
 * of scalar edits this locator can place.
 *
 * @param lines - the document's lines.
 * @param before - the document as those lines parse.
 * @param after - the document to write.
 */
export const patchYamlDocumentInPlace = (
  lines: readonly string[],
  before: unknown,
  after: unknown
): readonly string[] | undefined => patchInPlace(lines, { before, after }, [])

/** Whether two values have one shape, so only their scalars differ. */
export const isScalarEdit = (before: unknown, after: unknown): boolean =>
  scalarChanges(before, after, []) !== undefined

/** One scalar to set in place, by its path from the document root. */
export interface YamlScalarEdit {
  readonly path: readonly string[]
  readonly value: string
}

/**
 * A whole YAML document with some existing string scalars rewritten in place,
 * each in its own quoting style, every other line untouched; `undefined` when
 * a path names no scalar written on its own line, which the caller refuses
 * rather than re-lay out the file.
 *
 * @param lines - the document's lines.
 * @param edits - the scalars to set, by path from the root mapping.
 */
export const patchYamlScalarsInPlace = (
  lines: readonly string[],
  edits: readonly YamlScalarEdit[]
): readonly string[] | undefined => {
  const first = lines.findIndex((line) => !isInsignificant(line) && !line.startsWith('---'))
  if (first === -1 || indentOf(lines[first] ?? '') !== 0) return undefined
  const { sites } = readMapping(lines, { line: first, column: 0, path: [] }, NOTHING)
  const placed = edits.map((edit) => {
    const site = sites.get(keyOf(edit.path))
    const line = site === undefined ? undefined : lines[site.line]
    const written =
      site === undefined || line === undefined
        ? undefined
        : writtenScalar(edit.value, line.slice(site.from, site.to))
    return site === undefined || written === undefined ? undefined : { site, written }
  })
  if (placed.some((edit) => edit === undefined)) return undefined
  return placed.reduce<readonly string[]>((acc, edit) => {
    if (edit === undefined) return acc
    const { site, written } = edit
    const line = acc[site.line] ?? ''
    return acc.with(site.line, `${line.slice(0, site.from)}${written}${line.slice(site.to)}`)
  }, lines)
}
