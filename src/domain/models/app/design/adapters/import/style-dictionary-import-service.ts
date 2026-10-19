/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Style Dictionary → canonical tokens.
 *
 * Style Dictionary builds from a source tree: one JSON file or a folder of
 * them, merged, in its legacy `value`/`type` form or its DTCG `$value`/`$type`
 * form. Like Style Dictionary itself, a file is read in the DTCG form when it
 * holds a `$value` anywhere, and in the legacy form otherwise, never a mix.
 * Style Dictionary has no modes, so the tree is the light mode only.
 */

import {
  adapterError,
  adapterOk,
  flattenTree,
  isObject,
  mergeTrees,
  parseColor,
  parseJson,
  resolveAliases,
  treeHasKey,
  unresolvedAlias,
  type AdapterResult,
  type CanonicalToken,
  type ImportSource,
} from './canonical-tokens-service'

type JsonObject = Readonly<Record<string, unknown>>

/** A legacy token's type: its own, in DTCG's name, or `color` for an untyped colour. */
const typeOf = (token: CanonicalToken): string | undefined => {
  if (token.type !== undefined) return LEGACY_TYPES[token.type] ?? token.type
  return parseColor(token.value) === undefined ? undefined : 'color'
}

/** Style Dictionary's legacy type names → DTCG's. */
const LEGACY_TYPES: Readonly<Record<string, string>> = {
  size: 'dimension',
  sizing: 'dimension',
  spacing: 'dimension',
  borderRadius: 'dimension',
  fontFamilies: 'fontFamily',
}

const documentsOf = (source: ImportSource): readonly JsonObject[] =>
  source.files
    .filter((file) => file.path.endsWith('.json'))
    .map((file) => parseJson(file.text))
    .filter(isObject)

const tokensOf = (document: JsonObject): readonly CanonicalToken[] => {
  const dtcg = treeHasKey(document, (key) => key === '$value')
  return flattenTree(document, dtcg ? 'dtcg' : 'legacy').map((token) => ({
    ...token,
    type: typeOf(token),
  }))
}

/** A Style Dictionary source tree → canonical tokens. */
export const fromStyleDictionary = (source: ImportSource): AdapterResult => {
  const documents = documentsOf(source)
  const merged = documents.reduce<JsonObject>((tree, document) => mergeTrees(tree, document), {})
  const tokens = tokensOf(merged)
  if (tokens.length === 0) return adapterError('It holds no Style Dictionary token.')
  const resolved = resolveAliases(tokens)
  return adapterOk({
    light: resolved.tokens,
    dark: undefined,
    unmapped: resolved.unresolved.map(unresolvedAlias),
  })
}
