/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A bounded reader for ToolScript, the JSX-like markup a Retool classic app's
 * `.rsx` files are written in (the pinned Retool classic facts, b1 and b5).
 *
 * It reads the subset the format uses and nothing more: elements
 * (`<Type …>…</Type>` and `<Type … />`), and attributes whose value is a
 * string (`label="SKU"`), a JSX expression in braces (`required={true}`,
 * `size={100}`, `editableOptions={{ showStepper: true }}`), or nothing (a bare
 * name is `true`). A braced value is classified, never evaluated: a boolean, a
 * number, `null`, a string literal, an `include("…")` of a file of the app, or
 * else CODE, kept as its source text. A Retool binding (`{{ query.data }}`)
 * only ever sits inside a STRING value, so a braced object such as
 * `{{ showStepper: true }}` is code, not a binding.
 *
 * ─── BOUNDED, AND NOTHING RUNS ─────────────────────────────────────────────
 *
 * - The whole file is lexed by one regular expression whose braces are
 *   unrolled to {@link RSX_MAX_BRACE_DEPTH} levels: a brace nested deeper does
 *   not match, and the tag holding it is refused, never guessed through.
 *   Every alternative of the expression starts on a different character, so
 *   a malformed file fails in time proportional to its length.
 * - A file longer than `maxLength`, an element tree deeper than `maxDepth`, or
 *   more than `maxElements` elements refuses the file.
 * - Nothing is evaluated: there is no `eval`, no JavaScript parser, and a
 *   braced value is text.
 *
 * Pure: a string in, a tree or a reason out.
 */

/** A value an attribute holds, as the file writes it. */
export type RsxValue =
  | { readonly kind: 'string'; readonly value: string }
  | { readonly kind: 'boolean'; readonly value: boolean }
  | { readonly kind: 'number'; readonly value: number }
  | { readonly kind: 'null' }
  | { readonly kind: 'include'; readonly path: string }
  | { readonly kind: 'code'; readonly source: string }

/** One ToolScript element. */
export interface RsxElement {
  readonly type: string
  readonly attributes: ReadonlyMap<string, RsxValue>
  readonly children: readonly RsxElement[]
}

/** The bounds a `.rsx` file is read within. */
export interface RsxLimits {
  readonly maxLength: number
  readonly maxDepth: number
  readonly maxElements: number
}

/** The default bounds: far above the pinned export, far below what could exhaust the reader. */
export const RSX_LIMITS: RsxLimits = {
  maxLength: 4 * 1024 * 1024,
  maxDepth: 64,
  maxElements: 20_000,
}

/** The deepest nesting of braces a braced attribute value may hold. */
export const RSX_MAX_BRACE_DEPTH = 8

/** The file's top-level elements, or why it cannot be read. */
export type RsxRead =
  | { readonly ok: true; readonly elements: readonly RsxElement[] }
  | { readonly ok: false; readonly reason: string }

const quoted = (q: string): string => String.raw`${q}(?:[^${q}\\]|\\[\s\S])*${q}`

/** A JavaScript string literal, in any of its three quotes. */
const JS_STRING = [quoted('"'), quoted("'"), quoted('`')].join('|')

const PLAIN = '[^{}"\'`]'

/** A brace and what it holds, nested at most `depth` levels further. */
const braceOf = (depth: number): string =>
  depth === 0
    ? String.raw`\{(?:${PLAIN}|${JS_STRING})*\}`
    : String.raw`\{(?:${PLAIN}|${JS_STRING}|${braceOf(depth - 1)})*\}`

const BRACE = braceOf(RSX_MAX_BRACE_DEPTH - 1)
const NAME = String.raw`[A-Za-z_$][\w$.:-]*`
const ATTRIBUTE = String.raw`${NAME}(?:\s*=\s*(?:"[^"]*"|'[^']*'|${BRACE}))?`
const TAG = String.raw`<(\/?)(${NAME})((?:\s+${ATTRIBUTE})*)\s*(\/?)>`

/** One lexeme: a tag, text between tags, a braced child, or a character nothing else reads. */
const TOKEN = new RegExp(String.raw`${TAG}|([^<{]+)|(${BRACE})|([\s\S])`, 'gy')

const ATTRIBUTE_PARTS = new RegExp(
  String.raw`(${NAME})(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|(${BRACE})))?`,
  'g'
)

const INCLUDE = new RegExp(String.raw`^include\(\s*(${JS_STRING})\s*(?:,\s*(${JS_STRING})\s*)?\)$`)
const WHOLE_STRING = new RegExp(String.raw`^(?:${JS_STRING})$`)
const NUMBER = /^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i

const ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
}

