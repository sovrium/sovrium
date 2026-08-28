/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable functional/prefer-immutable-types -- Handlebars instance is
   inherently mutable: registerHelper(name, fn) imperatively mutates the
   internal helper map. Parameter types must accept the mutable instance. */

/**
 * The Handlebars helper REGISTRATION TABLE.
 *
 * Every `registerHelper` call in the product lives in this file, deliberately:
 * `[internal ref]` reads registrations from this path
 * alone, via the TypeScript AST. A registration moved to a sibling module
 * would become invisible to the drift gate and report as missing.
 *
 * The implementations live in the sibling `helper-*.ts` modules so this file
 * can stay a table you can read top-to-bottom and compare against the declared
 * surface in `src/domain/models/app/automations/template.ts`.
 *
 * ALIASES ARE DELIBERATE
 * ----------------------
 * Several names here are documented aliases of a sibling (`replaceAll` of
 * `replace`, `count` of `length`, `toString` of `string`, `includes` of
 * `contains`, `ifEmpty` of `default`). They exist because the alternative is
 * worse: `TemplateStringSchema` is a bare `Schema.String` and the engine
 * swallows unknown-helper failures, so an author who types the name they
 * expect and gets nothing has no error anywhere to tell them why. A one-line
 * alias costs nothing and closes a silent-failure hole.
 */

import { Result } from 'effect'
import { dropOptions, isOptionsHash, optionalStr, toNumber, toStr } from './helper-coercion'
import {
  flatten,
  getPath,
  includes,
  omitKeys,
  pickKeys,
  reverseArray,
  sizeOf,
  switchCase,
} from './helper-collections'
import {
  boundaryOf,
  dateDiffInDays,
  dayOfWeek,
  formatDate,
  fromTimestamp,
  isWeekday,
  isWeekend,
  isoNow,
  parseDate,
  shiftDate,
  timestamp,
  type ShiftUnit,
} from './helper-dates'
import {
  firstEmail,
  firstNumber,
  firstUrl,
  hashOrEmpty,
  ifHelper,
  inlineIf,
  isBlank,
  regexHelper,
  safeUriDecode,
  tryParseUrl,
} from './helper-predicates'
import {
  camelCase,
  capitalizePreservingWords,
  clamp,
  escapeHtml,
  extractAll,
  formatNumber,
  kebabCase,
  matchAll,
  numericFold,
  parityOf,
  pascalCase,
  percentage,
  pluralize,
  repeat,
  replaceAll,
  reverseString,
  sentenceCase,
  slugify,
  snakeCase,
  stripHtml,
  titleCase,
  truncate,
  unescapeHtml,
  wordCount,
} from './helper-text'
import type Handlebars from 'handlebars'

type Hbs = typeof Handlebars

// ─── registration: text ──────────────────────────────────────────────────

const registerCaseHelpers = (hbs: Hbs): void => {
  hbs.registerHelper('uppercase', (v: unknown) => toStr(v).toUpperCase())
  hbs.registerHelper('lowercase', (v: unknown) => toStr(v).toLowerCase())
  hbs.registerHelper('capitalize', (v: unknown) => capitalizePreservingWords(toStr(v)))
  hbs.registerHelper('sentenceCase', (v: unknown) => sentenceCase(toStr(v)))
  hbs.registerHelper('titleCase', (v: unknown) => titleCase(toStr(v)))
  hbs.registerHelper('camelCase', (v: unknown) => camelCase(toStr(v)))
  hbs.registerHelper('snakeCase', (v: unknown) => snakeCase(toStr(v)))
  hbs.registerHelper('kebabCase', (v: unknown) => kebabCase(toStr(v)))
  hbs.registerHelper('pascalCase', (v: unknown) => pascalCase(toStr(v)))
  hbs.registerHelper('slugify', (v: unknown) => slugify(toStr(v)))
}

const registerTrimHelpers = (hbs: Hbs): void => {
  hbs.registerHelper('trim', (v: unknown) => toStr(v).trim())
  hbs.registerHelper('trimStart', (v: unknown) => toStr(v).trimStart())
  hbs.registerHelper('trimEnd', (v: unknown) => toStr(v).trimEnd())
  hbs.registerHelper('padStart', (...args: readonly unknown[]) => {
    const ops = dropOptions(args)
    return toStr(ops[0]).padStart(toNumber(ops[1]), optionalStr(ops, 2) ?? ' ')
  })
  hbs.registerHelper('padEnd', (...args: readonly unknown[]) => {
    const ops = dropOptions(args)
    return toStr(ops[0]).padEnd(toNumber(ops[1]), optionalStr(ops, 2) ?? ' ')
  })
  hbs.registerHelper('repeat', (v: unknown, count: unknown) => repeat(toStr(v), toNumber(count)))
  hbs.registerHelper('reverse', (v: unknown) => reverseString(toStr(v)))
}

