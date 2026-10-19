/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Claude Design → canonical tokens.
 *
 * Reads a Design System artifact's `tokens.json` (contract 0.2.47): a
 * `color` family of themes and per-theme values, `type` families and text
 * styles, and `tokens` lists for every other family. The `light` theme is
 * light, the theme whose id names `dark` is dark, and any further theme is
 * reported. `space-<step>` and `radius-<step>` lose their prefix, and every
 * family with no `design` home (`size`, `shadow`, …) is reported by token.
 */

import {
  adapterError,
  adapterOk,
  isObject,
  namesDark,
  parseJson,
  resolveAliases,
  unresolvedAlias,
  type AdapterResult,
  type CanonicalToken,
  type ImportSource,
  type ImportUnmapped,
} from './canonical-tokens-service'

type JsonObject = Readonly<Record<string, unknown>>

/** Whether a parsed document is a Claude Design tokens file: a `color.tokens` list. */
export const isClaudeDesignTokens = (document: unknown): boolean =>
  isObject(document) && isObject(document['color']) && Array.isArray(document['color']['tokens'])

const listOf = (value: unknown): readonly JsonObject[] =>
  Array.isArray(value) ? value.filter(isObject) : []

const nameOf = (entry: JsonObject): string =>
  typeof entry['name'] === 'string' ? entry['name'] : ''

/** The theme ids, light first then dark, and the ones the import leaves out. */
interface Themes {
  readonly light: string | undefined
  readonly dark: string | undefined
  readonly others: readonly string[]
}

const readThemes = (color: JsonObject): Themes => {
  const ids = listOf(color['themes'])
    .map((theme) => theme['id'])
    .filter((id): id is string => typeof id === 'string')
  const dark = ids.find(namesDark)
  const light = ids.find((id) => id === 'light') ?? ids.find((id) => id !== dark)
  return { light, dark, others: ids.filter((id) => id !== light && id !== dark) }
}

/** A colour token's value in one theme: its per-theme entry, or the single value for the first. */
const themeValue = (value: unknown, theme: string, first: string | undefined): unknown => {
  if (isObject(value)) return value[theme]
  return theme === first ? value : undefined
}

/** Claude aliases name a token of the same family: `{accent}`, never a path. */
const qualifyAlias = (value: unknown): unknown =>
  typeof value === 'string' ? value.replace(/\{([^{}.]+)\}/g, '{color.$1}') : value

const colorTokens = (
  color: JsonObject,
  theme: string,
  first: string | undefined
): readonly CanonicalToken[] =>
  listOf(color['tokens']).flatMap((token) => {
    const value = themeValue(token['value'], theme, first)
    return value === undefined
      ? []
      : [{ path: ['color', nameOf(token)], type: 'color', value: qualifyAlias(value) }]
  })

const PREFIXED_FAMILIES: Readonly<Record<string, string>> = { spacing: 'space-', radius: 'radius-' }

const lengthTokens = (document: JsonObject, family: string): readonly CanonicalToken[] => {
  const group = document[family]
  const prefix = PREFIXED_FAMILIES[family] ?? ''
  return listOf(isObject(group) ? group['tokens'] : undefined).map((token) => {
    const name = nameOf(token)
    const { value } = token
    return {
      path: [family, name.startsWith(prefix) ? name.slice(prefix.length) : name],
      type: 'dimension',
      value: typeof value === 'number' ? `${value}px` : value,
    }
  })
}

const familyTokens = (type: JsonObject): readonly CanonicalToken[] =>
  Object.entries(isObject(type['families']) ? type['families'] : {}).map(([key, stack]) => ({
    path: ['font', key],
    type: 'fontFamily',
    value: stack,
  }))

const pxOf = (value: unknown): number | undefined => {
  if (typeof value === 'number') return value
  if (typeof value !== 'string') return undefined
  const match = /^([\d.]+)px$/.exec(value.trim())
  return match === null ? undefined : Number(match[1])
}