/** A JSX attribute string, its five named entities and numeric references decoded. */
const decodeAttribute = (text: string): string =>
  text.replace(
    /&(?:(amp|lt|gt|quot|apos)|#(\d{1,7})|#x([0-9a-f]{1,6}));/gi,
    (whole: string, named?: string, dec?: string, hex?: string) => {
      if (named !== undefined) return ENTITIES[named.toLowerCase()] ?? whole
      const code = dec === undefined ? Number.parseInt(hex ?? '', 16) : Number.parseInt(dec, 10)
      return code <= 0x10_ff_ff ? String.fromCodePoint(code) : whole
    }
  )

const ESCAPES: Readonly<Record<string, string>> = { n: '\n', r: '\r', t: '\t' }

/** A JavaScript string literal's text: its quotes dropped, its simple escapes read. */
const stringLiteralText = (literal: string): string =>
  literal.slice(1, -1).replace(/\\([\s\S])/g, (_, char: string) => ESCAPES[char] ?? char)

/** What a braced value is, read as text and never run. */
const braceValueOf = (brace: string): RsxValue => {
  const inner = brace.slice(1, -1).trim()
  if (inner === 'true' || inner === 'false') return { kind: 'boolean', value: inner === 'true' }
  if (inner === 'null' || inner === 'undefined') return { kind: 'null' }
  if (NUMBER.test(inner)) return { kind: 'number', value: Number(inner) }
  if (WHOLE_STRING.test(inner)) return { kind: 'string', value: stringLiteralText(inner) }
  const include = INCLUDE.exec(inner)?.[1]
  return include === undefined
    ? { kind: 'code', source: inner }
    : { kind: 'include', path: stringLiteralText(include) }
}

/** The attributes a tag's attribute text holds, in order; a repeated name keeps its last value. */
const attributesOf = (text: string): ReadonlyMap<string, RsxValue> =>
  new Map(
    [...text.matchAll(ATTRIBUTE_PARTS)].map((match): readonly [string, RsxValue] => {
      const [, name = '', double, single, brace] = match
      if (double !== undefined) return [name, { kind: 'string', value: decodeAttribute(double) }]
      if (single !== undefined) return [name, { kind: 'string', value: decodeAttribute(single) }]
      return [name, brace === undefined ? { kind: 'boolean', value: true } : braceValueOf(brace)]
    })
  )

/** An element still open while its children are read. */
interface OpenElement {
  readonly type: string
  readonly attributes: ReadonlyMap<string, RsxValue>
  readonly children: readonly RsxElement[]
}

interface ReadState {
  readonly open: readonly OpenElement[]
  readonly roots: readonly RsxElement[]
  readonly count: number
  readonly error: string | undefined
}

const lineAt = (source: string, index: number): number => source.slice(0, index).split('\n').length

/** `element` appended to the innermost open element, or to the roots. */
const attach = (state: ReadState, element: RsxElement): ReadState => {
  const parent = state.open.at(-1)
  if (parent === undefined) return { ...state, roots: [...state.roots, element] }
  return {
    ...state,
    open: [...state.open.slice(0, -1), { ...parent, children: [...parent.children, element] }],
  }
}

const opened = (state: ReadState, element: OpenElement, limits: RsxLimits): ReadState => {
  if (state.count + 1 > limits.maxElements) {
    return { ...state, error: `holds more than ${limits.maxElements} elements` }
  }
  if (state.open.length + 1 > limits.maxDepth) {
    return { ...state, error: `nests elements deeper than ${limits.maxDepth} levels` }
  }
  return { ...state, count: state.count + 1, open: [...state.open, element] }
}

const closed = (state: ReadState, type: string, line: () => number): ReadState => {
  const top = state.open.at(-1)
  if (top?.type !== type) {
    return { ...state, error: `closes </${type}> at line ${line()} without opening it` }
  }
  return attach({ ...state, open: state.open.slice(0, -1) }, top)
}

/** One tag read into the tree. */
const readTag = (
  state: ReadState,
  match: readonly (string | undefined)[],
  line: () => number,
  limits: RsxLimits
): ReadState => {
  const [, slash, type = '', attributeText = '', selfClosing] = match
  if (slash === '/') return closed(state, type, line)
  const element = { type, attributes: attributesOf(attributeText), children: [] }
  const withOpen = opened(state, element, limits)
  if (withOpen.error !== undefined || selfClosing !== '/') return withOpen
  return closed(withOpen, type, line)
}

/** The file a token is read from, and its bounds. */
interface ReadContext {
  readonly source: string
  readonly limits: RsxLimits
}

const readToken = (
  state: ReadState,
  match: readonly (string | undefined)[],
  index: number,
  { source, limits }: ReadContext
): ReadState => {
  if (state.error !== undefined) return state
  const line = () => lineAt(source, index)
  if (match[2] !== undefined) return readTag(state, match, line, limits)
  if (match[7] === undefined) return state
  return {
    ...state,
    error: `holds markup at line ${line()} that is not a ToolScript element, or braces nested deeper than ${RSX_MAX_BRACE_DEPTH} levels`,
  }
}

/**
 * Read one `.rsx` file into its elements.
 *
 * @param source - the file's text.
 * @param limits - the bounds it is read within.
 */
export const readToolScript = (source: string, limits: RsxLimits = RSX_LIMITS): RsxRead => {
  if (source.length > limits.maxLength) {
    return { ok: false, reason: `is longer than ${limits.maxLength} characters` }
  }
  const tokens = [...source.matchAll(TOKEN)]
  // The tokens are sticky, so together they cover the file from its first
  // character. When they stop short, the expression gave up on a lexeme too
  // large for the engine (an attribute string of a few hundred thousand
  // characters): the rest of the file was never read, and is refused rather
  // than taken as empty.
  const last = tokens.at(-1)
  const read = last === undefined ? 0 : (last.index ?? 0) + last[0].length
  if (read !== source.length) {
    return {
      ok: false,
      reason: `holds a value at line ${lineAt(source, read)} too long to read`,
    }
  }
  const state = tokens.reduce<ReadState>(
    (acc, match) => readToken(acc, [...match], match.index ?? 0, { source, limits }),
    { open: [], roots: [], count: 0, error: undefined }
  )
  if (state.error !== undefined) return { ok: false, reason: state.error }
  const unclosed = state.open.at(-1)
  return unclosed === undefined
    ? { ok: true, elements: state.roots }
    : { ok: false, reason: `never closes <${unclosed.type}>` }
}

/** An attribute's string value, when it holds one. */
export const stringAttribute = (element: RsxElement, name: string): string | undefined => {
  const value = element.attributes.get(name)
  return value?.kind === 'string' ? value.value : undefined
}