const registerStringHelpers = (hbs: Hbs): void => {
  // `replace` has always replaced EVERY occurrence; `replaceAll` is the
  // explicit alias for authors who spell the intent out.
  // All three take an OPTIONAL trailing argument, so all three must strip the
  // options hash. Before this, `{{truncate body 100}}` appended the engine's
  // internals as the suffix and `{{replace a "-"}}` substituted them in.
  hbs.registerHelper('replace', (...args: readonly unknown[]) => {
    const ops = dropOptions(args)
    return replaceAll(toStr(ops[0]), toStr(ops[1]), optionalStr(ops, 2) ?? '')
  })
  hbs.registerHelper('replaceAll', (...args: readonly unknown[]) => {
    const ops = dropOptions(args)
    return replaceAll(toStr(ops[0]), toStr(ops[1]), optionalStr(ops, 2) ?? '')
  })
  hbs.registerHelper('truncate', (...args: readonly unknown[]) => {
    const ops = dropOptions(args)
    return truncate(toStr(ops[0]), toNumber(ops[1]), optionalStr(ops, 2) ?? '')
  })
  hbs.registerHelper('split', (v: unknown, sep: unknown) => toStr(v).split(toStr(sep)))
  hbs.registerHelper('substring', (v: unknown, start: unknown, end: unknown) =>
    toStr(v).substring(toNumber(start), toNumber(end))
  )
  hbs.registerHelper('concat', (...args: readonly unknown[]) =>
    dropOptions(args).map(toStr).join('')
  )
  hbs.registerHelper('wordCount', (v: unknown) => wordCount(toStr(v)))
  hbs.registerHelper('contains', (hay: unknown, needle: unknown) => includes(hay, needle))
  hbs.registerHelper('startsWith', (v: unknown, prefix: unknown) =>
    toStr(v).startsWith(toStr(prefix))
  )
  hbs.registerHelper('endsWith', (v: unknown, suffix: unknown) => toStr(v).endsWith(toStr(suffix)))
  hbs.registerHelper('pluralize', (...args: readonly unknown[]) => {
    const ops = dropOptions(args)
    return pluralize(toNumber(ops[0]), toStr(ops[1]), optionalStr(ops, 2))
  })
}

const registerHtmlHelpers = (hbs: Hbs): void => {
  hbs.registerHelper('stripHtml', (v: unknown) => stripHtml(toStr(v)))
  hbs.registerHelper('escapeHtml', (v: unknown) => escapeHtml(toStr(v)))
  hbs.registerHelper('unescapeHtml', (v: unknown) => unescapeHtml(toStr(v)))
}

// ─── registration: numbers ───────────────────────────────────────────────

const registerArithmeticHelpers = (hbs: Hbs): void => {
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
  hbs.registerHelper('abs', (v: unknown) => Math.abs(toNumber(v)))
  hbs.registerHelper('min', (...args: readonly unknown[]) =>
    numericFold(dropOptions(args), Math.min)
  )
  hbs.registerHelper('max', (...args: readonly unknown[]) =>
    numericFold(dropOptions(args), Math.max)
  )
  hbs.registerHelper('clamp', (v: unknown, low: unknown, high: unknown) =>
    clamp(toNumber(v), toNumber(low), toNumber(high))
  )
  hbs.registerHelper('isEven', (v: unknown) => parityOf(v, 0))
  hbs.registerHelper('isOdd', (v: unknown) => parityOf(v, 1))
}

const registerNumberFormatHelpers = (hbs: Hbs): void => {
  hbs.registerHelper('round', (value: unknown, digits: unknown) => {
    const n = toNumber(value)
    const d = toNumber(digits)
    if (!Number.isFinite(n)) return ''
    if (!Number.isFinite(d) || d === 0) return Math.round(n)
    const factor = 10 ** d
    return (Math.round(n * factor) / factor).toFixed(d)
  })
  hbs.registerHelper('ceil', (v: unknown) => Math.ceil(toNumber(v)))
  hbs.registerHelper('floor', (v: unknown) => Math.floor(toNumber(v)))
  hbs.registerHelper('toFixed', (v: unknown, digits: unknown) =>
    toNumber(v).toFixed(toNumber(digits))
  )
  hbs.registerHelper('percentage', (part: unknown, whole: unknown, digits: unknown) =>
    percentage(toNumber(part), toNumber(whole), toNumber(digits))
  )
  hbs.registerHelper('formatNumber', (...args: readonly unknown[]) => {
    const ops = dropOptions(args)
    const digits = ops.length > 1 ? toNumber(ops[1]) : undefined
    return formatNumber(toNumber(ops[0]), digits, optionalStr(ops, 2))
  })
  hbs.registerHelper('formatCurrency', (...args: readonly unknown[]) => {
    const ops = dropOptions(args)
    const n = toNumber(ops[0])
    if (!Number.isFinite(n)) return ''
    const code = optionalStr(ops, 1) ?? 'USD'
    const result = Result.try({
      try: () => new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(n),
      catch: () => `${code} ${n.toFixed(2)}`,
    })
    return Result.isSuccess(result) ? result.success : result.failure
  })
}

