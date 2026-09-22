/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Text, case and number helper implementations.
 *
 * Extracted from `handlebars-helpers.ts` verbatim where the behaviour already
 * existed, so that file can become a registration table. New implementations
 * fill the declared-but-unregistered census.
 */

import { Result } from 'effect'
import { stripHtmlToText } from '@/domain/kernel/sanitize/html-sanitization'
import { toNumber, toStr } from './helper-coercion'

// ─── tokenisation ────────────────────────────────────────────────────────

/**
 * Tokenise a free-form string into "words" for case conversion. Splits on
 * whitespace, underscores/hyphens, camelCase boundaries, and acronym-then-camel
 * boundaries.
 */
export const tokenize = (input: string): readonly string[] =>
  input
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[\s_-]+/u)
    .filter((token) => token.length > 0)

const upperFirst = (token: string): string => token.charAt(0).toUpperCase() + token.slice(1)

// ─── case conversion ─────────────────────────────────────────────────────

export const camelCase = (input: string): string => {
  const tokens = tokenize(input)
  if (tokens.length === 0) return ''
  const head = tokens[0]?.toLowerCase() ?? ''
  const tail = tokens
    .slice(1)
    .map((token) => upperFirst(token.toLowerCase()))
    .join('')
  return head + tail
}

export const pascalCase = (input: string): string => upperFirst(camelCase(input))

export const snakeCase = (input: string): string =>
  tokenize(input)
    .map((token) => token.toLowerCase())
    .join('_')

export const kebabCase = (input: string): string =>
  tokenize(input)
    .map((token) => token.toLowerCase())
    .join('-')

export const titleCase = (input: string): string =>
  tokenize(input)
    .map((token) => upperFirst(token.toLowerCase()))
    .join(' ')

/**
 * `{{sentenceCase v}}` — capitalise the FIRST letter only, lowercasing the
 * rest: "hello WORLD" → "Hello world".
 *
 * Distinct from both siblings, which is why it earns a name: `capitalize`
 * upper-cases every word while preserving spacing, and `titleCase` upper-cases
 * every word while NORMALISING spacing. Only this one produces prose.
 */
export const sentenceCase = (input: string): string => {
  const trimmedLower = input.toLowerCase()
  const firstLetter = trimmedLower.search(/\p{L}/u)
  return firstLetter === -1
    ? trimmedLower
    : trimmedLower.slice(0, firstLetter) +
        trimmedLower.charAt(firstLetter).toUpperCase() +
        trimmedLower.slice(firstLetter + 1)
}

/** Capitalise each word, preserving the original whitespace runs. */
export const capitalizePreservingWords = (input: string): string =>
  input
    .split(/(\s+)/)
    .map((part) => (/\s+/.test(part) ? part : upperFirst(part.toLowerCase())))
    .join('')

export const slugify = (input: string): string =>
  input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

// ─── HTML ────────────────────────────────────────────────────────────────

/** Delegates to the canonical parser-based stripper — never an ad-hoc regex. */
export const stripHtml = (input: string): string => stripHtmlToText(input)

export const escapeHtml = (input: string): string =>
  input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

/**
 * `{{unescapeHtml v}}` — exact inverse of `escapeHtml` over the five entities
 * that helper produces.
 *
 * `&amp;` is decoded LAST, mirroring the order `escapeHtml` encodes it first.
 * Decoding it first would turn `&amp;lt;` into `&lt;` and then into `<`,
 * corrupting text that legitimately contained an escaped entity.
 *
 * Deliberately NOT a general HTML entity decoder: it handles what its inverse
 * produces and nothing else, so `&copy;` passes through untouched rather than
 * implying a decoding table this helper does not have.
 */
export const unescapeHtml = (input: string): string =>
  input
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')

// ─── string operations ───────────────────────────────────────────────────

/**
 * `{{replace haystack search replacement}}` — replaces EVERY occurrence, not
 * just the first. `{{replaceAll}}` is registered as an alias of this exact
 * behaviour, because that is the name an author reaches for when they mean
 * "all" and a silent miss would be indistinguishable from a no-op.
 */
export const replaceAll = (input: string, search: string, replacement: string): string =>
  search === '' ? input : input.split(search).join(replacement)

export const truncate = (input: string, limit: number, suffix: string): string =>
  !Number.isFinite(limit) || input.length <= limit ? input : input.slice(0, limit) + suffix

/**
 * `{{wordCount v}}` — whitespace-delimited words. Empty and whitespace-only
 * input count as 0, not 1, which is what a naive `split(' ').length` returns.
 */
export const wordCount = (input: string): number =>
  input.split(/\s+/u).filter((word) => word.length > 0).length

/**
 * `{{repeat v n}}` — bounded on purpose. `String.prototype.repeat` will happily
 * try to allocate gigabytes and throw `RangeError`, and a template argument is
 * author-supplied config that can be wrong. The cap turns a would-be crash
 * into a merely-large string.
 */
const MAX_REPEAT = 10_000

export const repeat = (input: string, count: number): string => {
  if (!Number.isFinite(count) || count <= 0) return ''
  return input.repeat(Math.min(Math.floor(count), MAX_REPEAT))
}

/**
 * `{{reverse v}}` — reverses by Unicode code point, not UTF-16 code unit, so
 * astral characters (emoji) survive. `[...str]` iterates code points; a plain
 * `split('')` would tear surrogate pairs in half and produce mojibake.
 */
