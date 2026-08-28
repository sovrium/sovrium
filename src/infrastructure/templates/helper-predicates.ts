/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Branching, matching and hashing helper implementations.
 *
 * These sit apart from `helper-text.ts` because they are not value transforms:
 * `ifHelper` needs Handlebars' own calling convention, and the extraction
 * patterns are shared between the singular and plural helper families.
 */

import { createHash } from 'node:crypto'
import { Result } from 'effect'
import { toStr } from './helper-coercion'

// ─── extraction patterns ─────────────────────────────────────────────────

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
const URL_RE = /https?:\/\/[^\s<>"']+/
const NUMBER_RE = /-?\d+(?:\.\d+)?/

/** First match of a fixed pattern, or "" — the `extract*` singular contract. */
export const firstEmail = (value: unknown): string => firstMatch(value, EMAIL_RE)
export const firstUrl = (value: unknown): string => firstMatch(value, URL_RE)
export const firstNumber = (value: unknown): string => firstMatch(value, NUMBER_RE)

const firstMatch = (value: unknown, pattern: Readonly<RegExp>): string => {
  const match = toStr(value).match(pattern)
  return match ? match[0] : ''
}

export const tryParseUrl = (input: string): Readonly<URL> | undefined => {
  const result = Result.try({ try: () => new URL(input), catch: () => undefined })
  return Result.isSuccess(result) ? result.success : undefined
}

/** `decodeURIComponent` that renders "" on a malformed percent sequence. */
export const safeUriDecode = (input: unknown): string => {
  const result = Result.try({ try: () => decodeURIComponent(toStr(input)), catch: () => '' })
  return Result.isSuccess(result) ? result.success : ''
}

/**
 * `{{regex value pattern [flags]}}` — the first capture group when the pattern
 * has one, else the whole match. No match, an empty pattern, or invalid regex
 * syntax all render "" so a misconfigured pattern cannot crash a run.
 *
 * `flags` is read through a `typeof` guard rather than `dropOptions`: that
 * guard already rejects the Handlebars options hash (an object, not a string),
 * which is why this helper never had the options-leak bug its siblings did.
 */
export const regexHelper = (value: unknown, pattern: unknown, flags?: unknown): string => {
  const patternStr = typeof pattern === 'string' ? pattern : ''
  if (patternStr === '') return ''
  const compiled = Result.try({
    try: () => new RegExp(patternStr, typeof flags === 'string' ? flags : ''),
    catch: () => undefined,
  })
  if (Result.isFailure(compiled)) return ''
  const match = toStr(value).match(compiled.success)
  return match === null ? '' : (match[1] ?? match[0])
}

// ─── branching ───────────────────────────────────────────────────────────

export const isTruthyValue = (cond: unknown): boolean =>
  cond !== false && cond !== null && cond !== undefined && cond !== '' && cond !== 0

export const inlineIf = (cond: unknown, truthy: unknown, falsy: unknown): unknown =>
  isTruthyValue(cond) ? truthy : falsy

export const isBlank = (value: unknown): boolean =>
  value === undefined || value === null || value === ''

/**
 * `{{if}}` supporting BOTH calling conventions:
 *   - Inline: `{{if cond truthy falsy}}`
 *   - Block:  `{{#if cond}}A{{else}}B{{/if}}`
 *
 * Handlebars passes `options` last; in BLOCK form that object carries `fn` and
 * `inverse` (the two branch renderers), which is the discriminator. Overriding
 * the built-in this way keeps the block form working while adding the inline
 * form templates actually need.
 */
export const ifHelper = function (this: unknown, ...args: readonly unknown[]): unknown {
  const last = args[args.length - 1]
  const isBlockForm =
    last !== null &&
    typeof last === 'object' &&
    'fn' in last &&
    typeof (last as { fn: unknown }).fn === 'function'
  if (isBlockForm) {
    const options = last as {
      fn: (ctx: unknown) => string
      inverse: (ctx: unknown) => string
    }
    return isTruthyValue(args[0]) ? options.fn(this) : options.inverse(this)
  }
  return inlineIf(args[0], args[1], args[2])
}

// ─── hashing ─────────────────────────────────────────────────────────────

/**
 * `null`/`undefined` render "" rather than the well-known digest of the empty
 * string. Otherwise `{{md5 missing.path}}` returns something that LOOKS like a
 * valid signature while the input never resolved — a real silent-corruption
 * surface for anyone using the hash as an idempotency key.
 */
export const hashOrEmpty = (algo: 'md5' | 'sha256', value: unknown): string =>
  value === undefined || value === null ? '' : createHash(algo).update(toStr(value)).digest('hex')