// ─── registration: dates ─────────────────────────────────────────────────

/**
 * `{{add* v n}}` / `{{subtract* v n}}` all share one shape, but each is
 * registered with a LITERAL name below rather than through a loop or a
 * name-taking helper.
 *
 * That is a hard requirement, not a style choice: the drift gate reads
 * registrations from this file's TypeScript AST and only recognises a string
 * LITERAL as the first argument of `registerHelper`. A computed name is
 * invisible to it and reports as an unregistered helper — which is exactly
 * what happened when this block was first written as a `registerShift(hbs,
 * name, unit, sign)` loop. Keep the names literal.
 */
const shiftBy =
  (unit: ShiftUnit, sign: 1 | -1) =>
  (value: unknown, amount: unknown): string =>
    shiftDate(value, sign * toNumber(amount), unit)

const registerDateArithmeticHelpers = (hbs: Hbs): void => {
  hbs.registerHelper('addMinutes', shiftBy('minutes', 1))
  hbs.registerHelper('addHours', shiftBy('hours', 1))
  hbs.registerHelper('addDays', shiftBy('days', 1))
  hbs.registerHelper('addMonths', shiftBy('months', 1))
  hbs.registerHelper('addYears', shiftBy('years', 1))
  hbs.registerHelper('subtractMinutes', shiftBy('minutes', -1))
  hbs.registerHelper('subtractHours', shiftBy('hours', -1))
  hbs.registerHelper('subtractDays', shiftBy('days', -1))
  hbs.registerHelper('subtractMonths', shiftBy('months', -1))
  hbs.registerHelper('subtractYears', shiftBy('years', -1))
  hbs.registerHelper('dateDiff', (a: unknown, b: unknown) => dateDiffInDays(a, b))
}

const registerDateFormatHelpers = (hbs: Hbs): void => {
  hbs.registerHelper('formatDate', (...args: readonly unknown[]) => {
    const ops = dropOptions(args)
    return formatDate(ops[0], toStr(ops[1]), optionalStr(ops, 2), optionalStr(ops, 3))
  })
  hbs.registerHelper('parseDate', (...args: readonly unknown[]) => {
    const ops = dropOptions(args)
    return parseDate(ops[0], toStr(ops[1]), optionalStr(ops, 2))
  })
  hbs.registerHelper('now', isoNow)
  hbs.registerHelper('today', (...args: readonly unknown[]) => {
    const ops = dropOptions(args)
    return formatDate(new Date(), 'yyyy-MM-dd', optionalStr(ops, 0))
  })
}

const registerDateQueryHelpers = (hbs: Hbs): void => {
  hbs.registerHelper('startOf', (...args: readonly unknown[]) => {
    const ops = dropOptions(args)
    return boundaryOf(ops[0], toStr(ops[1]), optionalStr(ops, 2), 'start')
  })
  hbs.registerHelper('endOf', (...args: readonly unknown[]) => {
    const ops = dropOptions(args)
    return boundaryOf(ops[0], toStr(ops[1]), optionalStr(ops, 2), 'end')
  })
  hbs.registerHelper('dayOfWeek', (...args: readonly unknown[]) => {
    const ops = dropOptions(args)
    return dayOfWeek(ops[0], optionalStr(ops, 1), optionalStr(ops, 2))
  })
  hbs.registerHelper('isWeekday', (...args: readonly unknown[]) => {
    const ops = dropOptions(args)
    return isWeekday(ops[0], optionalStr(ops, 1))
  })
  hbs.registerHelper('isWeekend', (...args: readonly unknown[]) => {
    const ops = dropOptions(args)
    return isWeekend(ops[0], optionalStr(ops, 1))
  })
  hbs.registerHelper('timestamp', (v: unknown) => timestamp(v))
  hbs.registerHelper('fromTimestamp', (v: unknown) => fromTimestamp(v))
}

