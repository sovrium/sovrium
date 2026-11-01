/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  AST_TAG,
  isTag,
  objectFields,
  stringLiteral,
  unionMembers,
  type SchemaNode,
} from '@/domain/kernel/config-parsing/schema-ast'
import { ActionSchema } from './actions/action-union'
import { TEMPLATE_CONTEXT_ANNOTATION, TEMPLATE_CONTEXTS, type TemplateContext } from './template'

/**
 * WHICH PROPS OF AN ACTION ARE TEMPLATE TEXT — derived from the schema.
 *
 * A prop whose string node carries the `templateContext` annotation is
 * rendered by its own action, with the escaping its output needs, against the
 * action's `data` only. The run's generic template pass must leave it as
 * written; this table is how it knows which ones, so the list is never
 * hand-written and a new template-bearing prop cannot be pre-rendered by
 * omission.
 */

/** One template-bearing prop: its dot path under `props`, and its escaping mode. */
export interface TemplateContextPath {
  readonly path: string
  readonly context: TemplateContext
}

/** The slice of Effect's AST this module reads (`kernel/config-parsing/schema-ast.ts`). */
type Node = SchemaNode

/** The node a `Suspend` defers to, or `undefined` for every other node. */
const suspended = (node: Node): Node | undefined =>
  node.thunk === undefined ? undefined : (node.thunk() as Node)

const contextOf = (node: Node): TemplateContext | undefined => {
  const value = node.annotations?.[TEMPLATE_CONTEXT_ANNOTATION]
  return (TEMPLATE_CONTEXTS as ReadonlyArray<unknown>).includes(value)
    ? (value as TemplateContext)
    : undefined
}

/** The template-bearing paths under one node, `prefix` being the path that reached it. */
const pathsUnder = (
  node: Node,
  prefix: string,
  seen: ReadonlySet<Node>
): ReadonlyArray<TemplateContextPath> => {
  if (seen.has(node)) return []
  const next = new Set([...seen, node])
  const own = contextOf(node)
  if (own !== undefined && isTag(node, AST_TAG.string)) return [{ path: prefix, context: own }]
  const deferred = suspended(node)
  if (deferred !== undefined) return pathsUnder(deferred, prefix, next)
  const members = unionMembers(node)
  if (members !== undefined) return members.flatMap((t) => pathsUnder(t, prefix, next))
  return objectFields(node).flatMap((p) =>
    pathsUnder(p.type, prefix === '' ? String(p.name) : `${prefix}.${String(p.name)}`, next)
  )
}

const literalsOf = (node: Node | undefined): ReadonlyArray<string> => {
  if (node === undefined) return []
  const literal = stringLiteral(node)
  if (literal !== undefined) return [literal]
  return (unionMembers(node) ?? []).flatMap(literalsOf)
}

/** Every action arm of a union: an `Objects` node carrying a `type` literal. */
const actionArms = (node: Node, seen: ReadonlySet<Node>): ReadonlyArray<Node> => {
  if (seen.has(node)) return []
  const next = new Set([...seen, node])
  const deferred = suspended(node)
  if (deferred !== undefined) return actionArms(deferred, next)
  const members = unionMembers(node)
  if (members !== undefined) return members.flatMap((t) => actionArms(t, next))
  const hasType = objectFields(node).some((p) => p.name === 'type')
  return hasType ? [node] : []
}

const dedupe = (paths: ReadonlyArray<TemplateContextPath>): ReadonlyArray<TemplateContextPath> =>
  paths.filter((p, i) => paths.findIndex((q) => q.path === p.path) === i)

/**
 * The `type/operator → template-bearing prop paths` table of an action union.
 * Exported for the parity test; the run reads {@link TEMPLATE_CONTEXT_PATHS}.
 */
/** @public */
export const deriveTemplateContextPaths = (
  union: unknown
): ReadonlyMap<string, ReadonlyArray<TemplateContextPath>> => {
  const arms = actionArms(union as Node, new Set())
  const entries = arms.flatMap((arm) => {
    const field = (name: string) => objectFields(arm).find((p) => p.name === name)?.type
    const props = field('props')
    const paths = props === undefined ? [] : dedupe(pathsUnder(props, '', new Set()))
    if (paths.length === 0) return []
    const operators = literalsOf(field('operator'))
    return literalsOf(field('type')).flatMap((type) =>
      (operators.length === 0 ? [type] : operators.map((op) => `${type}/${op}`)).map(
        (key) => [key, paths] as const
      )
    )
  })
  return new Map(entries)
}

/** The table for the automation action union, computed once. @public */
export const TEMPLATE_CONTEXT_PATHS: ReadonlyMap<
  string,
  ReadonlyArray<TemplateContextPath>
> = deriveTemplateContextPaths(ActionSchema.ast)

/** The template-bearing paths of one action, `[]` when it has none. */
export const templateContextPathsFor = (
  type: string,
  operator: string | undefined
): ReadonlyArray<TemplateContextPath> =>
  TEMPLATE_CONTEXT_PATHS.get(
    operator === undefined || operator === '' ? type : `${type}/${operator}`
  ) ?? []