export const reverseString = (input: string): string => [...input].toReversed().join('')

/**
 * `{{pluralize count singular plural}}` — chooses a form; it does NOT inflect.
 *
 * Explicit forms rather than a morphology guess: English pluralisation is
 * irregular (person/people, child/children) and Sovrium is a bilingual
 * product, so a `+ "s"` rule would be confidently wrong in two languages. The
 * author supplies both forms and this picks between them.
 *
 * The plural form is optional; omitted, it falls back to `singular + "s"` for
 * the common regular case, which keeps the two-argument call ergonomic.
 */
export const pluralize = (count: number, singular: string, plural?: string): string =>
  count === 1 ? singular : (plural ?? `${singular}s`)

// ─── number formatting ───────────────────────────────────────────────────

export const clamp = (value: number, low: number, high: number): number =>
  Math.min(Math.max(value, low), high)

/**
 * `{{percentage part whole [digits]}}` — `part` as a percentage OF `whole`.
 *
 * The two-argument part/whole form is chosen over a one-argument `value * 100`
 * because it is unambiguous at the call site: `{{percentage 25 200}}` can only
 * mean one thing, whereas `{{percentage 0.25}}` reads equally well as "25%" or
 * "0.25%". A zero denominator yields "" rather than `Infinity`.
 */
export const percentage = (part: number, whole: number, digits: number): string => {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole === 0) return ''
  const ratio = (part / whole) * 100
  return Number.isFinite(digits) ? ratio.toFixed(digits) : String(ratio)
}

/**
 * `{{formatNumber value [digits] [locale]}}` — locale-aware grouping, the
 * numeric sibling of the existing `formatCurrency`. Defaults to `en-US` for
 * determinism; the host locale would make output machine-dependent.
 */
export const formatNumber = (value: number, digits?: number, locale?: string): string => {
  if (!Number.isFinite(value)) return ''
  const options: Readonly<Intl.NumberFormatOptions> =
    digits === undefined || !Number.isFinite(digits)
      ? {}
      : { minimumFractionDigits: digits, maximumFractionDigits: digits }
  try {
    return new Intl.NumberFormat(locale ?? 'en-US', options).format(value)
  } catch {
    return String(value)
  }
}

/**
 * Variadic numeric reduce for `{{min}}` / `{{max}}`. Returns "" for no operands
 * rather than `Infinity`/`-Infinity`, which are the mathematically correct but
 * operationally useless identities of these folds.
 */
export const numericFold = (
  operands: readonly unknown[],
  pick: (a: number, b: number) => number
): number | string => {
  const numbers = operands.map(toNumber).filter((n) => Number.isFinite(n))
  // The reducer is wrapped rather than passed straight to `reduce`. Passing
  // `Math.min` directly is a classic trap: `reduce` invokes it as
  // `(acc, value, index, array)`, and `Math.min` is variadic, so the index and
  // the array itself become operands — the array coerces to NaN and poisons
  // the whole fold. Verified: `{{min 5 2 9}}` rendered "NaN" before this wrap.
  return numbers.length === 0 ? '' : numbers.reduce((a, b) => pick(a, b))
}

/** Shared by `{{isEven}}` / `{{isOdd}}`; a non-integer is neither. */
export const parityOf = (value: unknown, wanted: 0 | 1): boolean => {
  const n = toNumber(value)
  return Number.isInteger(n) && Math.abs(n % 2) === wanted
}

// ─── extraction ──────────────────────────────────────────────────────────

const EMAIL_RE_G = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
const URL_RE_G = /https?:\/\/[^\s<>"']+/g
const NUMBER_RE_G = /-?\d+(?:\.\d+)?/g

/** All matches of a fixed pattern — the plural of the `extract*` singulars. */
export const extractAll = (input: string, kind: 'email' | 'url' | 'number'): readonly string[] => {
  const pattern = kind === 'email' ? EMAIL_RE_G : kind === 'url' ? URL_RE_G : NUMBER_RE_G
  return input.match(pattern) ?? []
}

/**
 * `{{matchAll value pattern [flags]}}` — every match of an author-supplied
 * regex, as an array.
 *
 * The `g` flag is forced on regardless of what the author passed: without it
 * `String.prototype.matchAll` throws `TypeError`, and a helper named "matchAll"
 * that failed on a non-global pattern would be a trap rather than a tool. When
 * the pattern has a capture group, group 1 is returned per match — matching the
 * established `{{regex}}` convention.
 */
export const matchAll = (input: string, pattern: string, flags: string): readonly string[] => {
  if (pattern === '') return []
  const withGlobal = flags.includes('g') ? flags : `${flags}g`
  const compiled = Result.try({
    // The pattern IS the feature: `{{matchAll}}` exists so an app author can supply a
    // regular expression from config, and escaping it would compile the pattern as
    // a literal and break every use. The enclosing `Result.try` catches a SYNTAX
    // error only, so catastrophic backtracking in an operator-authored pattern is
    // unmitigated — accepted because config is authored by the operator, who
    // already controls the process.
    // eslint-disable-next-line sovrium/no-dynamic-regexp -- operator-supplied pattern is the documented feature
    try: () => new RegExp(pattern, withGlobal),
    catch: () => undefined,
  })
  if (Result.isFailure(compiled)) return []
  return [...input.matchAll(compiled.success)].map((match) => match[1] ?? match[0])
}

/** Shared string coercion re-export so registrations import from one place. */
export { toStr, toNumber }