// ─── registration: extraction ────────────────────────────────────────────

const registerExtractionHelpers = (hbs: Hbs): void => {
  hbs.registerHelper('extractEmail', (v: unknown) => firstEmail(v))
  hbs.registerHelper('extractUrl', (v: unknown) => firstUrl(v))
  hbs.registerHelper('extractNumber', (v: unknown) => firstNumber(v))
  hbs.registerHelper('extractEmails', (v: unknown) => extractAll(toStr(v), 'email'))
  hbs.registerHelper('extractUrls', (v: unknown) => extractAll(toStr(v), 'url'))
  hbs.registerHelper('extractNumbers', (v: unknown) => extractAll(toStr(v), 'number'))
  hbs.registerHelper('extractDomain', (v: unknown) => tryParseUrl(toStr(v))?.hostname ?? '')
  hbs.registerHelper('extractPath', (v: unknown) => tryParseUrl(toStr(v))?.pathname ?? '')
  hbs.registerHelper('regex', regexHelper)
  hbs.registerHelper('matchAll', (...args: readonly unknown[]) => {
    const ops = dropOptions(args)
    return matchAll(toStr(ops[0]), optionalStr(ops, 1) ?? '', optionalStr(ops, 2) ?? '')
  })
}

// ─── registration: collections ───────────────────────────────────────────

const registerSequenceHelpers = (hbs: Hbs): void => {
  hbs.registerHelper('first', (v: unknown) =>
    Array.isArray(v) ? (v[0] ?? '') : toStr(v).charAt(0)
  )
  hbs.registerHelper('last', (v: unknown) => {
    if (Array.isArray(v)) return v[v.length - 1] ?? ''
    const str = toStr(v)
    return str.charAt(str.length - 1)
  })
  hbs.registerHelper('at', (v: unknown, index: unknown) => {
    const i = toNumber(index)
    return Array.isArray(v) ? (v[i] ?? '') : toStr(v).charAt(i)
  })
  hbs.registerHelper('join', (v: unknown, sep: unknown) =>
    Array.isArray(v) ? v.map(toStr).join(toStr(sep)) : toStr(v)
  )
  hbs.registerHelper('slice', (v: unknown, start: unknown, end: unknown) => {
    const s = toNumber(start)
    const e = toNumber(end)
    const target: readonly unknown[] | string = Array.isArray(v) ? v : toStr(v)
    return Number.isFinite(e) ? target.slice(s, e) : target.slice(s)
  })
  hbs.registerHelper('unique', (v: unknown) => (Array.isArray(v) ? [...new Set(v)] : v))
  hbs.registerHelper('includes', (hay: unknown, needle: unknown) => includes(hay, needle))
  hbs.registerHelper('flatten', (v: unknown) => flatten(v))
  hbs.registerHelper('reverseArray', (v: unknown) => reverseArray(v))
  hbs.registerHelper('length', (v: unknown) => sizeOf(v))
  hbs.registerHelper('count', (v: unknown) => sizeOf(v))
}

const registerObjectHelpers = (hbs: Hbs): void => {
  hbs.registerHelper('keys', (v: unknown) =>
    v !== null && typeof v === 'object' ? Object.keys(v) : []
  )
  hbs.registerHelper('values', (v: unknown) =>
    v !== null && typeof v === 'object' ? Object.values(v) : []
  )
  hbs.registerHelper('pick', (...args: readonly unknown[]) => {
    const ops = dropOptions(args)
    return pickKeys(ops[0], ops.slice(1).map(toStr))
  })
  hbs.registerHelper('omit', (...args: readonly unknown[]) => {
    const ops = dropOptions(args)
    return omitKeys(ops[0], ops.slice(1).map(toStr))
  })
  hbs.registerHelper('get', (source: unknown, path: unknown) => getPath(source, toStr(path)))
  // Guarded rather than a bare `JSON.stringify`: these two are the only
  // helpers that serialise their argument directly, so they are the only ones
  // `toStr`'s options-hash guard does not already cover.
  hbs.registerHelper('json', (v: unknown) => (isOptionsHash(v) ? '' : JSON.stringify(v)))
  hbs.registerHelper('stringify', (v: unknown) => (isOptionsHash(v) ? '' : JSON.stringify(v)))
}

// ─── registration: logic ─────────────────────────────────────────────────

