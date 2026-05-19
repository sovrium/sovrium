/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { createHash } from 'node:crypto'
import { DateTime, Either, Option } from 'effect'
import { stripHtmlToText } from '@/domain/utils/html-sanitization'
import type Handlebars from 'handlebars'


const toNumber = (value: unknown): number => {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : NaN
  }
  if (typeof value === 'boolean') return value ? 1 : 0
  return NaN
}

const toStr = (value: unknown): string => {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

const padNumber = (value: number, width: number): string => String(value).padStart(width, '0')


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


const stripHtml = (input: string): string => stripHtmlToText(input)

const escapeHtml = (input: string): string =>
  input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')


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

const addDays = (iso: string, days: number): string => {
  const parsedOpt = DateTime.make(iso)
  if (Option.isNone(parsedOpt)) return iso
  const shifted = DateTime.add(parsedOpt.value, { days })
  return DateTime.toDateUtc(shifted).toISOString()
}

const isoNow = (): string => new Date().toISOString()

const computeDateDiffInDays = (a: string, b: string): number => {
  const da = DateTime.make(a)
  const db = DateTime.make(b)
  if (Option.isNone(da) || Option.isNone(db)) return 0
  const ms = DateTime.toDateUtc(da.value).getTime() - DateTime.toDateUtc(db.value).getTime()
  return Math.round(ms / 86_400_000)
}


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


const isTruthyValue = (cond: unknown): boolean =>
  cond !== false && cond !== null && cond !== undefined && cond !== '' && cond !== 0

const inlineIf = (cond: unknown, truthy: unknown, falsy: unknown): unknown =>
  isTruthyValue(cond) ? truthy : falsy

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
  hbs.registerHelper('currentDateTime', isoNow)
  hbs.registerHelper('today', () => isoNow().slice(0, 10))
}

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
