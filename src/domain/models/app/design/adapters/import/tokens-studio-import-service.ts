/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Tokens Studio (and Penpot) → canonical tokens.
 *
 * Tokens Studio stores token SETS — one file each in a folder beside
 * `$themes.json` and `$metadata.json`, or top-level keys of one file — and
 * THEMES that switch sets on: `enabled` sets are the theme's tokens, `source`
 * sets only resolve its aliases and are never imported. The theme whose name
 * says `dark` is the dark mode, the first other theme is light, and a further
 * theme is reported. Themes are read by position and name, never by `id`,
 * which upstream samples repeat. A set `$metadata` lists but no file holds is
 * skipped, as Tokens Studio itself skips it.
 */

import {
  adapterError,
  adapterOk,
  flattenTree,
  isObject,
  namesDark,
  parseJson,
  parseLength,
  resolveAliases,
  treeHasKey,
  unresolvedAlias,
  type AdapterResult,
  type CanonicalToken,
  type ImportSource,
  type ImportUnmapped,
} from './canonical-tokens-service'

type JsonObject = Readonly<Record<string, unknown>>

const THEMES_FILE = '$themes.json'
const METADATA_FILE = '$metadata.json'

/** Whether a parsed document is a Tokens Studio single file: `$themes` or `$metadata`. */
export const isTokensStudioDocument = (document: unknown): boolean =>
  isObject(document) && ('$themes' in document || '$metadata' in document)

/** Whether a folder's files are a Tokens Studio multi-file project. */
export const isTokensStudioFolder = (paths: readonly string[]): boolean =>
  paths.some((path) => path === THEMES_FILE || path === METADATA_FILE)

interface Theme {
  readonly name: string
  readonly sets: Readonly<Record<string, string>>
}

interface Project {
  readonly sets: ReadonlyMap<string, JsonObject>
  readonly themes: readonly Theme[]
  readonly order: readonly string[]
}

const readThemes = (value: unknown): readonly Theme[] =>
  (Array.isArray(value) ? value : []).filter(isObject).map((theme, position) => ({
    name: typeof theme['name'] === 'string' ? theme['name'] : `theme-${position + 1}`,
    sets: isObject(theme['selectedTokenSets'])
      ? (Object.fromEntries(
          Object.entries(theme['selectedTokenSets']).filter(
            ([, state]) => typeof state === 'string'
          )
        ) as Readonly<Record<string, string>>)
      : {},
  }))

const readOrder = (metadata: unknown): readonly string[] =>
  isObject(metadata) && Array.isArray(metadata['tokenSetOrder'])
    ? metadata['tokenSetOrder'].filter((name): name is string => typeof name === 'string')
    : []

const singleFileProject = (document: JsonObject): Project => ({
  sets: new Map(
    Object.entries(document).filter(
      (entry): entry is [string, JsonObject] => !entry[0].startsWith('$') && isObject(entry[1])
    )
  ),
  themes: readThemes(document['$themes']),
  order: readOrder(document['$metadata']),
})

const folderProject = (source: ImportSource): Project => {
  const byPath = new Map(source.files.map((file) => [file.path, parseJson(file.text)]))
  return {
    sets: new Map(
      [...byPath.entries()]
        .filter(
          ([path, document]) =>
            !path.startsWith('$') && path.endsWith('.json') && isObject(document)
        )
        .map(([path, document]) => [path.slice(0, -'.json'.length), document as JsonObject])
    ),
    themes: readThemes(byPath.get(THEMES_FILE)),
    order: readOrder(byPath.get(METADATA_FILE)),
  }
}

/** Tokens Studio types → DTCG types, with the group a placed type implies. */
const TYPE_MAP: Readonly<Record<string, { readonly type: string; readonly group?: string }>> = {
  color: { type: 'color' },
  dimension: { type: 'dimension' },
  borderRadius: { type: 'dimension', group: 'radius' },
  spacing: { type: 'dimension', group: 'spacing' },
  fontFamilies: { type: 'fontFamily' },
  fontFamily: { type: 'fontFamily' },
  typography: { type: 'typography' },
}

const lengthString = (value: unknown): unknown => {
  const length = parseLength(value, 'px')
  return length === undefined ? value : `${length.value}${length.unit}`
}

