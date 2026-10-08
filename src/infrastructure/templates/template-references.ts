/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a parsed template refers to: the helpers it calls and the partials it
 * includes. Read before a document template is compiled, so a refusal names
 * the helper or the partial rather than surfacing as a compile error.
 */

interface ReferenceNode {
  readonly type: string
  readonly original?: unknown
  readonly parts?: ReadonlyArray<unknown>
  readonly path?: ReferenceNode
  readonly name?: ReferenceNode
  readonly params?: ReadonlyArray<ReferenceNode>
  readonly hash?: { readonly pairs: ReadonlyArray<{ readonly value: ReferenceNode }> }
  readonly program?: { readonly body: ReadonlyArray<ReferenceNode> }
  readonly inverse?: { readonly body: ReadonlyArray<ReferenceNode> }
  readonly body?: ReadonlyArray<ReferenceNode>
}

/** The helpers a template calls and the partials it names. */
export interface TemplateReferences {
  readonly helpers: ReadonlySet<string>
  readonly partials: ReadonlySet<string>
  /** Whether a partial is named by an expression (`{{> (lookup …)}}`) rather than written. */
  readonly dynamicPartial: boolean
}

const CALLS = new Set(['MustacheStatement', 'BlockStatement', 'SubExpression'])
const PARTIALS = new Set(['PartialStatement', 'PartialBlockStatement'])

const childrenOf = (node: ReferenceNode): ReadonlyArray<ReferenceNode> => [
  ...(node.body ?? []),
  ...(node.path === undefined ? [] : [node.path]),
  ...(node.params ?? []),
  ...(node.hash?.pairs.map((pair) => pair.value) ?? []),
  ...(node.program?.body ?? []),
  ...(node.inverse?.body ?? []),
]

/** The name a call or a partial writes, when it is a plain path. */
const writtenName = (node: ReferenceNode | undefined): string | undefined =>
  node?.type === 'PathExpression' && typeof node.original === 'string' ? node.original : undefined

/** The name a partial statement writes: a path or a quoted string. */
const partialName = (name: ReferenceNode | undefined): string | undefined =>
  name?.type === 'StringLiteral' && typeof name.original === 'string'
    ? name.original
    : writtenName(name)

const visit = (node: ReferenceNode): TemplateReferences => {
  const below = childrenOf(node).map(visit)
  const helper = CALLS.has(node.type) ? writtenName(node.path) : undefined
  const isPartial = PARTIALS.has(node.type)
  const partial = isPartial ? partialName(node.name) : undefined
  return {
    helpers: new Set([
      ...(helper === undefined ? [] : [helper]),
      ...below.flatMap((r) => [...r.helpers]),
    ]),
    partials: new Set([
      ...(partial === undefined ? [] : [partial]),
      ...below.flatMap((r) => [...r.partials]),
    ]),
    dynamicPartial: (isPartial && partial === undefined) || below.some((r) => r.dynamicPartial),
  }
}

/** Every helper called and partial named anywhere in a parsed template. */
export const templateReferences = (program: unknown): TemplateReferences =>
  visit(program as ReferenceNode)
