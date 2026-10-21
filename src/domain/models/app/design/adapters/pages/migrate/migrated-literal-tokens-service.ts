/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { tokenRunsIn } from '@/domain/models/app/pages/literal-token-service'
import { pageNodeIdOf } from '@/domain/models/app/pages/node-identity'
import type { MigratedPagesReport } from './migrated-pages-report'

/**
 * Foreign text never becomes a Sovrium binding.
 *
 * A page from another tool can hold words that read like a page token
 * (`$app.name`, `$query.q`, `$t:greeting`). Copied as written they would be
 * filled once the page is served, or fail the app's decode. Every converter
 * therefore writes each piece of literal text through {@link migratedLiteral},
 * which puts one backslash before the `$` of every token run — the page
 * grammar's escape, so the page prints the characters as the author wrote
 * them. A backslash the source already had is kept, and prints too.
 *
 * What a token run is comes from the page grammar's own reader
 * (`tokenRunsIn`), so the migration and the renderer cannot disagree about it.
 */

/** A `$` that starts a token run: followed by an ASCII letter or `_`. */
const TOKEN_START = /\$(?=[A-Za-z_])/g

/** Literal text with each token run escaped, and the runs it held, as written. */
export const neutraliseLiteralTokens = (
  text: string
): { readonly text: string; readonly tokens: readonly string[] } => {
  const tokens = tokenRunsIn(text)
  return tokens.length === 0
    ? { text, tokens }
    : { text: text.replace(TOKEN_START, () => '\\$'), tokens }
}

/** The one door every piece of literal text takes into a migrated page or form. */
export const migratedLiteral = (text: string): string => neutraliseLiteralTokens(text).text

type LiteralToken = MigratedPagesReport['literalTokens'][number]

/** A migrated node, read for its strings: any keys, children under `children`. */
type LiteralNode = object

/** Every string a value holds, depth first. */
const stringsOf = (value: unknown): readonly string[] => {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(stringsOf)
  if (value === null || typeof value !== 'object') return []
  return Object.values(value).flatMap(stringsOf)
}

/** The node's own strings: everything but its type, its key and its children. */
const ownStringsOf = (node: LiteralNode): readonly string[] =>
  Object.entries(node)
    .filter(([key]) => key !== 'type' && key !== 'key' && key !== 'children')
    .flatMap(([, value]) => stringsOf(value))

const tokensOf = (page: string, pointer: string, strings: readonly string[]) =>
  strings
    .flatMap(tokenRunsIn)
    .map((token): LiteralToken => ({ page, node: pageNodeIdOf(page, pointer), token }))

const nodeTokens = (
  page: string,
  nodes: readonly LiteralNode[],
  pointer: string
): readonly LiteralToken[] =>
  nodes.flatMap((node, index) => {
    const at = `${pointer}/${index}`
    const { children } = node as { readonly children?: unknown }
    const nested = Array.isArray(children) ? (children as readonly LiteralNode[]) : []
    return [
      ...tokensOf(page, at, ownStringsOf(node)),
      ...nodeTokens(page, nested, `${at}/children`),
    ]
  })

/**
 * Every token run a written page carries, by the node that holds it, for the
 * report's `literalTokens`. A converter writes no binding of its own, so every
 * run on the page came from foreign text through {@link migratedLiteral}.
 *
 * `extra` adds runs held outside the page tree: the page title at `/meta`, and
 * an extracted form's texts at the form node that names it.
 */
export const migratedPageLiteralTokens = (
  page: string,
  components: readonly LiteralNode[],
  extra: readonly { readonly pointer: string; readonly value: unknown }[] = []
): readonly LiteralToken[] => [
  ...extra.flatMap(({ pointer, value }) => tokensOf(page, pointer, stringsOf(value))),
  ...nodeTokens(page, components, '/components'),
]
