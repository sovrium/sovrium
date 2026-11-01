/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The text of a page node as the page export reads it
 * (`design-system-page-projection.ts`): the literal copy a design tree may
 * carry, and the bindings and translation keys the node map keeps instead of
 * the values they resolve to.
 */

import { splitLeadingTranslationKey } from '@/domain/models/app/languages/translation-resolver'
import type { PageNodeMap } from '@/domain/models/api/admin/design-system/page-node-map'

type Node = Readonly<Record<string, unknown>>

/** One node map entry, as the contract spells it. */
type NodeMapEntry = PageNodeMap['pages'][number]['nodes'][number]

const stringField = (node: Node, field: string): string | undefined =>
  typeof node[field] === 'string' ? (node[field] as string) : undefined

/** A binding names `$<source>.<path>`; a template variable (`$label`) and a `$t:` key do not. */
const BINDING_PATTERN = /\$([A-Za-z_]\w*(?:\.\w+)+)/g

const isTranslation = (text: string): boolean => text.startsWith('$t:')
const isLiteral = (text: string): boolean => !isTranslation(text) && !/\$[A-Za-z_]/.test(text)

/** The literal text a node draws: its `content`, or a lone string child. */
export const literalContentOf = (node: Node): string | undefined => {
  const content = stringField(node, 'content')
  if (content !== undefined) return isLiteral(content) ? content : undefined
  const { children } = node
  return Array.isArray(children) &&
    children.length === 1 &&
    typeof children[0] === 'string' &&
    isLiteral(children[0])
    ? children[0]
    : undefined
}

/** Every text-bearing property of a node, by its dotted path from the node. */
const textPropertiesOf = (node: Node): readonly (readonly [string, string])[] => {
  const content = stringField(node, 'content')
  const children = Array.isArray(node['children']) ? (node['children'] as readonly unknown[]) : []
  const props = (node['props'] ?? {}) as Node
  return [
    ...(content === undefined ? [] : [['content', content] as const]),
    ...children.flatMap((child, index) =>
      typeof child === 'string' ? [[`children.${index}`, child] as const] : []
    ),
    ...Object.entries(props).flatMap(([name, value]) =>
      typeof value === 'string' ? [[`props.${name}`, value] as const] : []
    ),
  ]
}

/** The map's view of a node's text: its bindings and its translation keys. */
export const textEntriesOf = (node: Node): Partial<NodeMapEntry> => {
  const texts = textPropertiesOf(node)
  // A text may open with a `$t:` key and carry more after it (a code block's
  // translated comment line, then the code): the key is kept as a translation,
  // and what follows it is read for bindings like any other text.
  const bindings = texts.flatMap(([property, expression]) => {
    const after = splitLeadingTranslationKey(expression)?.rest ?? expression
    const references = [...after.matchAll(BINDING_PATTERN)].map((match) => match[1] ?? '')
    return references.length === 0 ? [] : [{ property, expression, references }]
  })
  const translations = texts.flatMap(([property, text]) => {
    const leading = splitLeadingTranslationKey(text)
    return leading === undefined ? [] : [{ property, key: `$t:${leading.key}` }]
  })
  return {
    ...(bindings.length === 0 ? {} : { bindings }),
    ...(translations.length === 0 ? {} : { translations }),
  }
}
