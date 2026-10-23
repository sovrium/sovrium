/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { PageNodeMap } from '@/domain/models/api/admin/design-system/page-node-map'
import type { DrawnRules } from '@/domain/models/app/pages/page-drawing'

/**
 * The Claude Design page adapter, rules half: what a page node DOES, carried
 * on its board element so an agent editing the canvas can change it too.
 *
 * Each attribute holds the config's own value, as the config writes it:
 *
 * - `data-sovrium-bind`: the text a binding fills (`$record.title`,
 *   `Welcome back, $currentUser.name`); the element still draws a sample;
 * - `data-sovrium-visible`: the node's `visibility`, as JSON;
 * - `data-sovrium-source`: the node's `dataSource`, as JSON;
 * - `data-sovrium-form`: the form a form node embeds (`formRef`);
 * - `data-sovrium-href`: on a button, the page its `navigate` action opens.
 *
 * The page import reads each back and writes an edited one (`page-merge-rules-service.ts`).
 * Only the Claude Design canvas carries them: a Figma or Penpot file draws
 * how a page looks, never what it does.
 */

/** The attribute each rule is carried in. */
export const CANVAS_RULE = {
  bind: 'data-sovrium-bind',
  visible: 'data-sovrium-visible',
  source: 'data-sovrium-source',
  form: 'data-sovrium-form',
  href: 'data-sovrium-href',
} as const

type Node = Readonly<Record<string, unknown>>
type MapEntry = PageNodeMap['pages'][number]['nodes'][number]

/** The node a path id points at inside a page entry. */
const configNodeAt = (page: Node, id: string): Node | undefined => {
  const pointer = id.slice(id.indexOf(':') + 1)
  return pointer
    .split('/')
    .slice(1)
    .reduce<unknown>(
      (node, segment) =>
        typeof node === 'object' && node !== null ? (node as Node)[segment] : undefined,
      page
    ) as Node | undefined
}

/** The text a node keeps where a binding fills it, as the config writes it. */
const boundTextOf = (entry: MapEntry, node: Node): string | undefined => {
  const binding = (entry.bindings ?? []).find(
    (candidate) => candidate.property === 'content' || candidate.property === 'children.0'
  )
  if (binding === undefined) return undefined
  const value =
    binding.property === 'content'
      ? node['content']
      : Array.isArray(node['children'])
        ? (node['children'] as readonly unknown[])[0]
        : undefined
  return typeof value === 'string' ? value : undefined
}

/** The page a button's `navigate` action opens, when it has one. */
const navigatedPathOf = (node: Node): string | undefined => {
  const action = node['action'] as { readonly type?: unknown; readonly path?: unknown } | undefined
  return node['type'] === 'button' && action?.type === 'navigate' && typeof action.path === 'string'
    ? action.path
    : undefined
}

/** One node's rules as its board attributes. */
const attributesOf = (entry: MapEntry, node: Node): Readonly<Record<string, string>> => {
  const bound = boundTextOf(entry, node)
  const form = node['formRef']
  const href = navigatedPathOf(node)
  return {
    ...(bound === undefined ? {} : { [CANVAS_RULE.bind]: bound }),
    ...(entry.visibility === undefined
      ? {}
      : { [CANVAS_RULE.visible]: JSON.stringify(entry.visibility) }),
    ...(entry.dataSource === undefined
      ? {}
      : { [CANVAS_RULE.source]: JSON.stringify(entry.dataSource) }),
    ...(typeof form === 'string' ? { [CANVAS_RULE.form]: form } : {}),
    ...(href === undefined ? {} : { [CANVAS_RULE.href]: href }),
  }
}

/**
 * Each page node's rules, as the attributes its board element carries, by
 * node id. A node drawn from a template, a library block or a reference
 * carries none: what it does belongs to what it is drawn from.
 *
 * @param map - the page's node map entry.
 * @param page - the page entry, as the app declares it.
 */
export const canvasRulesOf = (
  map: Pick<PageNodeMap['pages'][number], 'nodes'>,
  page: Node
): Readonly<Record<string, Readonly<Record<string, string>>>> =>
  Object.fromEntries(
    map.nodes.flatMap((entry) => {
      const node = entry.provenance === undefined ? configNodeAt(page, entry.id) : undefined
      const attributes = node === undefined ? {} : attributesOf(entry, node)
      return Object.keys(attributes).length === 0 ? [] : [[entry.id, attributes] as const]
    })
  )

/**
 * The rules a stamped element carries, as drawn; `undefined` when it carries
 * none. A `data-sovrium-href` is a rule on a button only: on a link it names
 * where the link leads, which the canvas draws for its own navigation.
 *
 * @param attributes - the element's attributes.
 * @param type - the kit type it is stamped with.
 */
export const drawnRulesOf = (
  attributes: Readonly<Record<string, string>>,
  type: string
): DrawnRules | undefined => {
  const rules: DrawnRules = {
    ...(attributes[CANVAS_RULE.bind] === undefined ? {} : { bind: attributes[CANVAS_RULE.bind] }),
    ...(attributes[CANVAS_RULE.visible] === undefined
      ? {}
      : { visible: attributes[CANVAS_RULE.visible] }),
    ...(attributes[CANVAS_RULE.source] === undefined
      ? {}
      : { source: attributes[CANVAS_RULE.source] }),
    ...(attributes[CANVAS_RULE.form] === undefined ? {} : { form: attributes[CANVAS_RULE.form] }),
    ...(type !== 'button' || attributes[CANVAS_RULE.href] === undefined
      ? {}
      : { href: attributes[CANVAS_RULE.href] }),
  }
  return Object.keys(rules).length === 0 ? undefined : rules
}
