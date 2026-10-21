/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A Moment.js date pattern (the one Make's `formatDate` and `parseDate` read)
 * rewritten to the closed token set of Sovrium's `formatDate` / `parseDate`.
 *
 * Only tokens with an exact equivalent are rewritten. Any other letter — the
 * twelve-hour `hh`, `A`, `Do`, a quarter, a timestamp — makes the whole
 * pattern untranslatable, so the call stays a TODO rather than printing a
 * different date. A `[bracketed]` literal becomes a `'quoted'` one.
 */

/** Moment token → Sovrium token, longest first so `YYYY` wins over `YY`. */
const MOMENT_TOKENS: readonly (readonly [string, string])[] = [
  ['YYYY', 'yyyy'],
  ['MMMM', 'MMMM'],
  ['dddd', 'EEEE'],
  ['MMM', 'MMM'],
  ['ddd', 'EEE'],
  ['MM', 'MM'],
  ['DD', 'dd'],
  ['HH', 'HH'],
  ['mm', 'mm'],
  ['ss', 'ss'],
  ['D', 'd'],
]

const isLetter = (char: string): boolean => /^[A-Za-z]$/.test(char)

/**
 * One piece of a Moment.js pattern: a token, a character printed as itself,
 * or the text of a `[bracketed]` literal.
 */
export type MomentSegment =
  | { readonly kind: 'token'; readonly token: string }
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'literal'; readonly text: string }

/** A segment, and where the rest of the pattern starts. */
interface Head {
  readonly segment: MomentSegment
  readonly next: number
}

/** A `[bracketed]` literal. */
const literalAt = (pattern: string, at: number): Head | undefined => {
  const close = pattern.indexOf(']', at)
  const literal = close === -1 ? undefined : pattern.slice(at + 1, close)
  return literal === undefined || literal.includes("'")
    ? undefined
    : { segment: { kind: 'literal', text: literal }, next: close + 1 }
}

/** The segment at `at`, matched against `tokens` (longest first). */
const segmentAt = (pattern: string, at: number, tokens: readonly string[]): Head | undefined => {
  const char = pattern.charAt(at)
  if (char === '[') return literalAt(pattern, at)
  if (char === "'") return undefined
  if (!isLetter(char)) return { segment: { kind: 'text', text: char }, next: at + 1 }
  const token = tokens.find((candidate) => pattern.startsWith(candidate, at))
  return token === undefined
    ? undefined
    : { segment: { kind: 'token', token }, next: at + token.length }
}

const segmentsFrom = (
  pattern: string,
  at: number,
  tokens: readonly string[]
): readonly MomentSegment[] | undefined => {
  if (at >= pattern.length) return []
  const head = segmentAt(pattern, at, tokens)
  const rest = head === undefined ? undefined : segmentsFrom(pattern, head.next, tokens)
  return head === undefined || rest === undefined ? undefined : [head.segment, ...rest]
}

/**
 * A Moment.js pattern cut into segments, or `undefined` when it holds a letter
 * that is not one of `tokens`, a quote, or an unclosed bracket.
 *
 * `tokens` must list a longer token before any shorter one it starts with
 * (`YYYY` before `YY`), because the first that matches wins.
 */
export const segmentMomentPattern = (
  pattern: string,
  tokens: readonly string[]
): readonly MomentSegment[] | undefined => segmentsFrom(pattern, 0, tokens)

const MOMENT_TOKEN_NAMES = MOMENT_TOKENS.map(([moment]) => moment)
const SOVRIUM_TOKEN = new Map(MOMENT_TOKENS)

const sovriumText = (segment: MomentSegment): string => {
  if (segment.kind === 'literal') return `'${segment.text}'`
  return segment.kind === 'text' ? segment.text : (SOVRIUM_TOKEN.get(segment.token) ?? '')
}

/**
 * `YYYY-MM-DD HH:mm` → `yyyy-MM-dd HH:mm`, or `undefined` when the pattern
 * holds a token Sovrium has no exact equivalent for.
 */
export const convertMomentDateFormat = (pattern: string): string | undefined =>
  segmentMomentPattern(pattern, MOMENT_TOKEN_NAMES)?.map(sovriumText).join('')