/** A line height as DTCG's unitless ratio: a px height divided by the size. */
const lineHeightRatio = (lineHeight: unknown, fontSize: unknown): number | undefined => {
  if (typeof lineHeight === 'number' && lineHeight < 10) return lineHeight
  const height = pxOf(lineHeight)
  const size = pxOf(fontSize)
  if (height === undefined || size === undefined || size === 0) return undefined
  return Math.round((height / size) * 1000) / 1000
}

const textStyleTokens = (type: JsonObject): readonly CanonicalToken[] =>
  listOf(type['groups']).flatMap((group) =>
    listOf(group['styles']).map((style) => ({
      // The style's own name, as Claude Design names it: a rung of the ladder or not.
      path: [nameOf(style)],
      type: 'typography',
      value: {
        fontSize:
          typeof style['fontSize'] === 'number' ? `${style['fontSize']}px` : style['fontSize'],
        lineHeight: lineHeightRatio(style['lineHeight'], style['fontSize']),
        fontWeight: style['fontWeight'],
        letterSpacing: style['letterSpacing'],
      },
    }))
  )

/** The families Claude Design carries that name no `design` key, token by token. */
const MAPPED_FAMILIES = new Set(['version', 'color', 'type', 'spacing', 'radius'])

const unmappedFamily = (family: string, token: string): ImportUnmapped => ({
  token,
  kind: 'family',
  reason: `The \`${family}\` family names no \`design\` key.`,
})

const unmappedFamilies = (document: JsonObject): readonly ImportUnmapped[] =>
  Object.entries(document)
    .filter(([family]) => !MAPPED_FAMILIES.has(family))
    .flatMap(([family, group]) => {
      const tokens = listOf(isObject(group) ? group['tokens'] : undefined)
      return tokens.length === 0
        ? [unmappedFamily(family, family)]
        : tokens.map((token) => unmappedFamily(family, `${family}.${nameOf(token)}`))
    })

const modeTokens = (document: JsonObject, theme: string, first: string | undefined) => {
  const color = isObject(document['color']) ? document['color'] : {}
  const type = isObject(document['type']) ? document['type'] : {}
  return resolveAliases([
    ...colorTokens(color, theme, first),
    ...lengthTokens(document, 'spacing'),
    ...lengthTokens(document, 'radius'),
    ...familyTokens(type),
    ...textStyleTokens(type),
  ])
}

/** The tokens file of a source: the file given, or the folder's `tokens.json`. */
const tokensDocument = (source: ImportSource): unknown => {
  const files = source.files.filter((file) => file.path.endsWith('.json'))
  const entry =
    files.find((file) => file.path === source.entry) ??
    files.find((file) => file.path === 'tokens.json') ??
    files.find((file) => isClaudeDesignTokens(parseJson(file.text)))
  return entry === undefined ? undefined : parseJson(entry.text)
}

/** Claude Design tokens → canonical tokens. */
export const fromClaudeDesign = (source: ImportSource): AdapterResult => {
  const document = tokensDocument(source)
  if (!isObject(document) || !isClaudeDesignTokens(document)) {
    return adapterError('It is not a Claude Design tokens file: it has no `color.tokens` list.')
  }
  const themes = readThemes(document['color'] as JsonObject)
  const first = themes.light
  const light = modeTokens(document, themes.light ?? 'light', first ?? 'light')
  const dark = themes.dark === undefined ? undefined : modeTokens(document, themes.dark, first)
  return adapterOk({
    light: light.tokens,
    dark: dark?.tokens,
    unmapped: [
      ...themes.others.map((id) => ({
        token: id,
        kind: 'mode' as const,
        reason: 'Only the light and dark themes map to `design`.',
      })),
      ...unmappedFamilies(document),
      ...[...light.unresolved, ...(dark?.unresolved ?? [])].map(unresolvedAlias),
    ],
  })
}
