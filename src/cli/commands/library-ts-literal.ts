/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A JSON value printed as a TypeScript literal exactly as Prettier prints it at
 * its default options: 80 columns, two-space indent, double quotes, trailing
 * commas, keys unquoted where they can be.
 *
 * `library add` writes the fragment an operator then owns, so the file has to
 * be one their formatter leaves alone. Prettier itself only formats
 * asynchronously, and the fragment renderer is a pure synchronous function the
 * re-add verdict calls several times per install, so the subset of Prettier's
 * layout a JSON value can reach is reproduced here instead. The unit test holds
 * every shipped library entry to Prettier's own verdict.
 *
 * The layout rules this covers, as Prettier applies them:
 *
 * - A non-empty object is always written one key per line: Prettier keeps an
 *   object expanded once its first key sits on its own line.
 * - An array of plain values goes on one line when it fits with the comma that
 *   follows it, else one item per line; an array holding an expanded object,
 *   or two or more arrays of two or more items, is always broken; an array of
 *   numbers is broken by filling each line.
 * - A string value that does not fit after its key goes on the next line,
 *   unless the key is shorter than five columns.
 * - A string takes double quotes, or single ones when it holds more double
 *   quotes than single.
 */

const WIDTH = 80
const INDENT = 2
const SHORT_KEY = 5

type Json = string | number | boolean | null | readonly Json[] | { readonly [key: string]: Json }

const width = (text: string): number => Bun.stringWidth(text)

const isObject = (value: Json): value is { readonly [key: string]: Json } =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** A string literal in the quote Prettier prefers for it. */
export const printString = (value: string): string => {
  const doubles = value.split('"').length - 1
  const singles = value.split("'").length - 1
  const json = JSON.stringify(value)
  if (doubles <= singles) return json
  const body = json
    .slice(1, -1)
    .replace(/\\(.)|(')/g, (match, escaped: string | undefined, single: string | undefined) => {
      if (single !== undefined) return "\\'"
      return escaped === '"' ? '"' : match
    })
  return `'${body}'`
}

const printKey = (key: string): string =>
  /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : printString(key)

const printNumber = (value: number): string => String(value).replace('e+', 'e')

/** Whether the value can only be written over several lines. */
const isAlwaysBroken = (value: Json): boolean => {
  if (isObject(value)) return Object.keys(value).length > 0
  if (!Array.isArray(value)) return false
  const items = value as readonly Json[]
  if (items.some(isAlwaysBroken)) return true
  return (
    items.length > 1 &&
    items.every((item) => Array.isArray(item) && (item as readonly Json[]).length > 1)
  )
}

/** A value with nothing broken in it, on one line. */
const printFlat = (value: Json): string => {
  if (value === null) return 'null'
  if (typeof value === 'string') return printString(value)
  if (typeof value === 'number') return printNumber(value)
  if (typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return `[${(value as readonly Json[]).map(printFlat).join(', ')}]`
  return '{}'
}

const pad = (column: number): string => ' '.repeat(column)

/** Numbers packed onto as few lines as fit, each followed by its comma. */
const printFilled = (items: readonly number[], indent: number): string => {
  const inner = indent + INDENT
  const lines = items
    .map((item) => `${printNumber(item)},`)
    .reduce<readonly string[]>((acc, cell) => {
      const last = acc.at(-1)
      if (last !== undefined && inner + width(last) + 1 + width(cell) <= WIDTH) {
        return [...acc.slice(0, -1), `${last} ${cell}`]
      }
      return [...acc, cell]
    }, [])
  return `[\n${lines.map((line) => `${pad(inner)}${line}\n`).join('')}${pad(indent)}]`
}

/**
 * `value` written starting at `column` on a line indented by `indent`, with
 * `suffix` columns (the comma or semicolon) following it.
 */
const printValue = (value: Json, indent: number, column: number, suffix: number): string => {
  if (isObject(value)) {
    const entries = Object.entries(value)
    if (entries.length === 0) return '{}'
    const inner = indent + INDENT
    const lines = entries.map(([key, item]) => `${pad(inner)}${printProperty(key, item, inner)},\n`)
    return `{\n${lines.join('')}${pad(indent)}}`
  }
  if (!Array.isArray(value)) return printFlat(value)
  const items = value as readonly Json[]
  if (items.length === 0) return '[]'
  if (!isAlwaysBroken(value)) {
    const flat = printFlat(value)
    if (column + width(flat) + suffix <= WIDTH) return flat
    if (items.every((item) => typeof item === 'number')) {
      return printFilled(items as readonly number[], indent)
    }
  }
  const inner = indent + INDENT
  const lines = items.map((item) => `${pad(inner)}${printValue(item, inner, inner, 1)},\n`)
  return `[\n${lines.join('')}${pad(indent)}]`
}

/** One `key: value` line (or two, when a long string moves under its key). */
const printProperty = (key: string, value: Json, indent: number): string => {
  const printedKey = printKey(key)
  const column = indent + width(printedKey) + 2
  if (typeof value === 'string') {
    const literal = printString(value)
    const fits = column + width(literal) + 1 <= WIDTH
    return fits || width(printedKey) < SHORT_KEY
      ? `${printedKey}: ${literal}`
      : `${printedKey}:\n${pad(indent + INDENT)}${literal}`
  }
  return `${printedKey}: ${printValue(value, indent, column, 1)}`
}

/** `const <binding> = <value>;`, the value read as JSON (so `undefined` keys drop out). */
export const printConstDeclaration = (binding: string, value: unknown): string => {
  const json = JSON.parse(JSON.stringify(value) ?? 'null') as Json
  const head = `const ${binding} = `
  return `${head}${printValue(json, 0, width(head), 1)};`
}
