/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Where a decode problem lives in what the author wrote.
 *
 * Two sources: the `$ref` source map, which names the partial file a path came
 * from; and the config AS WRITTEN — the parsed document rather than the issue
 * tree — which says where a path sits in it, so problems print in reading
 * order, and what it declares, so a refused key can name what it was probably
 * meant to be.
 */

/**
 * Where a path sits in the document as written: per segment, the key's index
 * among its object's own keys (a key that is absent — a missing one — sorts
 * after every present sibling), or the array index. Pure.
 */
export const documentPosition = (
  document: unknown,
  segments: readonly (string | number)[]
): readonly number[] =>
  segments.reduce<{ readonly node: unknown; readonly position: readonly number[] }>(
    ({ node, position }, segment) => {
      if (typeof segment === 'number') {
        return {
          node: Array.isArray(node) ? (node as readonly unknown[])[segment] : undefined,
          position: [...position, segment],
        }
      }
      const record =
        typeof node === 'object' && node !== null && !Array.isArray(node)
          ? (node as Record<string, unknown>)
          : {}
      const keys = Object.keys(record)
      const index = keys.indexOf(segment)
      return {
        node: record[segment],
        position: [...position, index === -1 ? keys.length : index],
      }
    },
    { node: document, position: [] }
  ).position

/** Lexicographic order on positions; a prefix sorts first. Pure. */
export const comparePositions = (left: readonly number[], right: readonly number[]): number => {
  const differing = left.findIndex((value, index) => value !== right[index])
  if (differing === -1) return left.length - right.length
  return differing >= right.length ? 1 : (left[differing] ?? 0) - (right[differing] ?? 0)
}

/** The language codes `languages.supported` declares in the parsed document. Pure. */
export const declaredLanguageCodes = (document: unknown): readonly string[] => {
  const languages = (document as { readonly languages?: unknown } | undefined)?.languages
  const supported = (languages as { readonly supported?: unknown } | undefined)?.supported
  if (!Array.isArray(supported)) return []
  return supported.flatMap((entry) => {
    const code = (entry as { readonly code?: unknown } | null)?.code
    return typeof code === 'string' ? [code] : []
  })
}

/**
 * A refused record key, reported by name: `Key 'FR' is not accepted: <rule>`.
 * The key is the path's last segment. For a component's `i18n` key it adds the
 * languages the app declares, the list a mistyped code is most likely meant to
 * be one of. Pure.
 */
export const refusedKeyMessage = (
  segments: readonly (string | number)[],
  rule: string,
  document: unknown
): string => {
  const key = String(segments.at(-1) ?? '')
  const declared = segments.at(-2) === 'i18n' ? declaredLanguageCodes(document) : []
  const languages =
    declared.length > 0 ? `. This app declares the languages: ${declared.join(', ')}` : ''
  return `Key '${key}' is not accepted: ${rule}${languages}`
}

/**
 * The `$ref` partial a node came from, when it came from one.
 *
 * `collectRefSources` keys top-level `$ref`s by property name (`tables`) and
 * array-element `$ref`s as `key[index]` (`pages[0]`), so the deepest key that
 * prefixes the finding's path is the file the author has to open. Pure.
 */
export const attributeSourceFile = (
  path: string,
  refSources: ReadonlyMap<string, string>
): string | undefined => attributeSourcePath(path, refSources)?.split('/').at(-1)

/**
 * The same attribution, as the partial's FULL path as recorded in the source
 * map — the key a report groups by. Two partials in two folders may share a
 * file name; they never share a path. Pure.
 */
export const attributeSourcePath = (
  path: string,
  refSources: ReadonlyMap<string, string>
): string | undefined =>
  [...refSources.entries()]
    .filter(([key]) => path === key || path.startsWith(`${key}.`) || path.startsWith(`${key}[`))
    .toSorted(([a], [b]) => b.length - a.length)
    .map(([, file]) => file)
    .find((file) => file.length > 0)
