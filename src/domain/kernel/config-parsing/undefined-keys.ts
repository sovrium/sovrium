/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A config key whose value is `undefined` is an absent key.
 *
 * A config reaches the decoder in two shapes. A YAML or JSON file, and the
 * `APP_SCHEMA` environment variable, cannot spell `undefined` at all: the key
 * is simply not there. A TypeScript config (`app.ts`, or an object handed to
 * `start()`) can, and the idiom `key: condition ? value : undefined` is how a
 * TypeScript author writes "no key". Without this step the two shapes
 * disagreed on one config: the declared options already treat `undefined` as
 * absent (`Schema.optional`), but the excess-property check counted the key as
 * written, so `searchPlaceholder: undefined` on a `select` was refused when it
 * came from `app.ts` and accepted when the same object travelled as JSON.
 *
 * Only OBJECT KEYS are dropped. An `undefined` array element is a hole in a
 * list, not an absent option, and is left for the decoder to refuse. Only plain
 * objects and arrays are walked; anything else is returned as it is.
 *
 * Returns the input itself when it holds no `undefined`-valued key, so the
 * common case allocates nothing and keeps object identity.
 */

const isPlainObject = (value: unknown): value is Readonly<Record<string, unknown>> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype: unknown = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

const omitInArray = (value: readonly unknown[]): readonly unknown[] => {
  const next = value.map(omitUndefinedKeys)
  return next.every((item, index) => item === value[index]) ? value : next
}

const omitInObject = (
  value: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> => {
  const entries = Object.entries(value)
  const next = entries
    .filter(([, item]) => item !== undefined)
    .map(([key, item]) => [key, omitUndefinedKeys(item)] as const)
  const unchanged =
    next.length === entries.length && next.every(([key, item]) => item === value[key])
  // `Object.fromEntries` defines each key as an own data property, so a
  // `__proto__` key survives as written for `prototype-key-guard.ts` to refuse.
  return unchanged ? value : Object.fromEntries(next)
}

/**
 * The value with every `undefined`-valued object key removed, at any depth.
 *
 * @param value - A config as parsed or as imported.
 */
export const omitUndefinedKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) return omitInArray(value)
  if (isPlainObject(value)) return omitInObject(value)
  return value
}
