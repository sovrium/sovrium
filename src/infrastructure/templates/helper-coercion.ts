/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Argument coercion shared by every Handlebars helper.
 *
 * Extracted from `handlebars-helpers.ts` so that file can be what its name
 * says — a registration table — while the value semantics live somewhere they
 * can be unit-tested directly and reused by the per-category helper modules.
 *
 * THE OPTIONS-OBJECT RULE (load-bearing)
 * --------------------------------------
 * Handlebars appends its own `options` hash as the LAST argument of every
 * helper invocation, always. A helper declared with fixed parameters simply
 * never names it and is fine; a VARIADIC helper must strip it, or it will
 * treat the engine's bookkeeping object as a user operand. Every optional
 * trailing argument in this codebase (`{{formatDate v p tz locale}}`) is
 * therefore read through `dropOptions`.
 */

/**
 * Coerce a helper argument to a number for arithmetic. Any non-numeric input
 * becomes `NaN` (rendered as the literal "NaN") rather than silently zero —
 * arithmetic on a non-number should be loudly wrong, not quietly plausible.
 */
export const toNumber = (value: unknown): number => {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : NaN
  }
  if (typeof value === 'boolean') return value ? 1 : 0
  return NaN
}

/**
 * Coerce a helper argument to a string. `null`/`undefined` map to the empty
 * string so an unresolved trigger path renders as "" rather than the literal
 * "undefined" — the behaviour established by the legacy `{{path}}` resolver.
 */
export const toStr = (value: unknown): string => {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  // The options hash is engine bookkeeping, never a value. A single-argument
  // helper invoked bare (`{{lowercase}}`) receives it AS its argument, and
  // stringifying it would emit `{"name":"lowercase","hash":{},...}` into
  // production output. Rendering "" instead keeps the mistake silent-but-empty
  // rather than silent-but-corrupt.
  if (isOptionsHash(value)) return ''
  return JSON.stringify(value)
}

/**
 * Recognise Handlebars' own `options` hash.
 *
 * Detected STRUCTURALLY rather than positionally. A blind `slice(0, -1)` is
 * right when the helper is invoked by Handlebars and wrong when it is called
 * directly (a unit test, or one helper composing another), where it would eat
 * a real operand. Matching on the engine's own bookkeeping fields makes
 * `dropOptions` correct on both call paths.
 *
 * `name` + `hash` + `loc` is the stable trio Handlebars attaches to every
 * helper invocation; a user value would have to be an object carrying all
 * three to be mistaken for it.
 */
export const isOptionsHash = (value: unknown): boolean =>
  value !== null &&
  typeof value === 'object' &&
  'name' in value &&
  'hash' in value &&
  'loc' in value

/**
 * Strip Handlebars' trailing `options` hash, leaving only the operands the
 * template author actually wrote.
 *
 * THIS IS NOT OPTIONAL FOR ANY HELPER WITH AN OPTIONAL TRAILING ARGUMENT.
 * A helper declared as `(value, width, fill?)` receives the options hash AS
 * `fill` whenever the author omits it, and `toStr(options)` then renders the
 * engine's internals — `{"name":"truncate","hash":{},...}` — straight into
 * production output. That was a live defect in `truncate`, `replace`,
 * `formatCurrency` and `padStart`/`padEnd`; all now route through here.
 */
export const dropOptions = (args: readonly unknown[]): readonly unknown[] =>
  args.length > 0 && isOptionsHash(args[args.length - 1]) ? args.slice(0, -1) : args

/**
 * Read the operand at `index`, or `undefined` when the author omitted it.
 * Used by helpers whose trailing arguments are optional.
 */
export const optionalStr = (operands: readonly unknown[], index: number): string | undefined => {
  const value = operands[index]
  if (value === undefined || value === null) return undefined
  const text = toStr(value)
  return text === '' ? undefined : text
}
