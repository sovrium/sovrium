/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * DTCG 2025.10 → canonical tokens.
 *
 * Three shapes are read:
 *
 *  - **One document**: the light mode.
 *  - **A resolver** (`*.resolver.json`): its `resolutionOrder` walked set by
 *    set; the modifier whose contexts include one naming `dark` gives the two
 *    modes, light being its `default` context or the first other one. A
 *    further context is reported. A source the resolver names but the folder
 *    does not hold is refused by name: the import never reads a design with a
 *    hole in it.
 *  - **A folder** of documents: the files whose name says `dark` are layered
 *    over the others for the dark mode.
 *
 * Both dark shapes are LAYERED: the merged dark tree also carries the light
 * value of every token the dark layer never mentions. So the dark mode emits
 * only the tokens its own layer states — the dark files, or the dark context's
 * own sources — each resolved against the whole merged tree. A token reaching
 * dark only through the base is not a dark decision, and is not emitted.
 */

import {
  adapterError,
  adapterOk,
  baseName,
  flattenTree,
  isObject,
  mergeTrees,
  namesDark,
  parseJson,
  resolveAliases,
  unresolvedAlias,
  type AdapterResult,
  type CanonicalToken,
  type ImportSource,
  type ImportUnmapped,
  type SourceFile,
} from './canonical-tokens-service'

type JsonObject = Readonly<Record<string, unknown>>

/** Whether a parsed document is a DTCG resolver. */
export const isDtcgResolver = (document: unknown): boolean =>
  isObject(document) &&
  (Array.isArray(document['resolutionOrder']) || isObject(document['modifiers'])) &&
  !('$value' in document)

/** A `$ref` inside the resolver (`#/sets/base`), or a file beside it. */
const refOf = (value: unknown): string | undefined =>
  isObject(value) && typeof value['$ref'] === 'string' ? value['$ref'] : undefined

const directoryOf = (path: string): string => {
  const slash = path.lastIndexOf('/')
  return slash === -1 ? '' : path.slice(0, slash + 1)
}

/**
 * `a/./b/../c` → `a/c`, so a reference finds the file the folder holds — or
 * `undefined` when it climbs above the source, an absolute path included. A
 * `../tokens.json` must never be clamped onto a same-named file inside the
 * source: it names a file the import was not given, so it is missing.
 */
export const normaliseSourcePath = (path: string): string | undefined => {
  if (path.startsWith('/') || /^[a-z]:/i.test(path) || path.includes('\\')) return undefined
  const parts = path.split('/').reduce<readonly string[] | undefined>((acc, part) => {
    if (acc === undefined || part === '' || part === '.') return acc
    if (part !== '..') return [...acc, part]
    return acc.length === 0 ? undefined : acc.slice(0, -1)
  }, [])
  return parts?.join('/')
}

/**
 * Every file a resolver names with a `$ref`, normalised against the resolver's
 * own folder: what the command reads beside it, and nothing else. A pointer
 * into the resolver itself (`#/sets/base`) names no file; a reference that
 * climbs out of the folder is left out, so the adapter reports it missing.
 */
export const resolverFileRefs = (resolver: unknown): readonly string[] => {
  const refs = (value: unknown): readonly string[] => {
    if (Array.isArray(value)) return value.flatMap(refs)
    if (!isObject(value)) return []
    const own = refOf(value)
    return [...(own === undefined ? [] : [own]), ...Object.values(value).flatMap(refs)]
  }
  return [
    ...new Set(
      refs(resolver)
        .filter((ref) => !ref.startsWith('#'))
        .map(normaliseSourcePath)
        .filter((path): path is string => path !== undefined)
    ),
  ].toSorted()
}

interface Context {
  readonly files: ReadonlyMap<string, string>
  readonly base: string
}

type Loaded = { readonly tree: JsonObject } | { readonly missing: string }

