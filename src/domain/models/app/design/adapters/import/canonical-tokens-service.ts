/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The canonical token form every import adapter produces, and the helpers
 * they share to reach it.
 *
 * `sovrium design-system import` reads six token formats and maps them onto
 * `design` through ONE mapper (`design-import-service.ts`). Each provider
 * adapter beside this file turns what its tool exports into the same thing: a
 * flat list of DTCG tokens per colour mode, every alias resolved, every value
 * in DTCG's own shape. The mapper never sees a provider's spelling, so there
 * is one set of placement rules rather than six.
 *
 * Every helper here returns `undefined` rather than guessing. A value the
 * import cannot read is reported by the mapper, never bent into a key.
 */

import { alphaHexByte, printNumber, remToPx } from '../adapter-units'

/** A provider format, as `--from` names it. */
export type ImportFormat =
  'claude-design' | 'figma' | 'tokens-studio' | 'style-dictionary' | 'dtcg' | 'css'

/** Every format the import reads, in the order a refusal names them. */
export const IMPORT_FORMATS: readonly ImportFormat[] = [
  'claude-design',
  'figma',
  'tokens-studio',
  'style-dictionary',
  'dtcg',
  'css',
]

/** Why a source token was left out of `design`. */
export type ImportUnmappedKind =
  'mode' | 'family' | 'group' | 'token-type' | 'text-style' | 'alias' | 'modifier'

/** One source token the import did not place. */
export interface ImportUnmapped {
  readonly token: string
  readonly kind: ImportUnmappedKind
  readonly reason: string
}

/** One DTCG token: its path, its (possibly inherited) type and its value. */
export interface CanonicalToken {
  readonly path: readonly string[]
  readonly type: string | undefined
  readonly value: unknown
  /** The token's `$extensions`, when it carries any. */
  readonly extensions?: Readonly<Record<string, unknown>>
}

/** What an adapter hands the mapper. */
export interface CanonicalImport {
  readonly light: readonly CanonicalToken[]
  readonly dark: readonly CanonicalToken[] | undefined
  readonly unmapped: readonly ImportUnmapped[]
}

/** One file of a source, its path relative to the source with `/` separators. */
export interface SourceFile {
  readonly path: string
  readonly text: string
}

/** A source as the command read it: the file it was given, or a folder's files. */
export interface ImportSource {
  /** The relative path of the file named on the command line; absent for a folder. */
  readonly entry: string | undefined
  readonly files: readonly SourceFile[]
}

/** An adapter's answer: the canonical tokens, or the reason it cannot read the source. */
export type AdapterResult =
  | { readonly ok: true; readonly value: CanonicalImport }
  | { readonly ok: false; readonly error: string }

/** A failed adapter answer. */
export const adapterError = (error: string): AdapterResult => ({ ok: false, error })

/** A successful adapter answer. */
export const adapterOk = (value: CanonicalImport): AdapterResult => ({ ok: true, value })

type JsonObject = Readonly<Record<string, unknown>>

/** Whether `value` is a plain JSON object. */
export const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** `JSON.parse` that answers `undefined` instead of throwing. */
export const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

/**
 * A key a parsed document declares ITSELF. `in` and a bare `object[key]` also
 * see `Object.prototype`, so a token group named `constructor` or `toString`
 * would be dropped by a merge and `__proto__` would read the prototype. Every
 * lookup by a key the source chose goes through this.
 */
export const hasOwnKey = (value: JsonObject, key: string): boolean => Object.hasOwn(value, key)

/** The value a parsed document declares itself under `key`, never an inherited one. */
export const ownValue = (value: JsonObject, key: string): unknown =>
  Object.hasOwn(value, key) ? value[key] : undefined

/** A deep merge of two token trees, `next` winning leaf by leaf. */
export const mergeTrees = (base: JsonObject, next: JsonObject): JsonObject =>
  Object.fromEntries([
    ...Object.entries(base).filter(([key]) => !hasOwnKey(next, key)),
    ...Object.entries(next).map(([key, value]) => {
      const previous = ownValue(base, key)
      const merged =
        isObject(previous) && isObject(value) && !isLeafObject(value) && !isLeafObject(previous)
          ? mergeTrees(previous, value)
          : value
      return [key, merged] as const
    }),
  ])

/** Whether an object is a token (DTCG `$value`, or the legacy `value`). */
const isLeafObject = (value: JsonObject): boolean =>
  hasOwnKey(value, '$value') || hasOwnKey(value, 'value')