const registerBranchHelpers = (hbs: Hbs): void => {
  hbs.registerHelper('if', ifHelper)
  hbs.registerHelper('ifValue', inlineIf)
  hbs.registerHelper('default', (v: unknown, fallback: unknown) => (isBlank(v) ? fallback : v))
  hbs.registerHelper('ifEmpty', (v: unknown, fallback: unknown) => (isBlank(v) ? fallback : v))
  hbs.registerHelper('coalesce', (...args: readonly unknown[]) => {
    const found = dropOptions(args).find((value) => !isBlank(value))
    return found ?? ''
  })
  hbs.registerHelper('switch', (...args: readonly unknown[]) => {
    const ops = dropOptions(args)
    return switchCase(ops[0], ops.slice(1))
  })
}

const registerComparisonHelpers = (hbs: Hbs): void => {
  hbs.registerHelper('eq', (a: unknown, b: unknown) => toStr(a) === toStr(b))
  hbs.registerHelper('ne', (a: unknown, b: unknown) => toStr(a) !== toStr(b))
  hbs.registerHelper('gt', (a: unknown, b: unknown) => toNumber(a) > toNumber(b))
  hbs.registerHelper('gte', (a: unknown, b: unknown) => toNumber(a) >= toNumber(b))
  hbs.registerHelper('lt', (a: unknown, b: unknown) => toNumber(a) < toNumber(b))
  hbs.registerHelper('lte', (a: unknown, b: unknown) => toNumber(a) <= toNumber(b))
  hbs.registerHelper('not', (v: unknown) => !v)
  hbs.registerHelper('and', (...args: readonly unknown[]) =>
    dropOptions(args).every((value) => Boolean(value))
  )
  hbs.registerHelper('or', (...args: readonly unknown[]) =>
    dropOptions(args).some((value) => Boolean(value))
  )
}

// ─── registration: encoding + coercion ───────────────────────────────────

const registerEncodingHelpers = (hbs: Hbs): void => {
  hbs.registerHelper('base64Encode', (v: unknown) =>
    Buffer.from(toStr(v), 'utf8').toString('base64')
  )
  hbs.registerHelper('base64Decode', (v: unknown) =>
    Buffer.from(toStr(v), 'base64').toString('utf8')
  )
  // NOTE: `encodeUri`/`urlEncode` have always called `encodeURIComponent`, so
  // `encodeUriComponent` is the ACCURATE name for the shared behaviour rather
  // than a new capability. The two legacy spellings keep their semantics —
  // changing them would silently alter every shipped template that uses them.
  hbs.registerHelper('encodeUri', (v: unknown) => encodeURIComponent(toStr(v)))
  hbs.registerHelper('decodeUri', safeUriDecode)
  hbs.registerHelper('encodeUriComponent', (v: unknown) => encodeURIComponent(toStr(v)))
  hbs.registerHelper('decodeUriComponent', safeUriDecode)
  hbs.registerHelper('urlEncode', (v: unknown) => encodeURIComponent(toStr(v)))
  hbs.registerHelper('urlDecode', safeUriDecode)
  hbs.registerHelper('md5', (v: unknown) => hashOrEmpty('md5', v))
  hbs.registerHelper('sha256', (v: unknown) => hashOrEmpty('sha256', v))
}

const registerCoercionHelpers = (hbs: Hbs): void => {
  hbs.registerHelper('number', (v: unknown) => toNumber(v))
  hbs.registerHelper('toNumber', (v: unknown) => toNumber(v))
  hbs.registerHelper('boolean', (v: unknown) => Boolean(v))
  hbs.registerHelper('toBoolean', (v: unknown) => Boolean(v))
  hbs.registerHelper('string', (v: unknown) => toStr(v))
  hbs.registerHelper('toString', (v: unknown) => toStr(v))
  hbs.registerHelper('typeof', (v: unknown) => {
    if (v === null) return 'null'
    if (Array.isArray(v)) return 'array'
    return typeof v
  })
}

/**
 * Register the full helper catalogue on a Handlebars environment. Idempotent:
 * called once per `createTemplateEngine` invocation.
 */
export const registerHelpers = (hbs: Hbs): void => {
  registerCaseHelpers(hbs)
  registerTrimHelpers(hbs)
  registerStringHelpers(hbs)
  registerHtmlHelpers(hbs)
  registerArithmeticHelpers(hbs)
  registerNumberFormatHelpers(hbs)
  registerDateArithmeticHelpers(hbs)
  registerDateFormatHelpers(hbs)
  registerDateQueryHelpers(hbs)
  registerExtractionHelpers(hbs)
  registerSequenceHelpers(hbs)
  registerObjectHelpers(hbs)
  registerBranchHelpers(hbs)
  registerComparisonHelpers(hbs)
  registerEncodingHelpers(hbs)
  registerCoercionHelpers(hbs)
}