/** The token tree a list of sources merges to, or the first source the folder lacks. */
const loadSources = (sources: unknown, context: Context): Loaded =>
  (Array.isArray(sources) ? sources : []).reduce<Loaded>(
    (loaded, source) => {
      if ('missing' in loaded) return loaded
      const ref = refOf(source)
      if (ref === undefined)
        return isObject(source) ? { tree: mergeTrees(loaded.tree, source) } : loaded
      const path = normaliseSourcePath(`${context.base}${ref}`)
      const text = path === undefined ? undefined : context.files.get(path)
      const document = text === undefined ? undefined : parseJson(text)
      return isObject(document) ? { tree: mergeTrees(loaded.tree, document) } : { missing: ref }
    },
    { tree: {} }
  )

interface Modifier {
  readonly light: string
  readonly dark: string | undefined
  readonly others: readonly string[]
}

const readModifier = (modifier: JsonObject): Modifier | undefined => {
  const contexts = isObject(modifier['contexts']) ? Object.keys(modifier['contexts']) : []
  const dark = contexts.find(namesDark)
  const fallback = typeof modifier['default'] === 'string' ? modifier['default'] : undefined
  const light = contexts.find((name) => name === fallback) ?? contexts.find((name) => name !== dark)
  if (light === undefined) return undefined
  return { light, dark, others: contexts.filter((name) => name !== light && name !== dark) }
}

/** What one `resolutionOrder` entry points at: a set, a modifier, or an inline one. */
const targetOf = (resolver: JsonObject, entry: unknown): JsonObject | undefined => {
  const match = /^#\/(sets|modifiers)\/(.+)$/.exec(refOf(entry) ?? '')
  if (match === null) return isObject(entry) ? entry : undefined
  const table = resolver[match[1] ?? '']
  const target = isObject(table) ? table[match[2] ?? ''] : undefined
  return isObject(target) ? target : undefined
}

/** The sources a modifier contributes in one mode: its dark context, or its light one. */
const modifierSources = (modifier: JsonObject, mode: 'light' | 'dark'): unknown => {
  const read = readModifier(modifier)
  const contexts = isObject(modifier['contexts']) ? modifier['contexts'] : {}
  const context = mode === 'dark' ? (read?.dark ?? read?.light) : read?.light
  return context === undefined ? [] : contexts[context]
}

/** The sources one `resolutionOrder` entry contributes in one mode. */
const entrySources = (resolver: JsonObject, entry: unknown, mode: 'light' | 'dark'): unknown => {
  const target = targetOf(resolver, entry)
  if (target === undefined) return []
  return 'sources' in target ? target['sources'] : modifierSources(target, mode)
}

const resolverModifiers = (resolver: JsonObject): readonly Modifier[] =>
  Object.values(isObject(resolver['modifiers']) ? resolver['modifiers'] : {})
    .filter(isObject)
    .map(readModifier)
    .filter((modifier): modifier is Modifier => modifier !== undefined)

const loadMode = (resolver: JsonObject, mode: 'light' | 'dark', context: Context): Loaded => {
  const order = Array.isArray(resolver['resolutionOrder']) ? resolver['resolutionOrder'] : []
  const sources = order.flatMap((entry) => {
    const contributed = entrySources(resolver, entry, mode)
    return Array.isArray(contributed) ? contributed : []
  })
  return loadSources(sources, context)
}

/** The sources the dark context of each modifier contributes, and nothing else. */
const darkLayerSources = (resolver: JsonObject): readonly unknown[] => {
  const order = Array.isArray(resolver['resolutionOrder']) ? resolver['resolutionOrder'] : []
  return order.flatMap((entry) => {
    const target = targetOf(resolver, entry)
    if (target === undefined || 'sources' in target) return []
    const dark = readModifier(target)?.dark
    const contexts = isObject(target['contexts']) ? target['contexts'] : {}
    const sources = dark === undefined ? undefined : contexts[dark]
    return Array.isArray(sources) ? sources : []
  })
}

/** The paths a dark layer states itself, as `a.b.c`. */
const statedPaths = (layer: JsonObject): ReadonlySet<string> =>
  new Set(flattenTree(layer, 'dtcg').map((token) => token.path.join('.')))

/**
 * A layered dark mode: every token of the merged tree, and the paths its own
 * layer states. Only the stated ones are emitted, each typed and resolved
 * through the whole tree, since its `$type` or its alias target may live in the base.
 */