/** One set token in canonical form: DTCG type, px for a bare number, a placed group. */
const normalise = (token: CanonicalToken): CanonicalToken => {
  const mapped = token.type === undefined ? undefined : TYPE_MAP[token.type]
  if (mapped === undefined) return token
  const first = (token.path[0] ?? '').toLowerCase()
  const inGroup = mapped.group === undefined || first === mapped.group || first === 'borderradius'
  return {
    ...token,
    type: mapped.type,
    path: inGroup ? token.path : [mapped.group ?? '', ...token.path],
    value: mapped.type === 'dimension' ? lengthString(token.value) : token.value,
  }
}

const setTokens = (set: JsonObject): readonly CanonicalToken[] =>
  flattenTree(set, treeHasKey(set, (key) => key === '$value') ? 'dtcg' : 'legacy').map(normalise)

/** Whether a token carries a colour `modify` the import does not apply. */
const isModified = (token: CanonicalToken): boolean => {
  const studio = token.extensions?.['studio.tokens']
  return (
    token.extensions?.['modify'] !== undefined ||
    (isObject(studio) && studio['modify'] !== undefined)
  )
}

interface ModeTokens {
  readonly tokens: readonly CanonicalToken[]
  readonly unmapped: readonly ImportUnmapped[]
}

/** Every set a theme names, in `$metadata` order then its own; missing sets skipped. */
const orderedSets = (project: Project, theme: Theme): readonly string[] => {
  const named = Object.keys(theme.sets).filter((name) => theme.sets[name] !== 'disabled')
  return [
    ...project.order.filter((name) => named.includes(name)),
    ...named.filter((name) => !project.order.includes(name)),
  ].filter((name) => project.sets.has(name))
}

const themeTokens = (project: Project, theme: Theme): ModeTokens => {
  const sets = orderedSets(project, theme)
  const tokensOf = (name: string) => setTokens(project.sets.get(name) ?? {})
  const namespace = sets.flatMap(tokensOf)
  const enabled = sets.filter((name) => theme.sets[name] === 'enabled').flatMap(tokensOf)
  const resolved = resolveAliases(
    enabled.filter((token) => !isModified(token)),
    namespace
  )
  return {
    tokens: resolved.tokens,
    unmapped: [
      ...enabled.filter(isModified).map((token) => ({
        token: token.path.join('.'),
        kind: 'modifier' as const,
        reason: 'It applies a colour modifier the import does not compute.',
      })),
      ...resolved.unresolved.map(unresolvedAlias),
    ],
  }
}

/** A project with no themes is one light theme enabling every set. */
const themesOf = (project: Project): readonly Theme[] =>
  project.themes.length > 0
    ? project.themes
    : [
        {
          name: 'light',
          sets: Object.fromEntries([...project.sets.keys()].map((name) => [name, 'enabled'])),
        },
      ]

const readProject = (source: ImportSource): Project | undefined => {
  if (source.entry === undefined) return folderProject(source)
  const document = parseJson(source.files.find((file) => file.path === source.entry)?.text ?? '')
  return isObject(document) ? singleFileProject(document) : undefined
}

/** The light theme, the dark one, and the rest: dark by name, light the first other. */
const pickThemes = (
  themes: readonly Theme[]
): {
  readonly light: Theme
  readonly dark: Theme | undefined
  readonly others: readonly Theme[]
} => {
  const dark = themes.find((theme) => namesDark(theme.name))
  const [light, ...others] = themes.filter((theme) => theme !== dark)
  return light === undefined
    ? { light: dark ?? { name: 'light', sets: {} }, dark: undefined, others: [] }
    : { light, dark, others }
}

/** Tokens Studio sets and themes → canonical tokens. */
export const fromTokensStudio = (source: ImportSource): AdapterResult => {
  const project = readProject(source)
  if (project === undefined || project.sets.size === 0) {
    return adapterError('It holds no Tokens Studio token set.')
  }
  const { light, dark, others } = pickThemes(themesOf(project))
  const lightMode = themeTokens(project, light)
  const darkMode = dark === undefined ? undefined : themeTokens(project, dark)
  return adapterOk({
    light: lightMode.tokens,
    dark: darkMode?.tokens,
    unmapped: [
      ...others.map((theme) => ({
        token: theme.name,
        kind: 'mode' as const,
        reason: 'Only one light and one dark theme map to `design`.',
      })),
      ...lightMode.unmapped,
      ...(darkMode?.unmapped ?? []),
    ],
  })
}