/** How a token tree spells its leaves. */
export type LeafForm = 'dtcg' | 'legacy'

const valueKey = (form: LeafForm): string => (form === 'dtcg' ? '$value' : 'value')
const typeKey = (form: LeafForm): string => (form === 'dtcg' ? '$type' : 'type')

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined

/**
 * Every token of a tree, in document order, a group's `$type` typing the
 * tokens beneath it. Keys starting with `$` are metadata, never groups.
 */
export const flattenTree = (
  tree: JsonObject,
  form: LeafForm,
  path: readonly string[] = [],
  inheritedType: string | undefined = undefined
): readonly CanonicalToken[] => {
  const groupType = stringOrUndefined(ownValue(tree, typeKey(form))) ?? inheritedType
  return Object.entries(tree).flatMap(([key, child]): readonly CanonicalToken[] => {
    if (key.startsWith('$') || !isObject(child)) return []
    const childPath = [...path, key]
    if (hasOwnKey(child, valueKey(form))) {
      const type = stringOrUndefined(ownValue(child, typeKey(form))) ?? groupType
      const extensions = ownValue(child, '$extensions')
      return [
        {
          path: childPath,
          type,
          value: child[valueKey(form)],
          ...(isObject(extensions) && { extensions }),
        },
      ]
    }
    return flattenTree(child, form, childPath, groupType)
  })
}

/** Whether any object of a tree carries a key, at any depth. */
export const treeHasKey = (value: unknown, predicate: (key: string) => boolean): boolean => {
  if (Array.isArray(value)) return value.some((item) => treeHasKey(item, predicate))
  if (!isObject(value)) return false
  return Object.entries(value).some(
    ([key, child]) => predicate(key) || treeHasKey(child, predicate)
  )
}

/** Whether a tree holds at least one legacy `value` leaf and no DTCG `$value`. */
export const isLegacyTree = (value: unknown): boolean =>
  isObject(value) &&
  !treeHasKey(value, (key) => key === '$value') &&
  flattenTree(value, 'legacy').some((token) => token.type !== undefined)

/** Whether a tree holds at least one DTCG `$value` leaf. */
export const isDtcgTree = (value: unknown): boolean =>
  isObject(value) && flattenTree(value, 'dtcg').length > 0

/** `{a.b.c}` as a whole value. */
const WHOLE_ALIAS = /^\{([^{}]+)\}$/
/** `{a.b.c}` anywhere inside a string, captured for `split`. */
const EMBEDDED_ALIAS = /\{([^{}]+)\}/
/** Whether a string holds an alias at all. */
const HAS_ALIAS = /\{[^{}]+\}/

/** The deepest alias chain followed before a chain is called circular. */
const MAX_ALIAS_DEPTH = 16

type TokenIndex = ReadonlyMap<string, CanonicalToken>

/** The string a resolved value stands for inside another string. */
const inlineValue = (value: unknown): string | undefined => {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  return parseColor(value)
}

/** A token's value with every alias it holds resolved, or `undefined` when one does not. */
const resolveValue = (value: unknown, index: TokenIndex, depth: number): unknown => {
  if (depth > MAX_ALIAS_DEPTH) return undefined
  if (typeof value === 'string') return resolveString(value, index, depth)
  if (Array.isArray(value)) {
    const items = value.map((item) => resolveValue(item, index, depth))
    return items.some((item, position) => item === undefined && value[position] !== undefined)
      ? undefined
      : items
  }
  if (!isObject(value)) return value
  const entries = Object.entries(value)
    .filter(([, child]) => child !== undefined)
    .map(([key, child]) => [key, resolveValue(child, index, depth)] as const)
  return entries.some(([, child]) => child === undefined) ? undefined : Object.fromEntries(entries)
}

const resolveString = (value: string, index: TokenIndex, depth: number): unknown => {
  const whole = WHOLE_ALIAS.exec(value)
  if (whole !== null) {
    const target = index.get(normaliseAliasPath(whole[1] ?? ''))
    return target === undefined ? undefined : resolveValue(target.value, index, depth + 1)
  }
  if (!HAS_ALIAS.test(value)) return value
  const parts = value.split(EMBEDDED_ALIAS)
  const resolved = parts.map((part, position) => {
    if (position % 2 === 0) return part
    const target = index.get(normaliseAliasPath(part))
    return target === undefined
      ? undefined
      : inlineValue(resolveValue(target.value, index, depth + 1))
  })
  return resolved.includes(undefined) ? undefined : resolved.join('')
}