interface DarkMode {
  readonly merged: readonly CanonicalToken[]
  readonly stated: ReadonlySet<string>
}

const darkModeOf = (merged: JsonObject, layer: JsonObject): DarkMode => ({
  merged: flattenTree(merged, 'dtcg'),
  stated: statedPaths(layer),
})

const modeUnmapped = (modifiers: readonly Modifier[]): readonly ImportUnmapped[] =>
  modifiers.flatMap((modifier) =>
    modifier.others.map((name) => ({
      token: name,
      kind: 'mode' as const,
      reason: 'Only the light and dark contexts map to `design`.',
    }))
  )

const canonical = (
  light: readonly CanonicalToken[],
  dark: DarkMode | undefined,
  unmapped: readonly ImportUnmapped[]
): AdapterResult => {
  const lightTokens = resolveAliases(light)
  const darkTokens =
    dark === undefined
      ? undefined
      : resolveAliases(
          dark.merged.filter((token) => dark.stated.has(token.path.join('.'))),
          dark.merged
        )
  return adapterOk({
    light: lightTokens.tokens,
    dark: darkTokens?.tokens,
    unmapped: [
      ...unmapped,
      ...[...lightTokens.unresolved, ...(darkTokens?.unresolved ?? [])].map(unresolvedAlias),
    ],
  })
}

const missingSource = (ref: string): AdapterResult =>
  adapterError(`The resolver names "${ref}", which is not beside it. Nothing was read.`)

const fromResolver = (resolver: JsonObject, entry: string, source: ImportSource): AdapterResult => {
  const context: Context = {
    files: new Map(source.files.map((file) => [file.path, file.text])),
    base: directoryOf(entry),
  }
  const modifiers = resolverModifiers(resolver)
  const light = loadMode(resolver, 'light', context)
  if ('missing' in light) return missingSource(light.missing)
  const hasDark = modifiers.some((modifier) => modifier.dark !== undefined)
  const dark = hasDark ? loadMode(resolver, 'dark', context) : undefined
  if (dark !== undefined && 'missing' in dark) return missingSource(dark.missing)
  const layer = dark === undefined ? undefined : loadSources(darkLayerSources(resolver), context)
  if (layer !== undefined && 'missing' in layer) return missingSource(layer.missing)
  return canonical(
    flattenTree(light.tree, 'dtcg'),
    dark === undefined || layer === undefined ? undefined : darkModeOf(dark.tree, layer.tree),
    modeUnmapped(modifiers)
  )
}

const mergeFiles = (files: readonly SourceFile[]): JsonObject =>
  files
    .map((file) => parseJson(file.text))
    .filter(isObject)
    .reduce<JsonObject>((tree, document) => mergeTrees(tree, document), {})

const fromFolder = (source: ImportSource): AdapterResult => {
  const files = source.files.filter((file) => file.path.endsWith('.json'))
  const resolver = files.find((file) => isDtcgResolver(parseJson(file.text)))
  if (resolver !== undefined) {
    return fromResolver(parseJson(resolver.text) as JsonObject, resolver.path, source)
  }
  const darkFiles = files.filter((file) => namesDark(baseName(file.path)))
  const base = mergeFiles(files.filter((file) => !darkFiles.includes(file)))
  const layer = mergeFiles(darkFiles)
  return canonical(
    flattenTree(base, 'dtcg'),
    darkFiles.length === 0 ? undefined : darkModeOf(mergeTrees(base, layer), layer),
    []
  )
}

/** A DTCG document, resolver or folder → canonical tokens. */
export const fromDtcg = (source: ImportSource): AdapterResult => {
  if (source.entry === undefined) return fromFolder(source)
  const document = parseJson(source.files.find((file) => file.path === source.entry)?.text ?? '')
  if (!isObject(document)) return adapterError('It is not a DTCG document.')
  if (isDtcgResolver(document)) return fromResolver(document, source.entry, source)
  const tokens = flattenTree(document, 'dtcg')
  return tokens.length === 0
    ? adapterError('It is not a DTCG document: it holds no `$value`.')
    : canonical(tokens, undefined, [])
}
