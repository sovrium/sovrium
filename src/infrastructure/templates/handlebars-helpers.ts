/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable functional/prefer-immutable-types -- Handlebars instance is
   inherently mutable: registerHelper(name, fn) imperatively mutates the
   internal helper map. Parameter types must accept the mutable instance. */

import { createHash } from 'node:crypto'
import { DateTime, Either, Option } from 'effect'
import type Handlebars from 'handlebars'

// ─── value coercion ──────────────────────────────────────────────────────

/**
 * Coerce a Handlebars helper argument to a number for arithmetic operations.
 * Handlebars passes the last argument as the helper "options" object — that
 * must never be treated as a numeric operand. Any non-finite result becomes
 * NaN (which `String(NaN)` renders as "NaN" — matches user expectation that
 * arithmetic on a non-numeric input is loudly wrong, not silently zero).
 */
const toNumber = (value: unknown): number => {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : NaN
  }
  if (typeof value === 'boolean') return value ? 1 : 0
  return NaN
}

/**
 * Coerce a Handlebars helper argument to a string. `null`/`undefined` map to
 * the empty string so missing-trigger-data references render as "" rather
 * than the literal "undefined" — matches the behaviour established by the
 * legacy {{path}} resolver in `resolve-trigger-data.ts`.
 */
const toStr = (value: unknown): string => {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  // Objects/arrays render via JSON so callers can use them as scalar leaves
  // when needed (the spec doesn't currently exercise this but keeps the
  // helper total).
  return JSON.stringify(value)
}

const padNumber = (value: number, width: number): string => String(value).padStart(width, '0')

// ─── case + tokenisation ─────────────────────────────────────────────────

/**
 * Tokenise a free-form string into "words" suitable for case conversion.
 * Splits on whitespace, underscores/hyphens, camelCase boundaries, and
 * acronym-then-camel boundaries. Drops empty tokens.
 */
const tokenize = (input: string): readonly string[] =>
  input
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[\s_-]+/u)
    .filter((token) => token.length > 0)

const camelCase = (input: string): string => {
  const tokens = tokenize(input)
  if (tokens.length === 0) return ''
  const head = tokens[0]?.toLowerCase() ?? ''
  const tail = tokens
    .slice(1)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join('')
  return head + tail
}

const snakeCase = (input: string): string =>
  tokenize(input)
    .map((token) => token.toLowerCase())
    .join('_')

const kebabCase = (input: string): string =>
  tokenize(input)
    .map((token) => token.toLowerCase())
    .join('-')

const titleCase = (input: string): string =>
  tokenize(input)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(' ')

const slugify = (input: string): string =>
  input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

const capitalizePreservingWords = (input: string): string =>
  input
    .split(/(\s+)/)
    .map((part) =>
      /\s+/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
    )
    .join('')

// ─── HTML helpers ────────────────────────────────────────────────────────

/**
 * Strip HTML tags from a string. The spec expects "<h1>Hello</h1><p>World</p>"
 * to render as "HelloWorld" (no whitespace inserted between tag boundaries),
 * so this is simple tag removal — no spacing logic.
 */
const stripHtml = (input: string): string => input.replace(/<[^>]*>/g, '')

const escapeHtml = (input: string): string =>
  input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

// ─── date helpers ────────────────────────────────────────────────────────

/**
 * Effect.DateTime-based date formatter. Supports the format tokens the spec
 * exercises (`YYYY`, `MM`, `DD`, `HH`, `mm`, `ss`).
 *
 * `DateTime.make` returns `Option<DateTime>` — we treat parse failures as
 * the empty string so a malformed input cannot crash an automation.
 */
const formatDateWithTokens = (iso: string, format: string): string => {
  const parsedOpt = DateTime.make(iso)
  if (Option.isNone(parsedOpt)) return ''
  const parts = DateTime.toPartsUtc(parsedOpt.value)
  return format
    .replace(/YYYY/g, padNumber(parts.year, 4))
    .replace(/MM/g, padNumber(parts.month, 2))
    .replace(/DD/g, padNumber(parts.day, 2))
    .replace(/HH/g, padNumber(parts.hours, 2))
    .replace(/mm/g, padNumber(parts.minutes, 2))
    .replace(/ss/g, padNumber(parts.seconds, 2))
}

/**
 * Add `days` calendar days to an ISO 8601 timestamp and return a new ISO
 * string. The spec composes this with `formatDate` (`{{formatDate (addDays X
 * 30) "YYYY-MM-DD"}}`) so the intermediate value must round-trip through the
 * Handlebars helper boundary as a string.
 */