/** Style Dictionary's legacy aliases end in `.value`; the token is the path before it. */
const normaliseAliasPath = (path: string): string => path.trim().replace(/\.value$/, '')

/** The type an alias carries over from the token it names, along the whole chain. */
const aliasedType = (value: unknown, index: TokenIndex, depth = 0): string | undefined => {
  if (typeof value !== 'string' || depth > MAX_ALIAS_DEPTH) return undefined
  const whole = WHOLE_ALIAS.exec(value)
  const target = whole === null ? undefined : index.get(normaliseAliasPath(whole[1] ?? ''))
  if (target === undefined) return undefined
  return target.type ?? aliasedType(target.value, index, depth + 1)
}

/** The tokens of `output` with their aliases resolved against `namespace`. */
export interface ResolvedTokens {
  readonly tokens: readonly CanonicalToken[]
  readonly unresolved: readonly CanonicalToken[]
}

/**
 * Resolve every alias of `output` against `namespace` (which defaults to
 * `output` itself). A token whose alias names nothing is returned apart, for
 * the adapter to report.
 */
export const resolveAliases = (
  output: readonly CanonicalToken[],
  namespace: readonly CanonicalToken[] = output
): ResolvedTokens => {
  const index: TokenIndex = new Map(namespace.map((token) => [token.path.join('.'), token]))
  const resolved = output.map((token) => ({
    token,
    value: resolveValue(token.value, index, 0),
  }))
  return {
    tokens: resolved
      .filter((entry) => entry.value !== undefined)
      .map(({ token, value }) => ({
        ...token,
        type: token.type ?? aliasedType(token.value, index),
        value,
      })),
    unresolved: resolved.filter((entry) => entry.value === undefined).map(({ token }) => token),
  }
}

/** The report entry for a token whose alias does not resolve. */
export const unresolvedAlias = (token: CanonicalToken): ImportUnmapped => ({
  token: token.path.join('.'),
  kind: 'alias',
  reason: 'Its alias names a token the source does not declare.',
})

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
/**
 * One colour function call and nothing after it. Its arguments hold no
 * parenthesis, so `rgb(0 0 0) url(…)` or a nested `var()` is not a colour the
 * import carries into the config, whatever its first word.
 */
const FUNCTIONAL_COLOR = /^(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb|color)\([^()]*\)$/i
const RGBA_OF_HEX = /^rgba?\(\s*(#[0-9a-f]{3,8})\s*,\s*([0-9.]+%?)\s*\)$/i
const RGB_NUMERIC =
  /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i

/** `#abc` → `#aabbcc`, `#abcd` → `#aabbccdd`, lower-cased. */
const expandHex = (hex: string): string => {
  const body = hex.slice(1).toLowerCase()
  return body.length === 3 || body.length === 4
    ? `#${[...body].map((digit) => `${digit}${digit}`).join('')}`
    : `#${body}`
}

const byte = (channel: number): string =>
  Math.round(Math.min(255, Math.max(0, channel)))
    .toString(16)
    .padStart(2, '0')

/** An alpha as written (`0.5`, `50%`) to 0–1. */
const alphaOf = (raw: string): number =>
  raw.endsWith('%') ? Number(raw.slice(0, -1)) / 100 : Number(raw)

/** `#rrggbb` plus an alpha, as `#rrggbb` when opaque and `#rrggbbaa` otherwise. */
const withAlpha = (hex: string, alpha: number): string | undefined => {
  if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) return undefined
  const base = expandHex(hex).slice(0, 7)
  return alpha === 1 ? base : `${base}${alphaHexByte(alpha)}`
}

const colorFromString = (raw: string): string | undefined => {
  const value = raw.trim()
  if (HEX.test(value)) return expandHex(value)
  const ofHex = RGBA_OF_HEX.exec(value)
  if (ofHex !== null) return withAlpha(ofHex[1] ?? '', alphaOf(ofHex[2] ?? '1'))
  const numeric = RGB_NUMERIC.exec(value)
  if (numeric !== null) {
    const hex = `#${[numeric[1], numeric[2], numeric[3]].map((part) => byte(Number(part))).join('')}`
    return withAlpha(hex, alphaOf(numeric[4] ?? '1'))
  }
  return FUNCTIONAL_COLOR.test(value) ? value : undefined
}

/** A DTCG colour object: its `hex` when it carries one, else its sRGB components. */
const colorFromObject = (value: JsonObject): string | undefined => {
  const alpha = typeof value['alpha'] === 'number' ? value['alpha'] : 1
  const hex = stringOrUndefined(value['hex'])
  if (hex !== undefined && HEX.test(hex)) return withAlpha(hex, alpha)
  const { components } = value
  if (!Array.isArray(components) || components.length !== 3) return undefined
  const channels = components.map((channel) => (typeof channel === 'number' ? channel : NaN))
  if (channels.some((channel) => Number.isNaN(channel))) return undefined
  return functionalColor(String(value['colorSpace']), channels, alpha)
}

/** The CSS a DTCG colour space spells, for the spaces `design.colors` accepts. */
const functionalColor = (
  space: string,
  channels: readonly number[],
  alpha: number
): string | undefined => {
  if (space === 'srgb') {
    return withAlpha(`#${channels.map((channel) => byte(channel * 255)).join('')}`, alpha)
  }
  if (space !== 'oklch') return undefined
  const body = channels.map((channel) => printNumber(channel)).join(' ')
  return alpha === 1 ? `oklch(${body})` : `oklch(${body} / ${printNumber(alpha)})`
}

/**
 * A colour value as `design.colors` stores it: hex lower-cased (`#rrggbb`, or
 * `#rrggbbaa` with an alpha), any other CSS colour function as written.
 */
export const parseColor = (value: unknown): string | undefined => {
  if (typeof value === 'string') return colorFromString(value)
  return isObject(value) ? colorFromObject(value) : undefined
}

/** A length: its number and unit. */
export interface Length {
  readonly value: number
  readonly unit: string
}

const LENGTH = /^(-?(?:\d+\.?\d*|\.\d+))([a-z%]*)$/i

/**
 * A length as DTCG writes it (`{value, unit}`) or as a string (`16px`).
 * `unitless` is the unit a bare number is read in — Tokens Studio writes px
 * without one — or `undefined` to refuse a bare number.
 */
export const parseLength = (value: unknown, unitless?: string): Length | undefined => {
  if (isObject(value)) return lengthFromObject(value)
  if (typeof value === 'number') {
    return unitless === undefined ? undefined : { value, unit: unitless }
  }
  return typeof value === 'string' ? lengthFromString(value, unitless) : undefined
}

const lengthFromObject = (value: JsonObject): Length | undefined => {
  const amount = value['value']
  const unit = stringOrUndefined(value['unit'])
  return typeof amount === 'number' && unit !== undefined ? { value: amount, unit } : undefined
}

const lengthFromString = (value: string, unitless: string | undefined): Length | undefined => {
  const match = LENGTH.exec(value.trim())
  if (match === null) return undefined
  const unit = (match[2] ?? '').toLowerCase()
  if (unit !== '') return { value: Number(match[1]), unit }
  return unitless === undefined ? undefined : { value: Number(match[1]), unit: unitless }
}

/** A length in px, when it is a px or rem length; `rem` converts at the shared base. */
export const lengthPx = (length: Length | undefined): number | undefined => {
  if (length === undefined) return undefined
  if (length.unit === 'px') return length.value
  return length.unit === 'rem' ? remToPx(length.value) : undefined
}

/** A camelCase or snake segment, kebab-cased and lower-cased. */
export const kebabSegment = (segment: string): string =>
  segment
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()

/** Splits a font stack (`"Inter", system-ui, sans-serif`) into its unquoted names. */
export const splitFontStack = (value: unknown): readonly string[] | undefined => {
  if (Array.isArray(value)) {
    const names = value.filter((name): name is string => typeof name === 'string')
    return names.length === value.length && names.length > 0 ? names.map(unquote) : undefined
  }
  if (typeof value !== 'string' || value.trim() === '') return undefined
  return (value.match(/"[^"]*"|'[^']*'|[^,]+/g) ?? [])
    .map((name) => unquote(name))
    .filter((name) => name !== '')
}

const unquote = (name: string): string => name.trim().replace(/^["']|["']$/g, '')

/**
 * A font name as a stack writes it: quoted when it holds a space or a quote,
 * its own quotes and backslashes escaped so the string ends where the name does.
 */
export const quoteFontName = (name: string): string =>
  /[\s"'\\]/.test(name) ? `"${name.replace(/["\\]/g, (character) => `\\${character}`)}"` : name

/** The last segment of a file path, lower-cased, for mode naming. */
export const baseName = (path: string): string => path.split('/').at(-1) ?? path

/** Whether a mode, theme or file name names the dark mode. */
export const namesDark = (name: string): boolean => name.toLowerCase().includes('dark')