const addDays = (iso: string, days: number): string => {
  const parsedOpt = DateTime.make(iso)
  if (Option.isNone(parsedOpt)) return iso
  const shifted = DateTime.add(parsedOpt.value, { days })
  return DateTime.toDateUtc(shifted).toISOString()
}

/** Current timestamp as an ISO 8601 string — shared by `now` / `currentDateTime` / `today`. */
const isoNow = (): string => new Date().toISOString()

const computeDateDiffInDays = (a: string, b: string): number => {
  const da = DateTime.make(a)
  const db = DateTime.make(b)
  if (Option.isNone(da) || Option.isNone(db)) return 0
  const ms = DateTime.toDateUtc(da.value).getTime() - DateTime.toDateUtc(db.value).getTime()
  return Math.round(ms / 86_400_000)
}

// ─── extraction patterns ─────────────────────────────────────────────────

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
const URL_RE = /https?:\/\/[^\s<>"']+/
const NUMBER_RE = /-?\d+(?:\.\d+)?/

const tryParseUrl = (input: string): URL | undefined => {
  const result = Either.try({
    try: () => new URL(input),
    catch: () => undefined,
  })
  return Either.isRight(result) ? result.right : undefined
}

const safeUriDecode = (input: unknown): string => {
  const result = Either.try({
    try: () => decodeURIComponent(toStr(input)),
    catch: () => '',
  })
  return Either.isRight(result) ? result.right : ''
}

// ─── `if` helper (works in both inline and block form) ──────────────────

const isTruthyValue = (cond: unknown): boolean =>
  cond !== false && cond !== null && cond !== undefined && cond !== '' && cond !== 0

const inlineIf = (cond: unknown, truthy: unknown, falsy: unknown): unknown =>
  isTruthyValue(cond) ? truthy : falsy

/**
 * `{{if}}` that supports BOTH calling conventions:
 *
 *   - Inline:  `{{if cond truthy falsy}}`         (current spec — APP-AUTOMATION-TEMPLATE-HELPER-014)
 *   - Block:   `{{#if cond}}A{{else}}B{{/if}}`    (documented in
 *              `docs/infrastructure/automations/template-engine.md` and used
 *              freely in user-authored automations once the engine is exposed)
 *
 * Handlebars passes its `options` object as the LAST argument. In block form,
 * `options.fn` is the truthy template renderer and `options.inverse` is the
 * `{{else}}` branch. In inline form, the last argument is still an `options`
 * object but lacks `fn`/`inverse` (it's a plain hash bag) — we discriminate
 * on `typeof options.fn === 'function'`. This restores the convention the
 * built-in block `if` provides while keeping the inline form the spec needs.
 */
const ifHelper = function (this: unknown, ...args: readonly unknown[]): unknown {
  const last = args[args.length - 1]
  const isBlockForm =
    last !== null &&
    typeof last === 'object' &&
    'fn' in last &&
    typeof (last as { fn: unknown }).fn === 'function'
  if (isBlockForm) {
    const options = last as { fn: (ctx: unknown) => string; inverse: (ctx: unknown) => string }
    const cond = args[0]
    return isTruthyValue(cond) ? options.fn(this) : options.inverse(this)
  }
  return inlineIf(args[0], args[1], args[2])
}

// ─── helper registration, by category ────────────────────────────────────

type Hbs = typeof Handlebars

const registerTextHelpers = (hbs: Hbs): void => {
  hbs.registerHelper('uppercase', (value: unknown) => toStr(value).toUpperCase())
  hbs.registerHelper('lowercase', (value: unknown) => toStr(value).toLowerCase())
  hbs.registerHelper('capitalize', (value: unknown) => capitalizePreservingWords(toStr(value)))
  hbs.registerHelper('trim', (value: unknown) => toStr(value).trim())
}

const registerCaseHelpers = (hbs: Hbs): void => {
  hbs.registerHelper('camelCase', (value: unknown) => camelCase(toStr(value)))
  hbs.registerHelper('snakeCase', (value: unknown) => snakeCase(toStr(value)))
  hbs.registerHelper('kebabCase', (value: unknown) => kebabCase(toStr(value)))
  hbs.registerHelper('titleCase', (value: unknown) => titleCase(toStr(value)))
  hbs.registerHelper('pascalCase', (value: unknown) => {
    const camel = camelCase(toStr(value))
    return camel.charAt(0).toUpperCase() + camel.slice(1)
  })
}

const registerStringHelpers = (hbs: Hbs): void => {
  hbs.registerHelper('replace', (input: unknown, search: unknown, replacement: unknown) => {
    const haystack = toStr(input)
    const needle = toStr(search)
    if (needle === '') return haystack
    return haystack.split(needle).join(toStr(replacement))
  })
  hbs.registerHelper('truncate', (input: unknown, length: unknown, suffix: unknown) => {
    const haystack = toStr(input)
    const limit = toNumber(length)
    if (!Number.isFinite(limit) || haystack.length <= limit) return haystack
    return haystack.slice(0, limit) + toStr(suffix)
  })
  hbs.registerHelper('slugify', (value: unknown) => slugify(toStr(value)))
  hbs.registerHelper('stripHtml', (value: unknown) => stripHtml(toStr(value)))
  hbs.registerHelper('escapeHtml', (value: unknown) => escapeHtml(toStr(value)))
  hbs.registerHelper('split', (input: unknown, separator: unknown) =>
    toStr(input).split(toStr(separator))
  )
  hbs.registerHelper('substring', (input: unknown, start: unknown, end: unknown) =>
    toStr(input).substring(toNumber(start), toNumber(end))
  )
  hbs.registerHelper('concat', (...args: readonly unknown[]) =>
    args
      .slice(0, -1)
      .map((value) => toStr(value))
      .join('')
  )
}

const registerNumberHelpers = (hbs: Hbs): void => {
  hbs.registerHelper('add', (a: unknown, b: unknown) => toNumber(a) + toNumber(b))
  hbs.registerHelper('subtract', (a: unknown, b: unknown) => toNumber(a) - toNumber(b))
  hbs.registerHelper('multiply', (a: unknown, b: unknown) => toNumber(a) * toNumber(b))
  hbs.registerHelper('divide', (a: unknown, b: unknown) => {
    const denom = toNumber(b)
    return denom === 0 ? 0 : toNumber(a) / denom
  })
  hbs.registerHelper('modulo', (a: unknown, b: unknown) => {
    const denom = toNumber(b)
    return denom === 0 ? 0 : toNumber(a) % denom
  })
  hbs.registerHelper('round', (value: unknown, digits: unknown) => {
    const n = toNumber(value)
    const d = toNumber(digits)
    if (!Number.isFinite(n)) return ''
    if (!Number.isFinite(d) || d === 0) return Math.round(n)
    const factor = 10 ** d
    return (Math.round(n * factor) / factor).toFixed(d)
  })
  hbs.registerHelper('ceil', (value: unknown) => Math.ceil(toNumber(value)))
  hbs.registerHelper('floor', (value: unknown) => Math.floor(toNumber(value)))
  hbs.registerHelper('toFixed', (value: unknown, digits: unknown) =>
    toNumber(value).toFixed(toNumber(digits))
  )
  hbs.registerHelper('formatCurrency', (value: unknown, currency: unknown) => {
    const n = toNumber(value)
    if (!Number.isFinite(n)) return ''
    const code = toStr(currency) || 'USD'
    const result = Either.try({
      try: () => new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(n),
      catch: () => `${code} ${n.toFixed(2)}`,
    })
    return Either.isRight(result) ? result.right : result.left
  })
}

const registerDateHelpers = (hbs: Hbs): void => {
  hbs.registerHelper('formatDate', (value: unknown, format: unknown) =>
    formatDateWithTokens(toStr(value), toStr(format))
  )
  hbs.registerHelper('addDays', (value: unknown, days: unknown) =>
    addDays(toStr(value), toNumber(days))
  )
  hbs.registerHelper('subtractDays', (value: unknown, days: unknown) =>
    addDays(toStr(value), -toNumber(days))
  )
  hbs.registerHelper('dateDiff', (a: unknown, b: unknown) =>
    computeDateDiffInDays(toStr(a), toStr(b))
  )
  hbs.registerHelper('now', isoNow)
  // `currentDateTime` is an alias of `now` — the cross-cutting
  // action-feature spec convention names the current-timestamp helper
  // `currentDateTime`. Single impl so the two never drift.
  hbs.registerHelper('currentDateTime', isoNow)
  hbs.registerHelper('today', () => isoNow().slice(0, 10))
}

/**
 * `{{regex value pattern [flags]}}` — match `pattern` against `value` and
 * return the FIRST capture group (group 1) when the pattern has one, or the
 * whole match otherwise. No match (or an invalid pattern) renders the empty
 * string — consistent with the extraction helpers' "unresolvable → ''"
 * contract so a misconfigured pattern never crashes the automation engine.
 *
 * Example: `{{regex "INV-2025-0078" "INV-\\d{4}-(\\d+)"}}` → `"0078"`.
 */
const regexHelper = (value: unknown, pattern: unknown, flags?: unknown): string => {
  const source = toStr(value)
  const patternStr = typeof pattern === 'string' ? pattern : ''
  if (patternStr === '') return ''
  const flagStr = typeof flags === 'string' ? flags : ''
  const re = (() => {
    try {
      return new RegExp(patternStr, flagStr)
    } catch {
      return undefined
    }
  })()
  if (re === undefined) return ''
  const match = source.match(re)
  if (match === null) return ''
  return match[1] ?? match[0]
}

const registerExtractionHelpers = (hbs: Hbs): void => {
  hbs.registerHelper('extractEmail', (value: unknown) => {
    const match = toStr(value).match(EMAIL_RE)
    return match ? match[0] : ''
  })
  hbs.registerHelper('extractUrl', (value: unknown) => {
    const match = toStr(value).match(URL_RE)
    return match ? match[0] : ''
  })
  hbs.registerHelper('extractNumber', (value: unknown) => {
    const match = toStr(value).match(NUMBER_RE)
    return match ? match[0] : ''
  })
  hbs.registerHelper('extractDomain', (value: unknown) => {
    const url = tryParseUrl(toStr(value))
    return url === undefined ? '' : url.hostname
  })
  hbs.registerHelper('extractPath', (value: unknown) => {
    const url = tryParseUrl(toStr(value))
    return url === undefined ? '' : url.pathname
  })
  hbs.registerHelper('regex', regexHelper)
}

const registerCollectionHelpers = (hbs: Hbs): void => {
  hbs.registerHelper('first', (value: unknown) =>
    Array.isArray(value) ? (value[0] ?? '') : toStr(value).charAt(0)
  )
  hbs.registerHelper('last', (value: unknown) => {
    if (Array.isArray(value)) return value[value.length - 1] ?? ''
    const str = toStr(value)
    return str.charAt(str.length - 1)
  })
  hbs.registerHelper('at', (value: unknown, index: unknown) => {
    const i = toNumber(index)
    if (Array.isArray(value)) return value[i] ?? ''
    return toStr(value).charAt(i)
  })
  hbs.registerHelper('length', (value: unknown) => {
    if (Array.isArray(value)) return value.length
    if (value !== null && typeof value === 'object') return Object.keys(value).length
    return toStr(value).length
  })
  hbs.registerHelper('keys', (value: unknown) =>
    value !== null && typeof value === 'object' ? Object.keys(value) : []
  )
  hbs.registerHelper('values', (value: unknown) =>
    value !== null && typeof value === 'object' ? Object.values(value) : []
  )
  hbs.registerHelper('join', (value: unknown, separator: unknown) => {
    const sep = toStr(separator)
    if (Array.isArray(value)) return value.map((item) => toStr(item)).join(sep)
    return toStr(value)
  })
  hbs.registerHelper('slice', (value: unknown, start: unknown, end: unknown) => {
    const s = toNumber(start)
    const e = toNumber(end)
    if (Array.isArray(value)) return Number.isFinite(e) ? value.slice(s, e) : value.slice(s)
    return Number.isFinite(e) ? toStr(value).slice(s, e) : toStr(value).slice(s)
  })
  hbs.registerHelper('unique', (value: unknown) =>
    Array.isArray(value) ? [...new Set(value)] : value
  )
  hbs.registerHelper('contains', (haystack: unknown, needle: unknown) => {
    if (Array.isArray(haystack)) return haystack.some((item) => toStr(item) === toStr(needle))
    return toStr(haystack).includes(toStr(needle))
  })
}

const registerLogicHelpers = (hbs: Hbs): void => {
  // `{{if}}` overrides Handlebars's built-in to support BOTH block form
  // (`{{#if cond}}A{{/if}}`) AND inline form (`{{if cond truthy falsy}}`).
  // See `ifHelper` above for the dispatch logic. `ifValue` is the explicit
  // inline-only alias for callers who want unambiguous semantics.
  hbs.registerHelper('if', ifHelper)
  hbs.registerHelper('ifValue', inlineIf)
  hbs.registerHelper('default', (value: unknown, fallback: unknown) =>
    value === undefined || value === null || value === '' ? fallback : value
  )
  hbs.registerHelper('coalesce', (...args: readonly unknown[]) => {
    const operands = args.slice(0, -1)
    const found = operands.find((value) => value !== undefined && value !== null && value !== '')
    return found ?? ''
  })
  hbs.registerHelper('eq', (a: unknown, b: unknown) => toStr(a) === toStr(b))
  hbs.registerHelper('ne', (a: unknown, b: unknown) => toStr(a) !== toStr(b))
  hbs.registerHelper('gt', (a: unknown, b: unknown) => toNumber(a) > toNumber(b))
  hbs.registerHelper('gte', (a: unknown, b: unknown) => toNumber(a) >= toNumber(b))
  hbs.registerHelper('lt', (a: unknown, b: unknown) => toNumber(a) < toNumber(b))
  hbs.registerHelper('lte', (a: unknown, b: unknown) => toNumber(a) <= toNumber(b))
  hbs.registerHelper('and', (...args: readonly unknown[]) => {
    const operands = args.slice(0, -1)
    return operands.every((value) => Boolean(value))
  })
  hbs.registerHelper('or', (...args: readonly unknown[]) => {
    const operands = args.slice(0, -1)
    return operands.some((value) => Boolean(value))
  })
  hbs.registerHelper('not', (value: unknown) => !value)
}

const registerEncodingHelpers = (hbs: Hbs): void => {
  hbs.registerHelper('base64Encode', (value: unknown) =>
    Buffer.from(toStr(value), 'utf8').toString('base64')
  )
  hbs.registerHelper('base64Decode', (value: unknown) =>
    Buffer.from(toStr(value), 'base64').toString('utf8')
  )
  hbs.registerHelper('encodeUri', (value: unknown) => encodeURIComponent(toStr(value)))
  hbs.registerHelper('decodeUri', safeUriDecode)
  hbs.registerHelper('urlEncode', (value: unknown) => encodeURIComponent(toStr(value)))
  hbs.registerHelper('urlDecode', safeUriDecode)
}

/**
 * `null` / `undefined` inputs to a hash helper produce the empty string,
 * not the well-known hash of "" (md5 → d41d8cd98f00b204e9800998ecf8427e,
 * sha256 → e3b0c4...). Without this guard, `{{md5 missing.path}}` silently
 * returns a deterministic hash that LOOKS like a valid digest, masking the
 * fact that the input field never resolved — a real silent-corruption
 * surface for callers using the hash as an idempotency key or signature.
 * The empty-string fallback matches `formatDate`/`extractEmail` semantics
 * (unresolvable input → empty string, observable in run-history).
 */
const hashOrEmpty = (algo: 'md5' | 'sha256', value: unknown): string => {
  if (value === undefined || value === null) return ''
  return createHash(algo).update(toStr(value)).digest('hex')
}

const registerHashHelpers = (hbs: Hbs): void => {
  hbs.registerHelper('md5', (value: unknown) => hashOrEmpty('md5', value))
  hbs.registerHelper('sha256', (value: unknown) => hashOrEmpty('sha256', value))
}

const registerCoercionHelpers = (hbs: Hbs): void => {
  hbs.registerHelper('json', (value: unknown) => JSON.stringify(value))
  hbs.registerHelper('number', (value: unknown) => toNumber(value))
  hbs.registerHelper('boolean', (value: unknown) => Boolean(value))
  hbs.registerHelper('string', (value: unknown) => toStr(value))
  hbs.registerHelper('typeof', (value: unknown) => {
    if (value === null) return 'null'
    if (Array.isArray(value)) return 'array'
    return typeof value
  })
}

/**
 * Register the full helper catalogue on a Handlebars environment. Idempotent:
 * called once per `createTemplateEngine` invocation. Each category is owned
 * by its own register* function so the file stays under the project's
 * lines-per-function lint budget.
 */
export const registerHelpers = (hbs: Hbs): void => {
  registerTextHelpers(hbs)
  registerCaseHelpers(hbs)
  registerStringHelpers(hbs)
  registerNumberHelpers(hbs)
  registerDateHelpers(hbs)
  registerExtractionHelpers(hbs)
  registerCollectionHelpers(hbs)
  registerLogicHelpers(hbs)
  registerEncodingHelpers(hbs)
  registerHashHelpers(hbs)
  registerCoercionHelpers(hbs)
}
