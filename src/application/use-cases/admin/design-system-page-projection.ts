/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * One page of the app, projected three ways for the page export ([internal ref] A13):
 * its DESIGN TREE (what a design tool may change), its NODE MAP entry (what it
 * must never hold), and the DRAWN copy of the page the renderer paints.
 *
 * ─── WHICH NODES ARE TREE NODES ────────────────────────────────────────────
 *
 * A page's components and their own `children`, depth first — the order the
 * renderer draws them in. A template placement is ONE locked node: what its
 * template draws belongs to every page that places it, so it carries no id.
 * The components the page passes to the placement's slots are the page's own:
 * they are the placement's tree children, the default slot first
 * (`…/children/<i>`), then each named slot (`…/slots/<name>/<i>`), each with
 * its own id and content hash. A data-bound node (one with a `dataSource`) is
 * a locked island. A type's slots (a card's `footer`) and breakpoint children
 * are walked by the identity walker (`node-identity.ts`) but are not tree
 * nodes in this version: they are drawn, carry no id, and are covered by their
 * parent's content hash.
 *
 * ─── THE DRAWN COPY ────────────────────────────────────────────────────────
 *
 * Each tree node carries its path id under the export's own marker, which the
 * renderer stamps as `data-sovrium-id`, and nothing else does. A table bound to
 * a declared table is drawn from the synthetic seed (`synthetic-seed-service.ts`)
 * as rows written in the config would be, a column per field when it names
 * none; a list bound to one, with no item template of its own, as one item per
 * seeded row; any other bound table draws its empty state. A kanban bound to a
 * declared table is seeded by the renderer, which draws every island of a
 * specimen from the seed or as its empty state. A table a route parameter
 * names (`$param.table`) is the table the page is drawn at
 * (`design-system-page-seed.ts`). No row of any instance is read.
 *
 * Every tree node is drawn whatever its `visibility` (kept in the node map):
 * an undrawn node would read, on the way back, as one the designer deleted.
 *
 * ─── EXPRESSIONS, NEVER VALUES ─────────────────────────────────────────────
 *
 * Translated and bound text is drawn, but never written into the tree: the
 * node map keeps the `$t:` key and the binding expression with the names it
 * reads, and never what either resolves to.
 */

import { splitLeadingTranslationKey } from '@/domain/models/app/languages/translation-resolver'
import {
  EXPORT_NODE_ID_KEY,
  isTemplatePlacement,
  pageNodeIdOf,
  pointerTo,
} from '@/domain/models/app/pages/node-identity'
import {
  layoutsOfClassName,
  type SpacingScale,
} from '@/domain/models/app/pages/page-layout-service'
import {
  drawnIsland,
  sampleRouteValuesOf,
  seededTableOf,
  type SeedContext,
} from './design-system-page-seed'
import type {
  PAGE_DESIGN_TREE_FORMAT,
  PageDesignTreeNode,
} from '@/domain/models/api/admin/design-system/page-design-tree'
import type { PageNodeMap } from '@/domain/models/api/admin/design-system/page-node-map'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'

type Node = Readonly<Record<string, unknown>>

/** One node map entry, as the contract spells it. */
type NodeMapEntry = PageNodeMap['pages'][number]['nodes'][number]

/** A projected page: its tree, its node map entry, and the copy the renderer draws. */
export interface ProjectedPage {
  readonly tree: {
    readonly format: typeof PAGE_DESIGN_TREE_FORMAT
    readonly version: 1
    readonly page: string
    readonly nodes: readonly PageDesignTreeNode[]
  }
  readonly map: PageNodeMap['pages'][number]
  readonly drawn: Page
}

/** What one projected node yields: its tree node, its map entries, and its drawn copy. */
interface ProjectedNode {
  readonly tree: PageDesignTreeNode
  readonly entries: readonly NodeMapEntry[]
  readonly drawn: unknown
}

/** What every node of one page is projected against. */
interface ProjectionContext extends SeedContext {
  readonly pageName: string
  readonly spacing: SpacingScale
  readonly templates: readonly Node[]
}

/** A binding names `$<source>.<path>`; a template variable (`$label`) and a `$t:` key do not. */
const BINDING_PATTERN = /\$([A-Za-z_]\w*(?:\.\w+)+)/g

const isTranslation = (text: string): boolean => text.startsWith('$t:')
const isLiteral = (text: string): boolean => !isTranslation(text) && !/\$[A-Za-z_]/.test(text)

const sha256Of = (text: string): string => new Bun.CryptoHasher('sha256').update(text).digest('hex')

const stringField = (node: Node, field: string): string | undefined =>
  typeof node[field] === 'string' ? (node[field] as string) : undefined

/** The literal text a node draws: its `content`, or a lone string child. */
const literalContentOf = (node: Node): string | undefined => {
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
const textEntriesOf = (node: Node): Partial<NodeMapEntry> => {
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

/** The fields the map keeps exactly as the config writes them. */
const keptFieldsOf = (node: Node): Partial<NodeMapEntry> => ({
  ...(node['dataSource'] === undefined ? {} : { dataSource: node['dataSource'] }),
  ...(node['visibility'] === undefined ? {} : { visibility: node['visibility'] }),
  ...(node['interactions'] === undefined ? {} : { interactions: node['interactions'] }),
})

/** A node as the export draws it: shown whatever its visibility rule says. */
const drawnAlways = ({ visibility: _visibility, ...shown }: Node): Node => shown

/** The template a placement names, from `app.components`. */
const templateOf = (context: ProjectionContext, node: Node): Node | undefined => {
  const name = stringField(node, 'component') ?? stringField(node, '$ref')
  return context.templates.find((template) => template['name'] === name)
}

/** A list of page components, each projected or, for a string, left as written. */
const projectList = (
  context: ProjectionContext,
  list: unknown,
  pointer: string
): readonly (ProjectedNode | string)[] =>
  (Array.isArray(list) ? (list as readonly unknown[]) : []).map((child, index) =>
    typeof child === 'object' && child !== null
      ? projectNode(context, child as Node, pointerTo(pointer, index))
      : String(child)
  )

/** A node's own children, each projected or, for a string child, left as written. */
const projectChildren = (
  context: ProjectionContext,
  node: Node,
  pointer: string
): readonly (ProjectedNode | string)[] =>
  projectList(context, node['children'], pointerTo(pointer, 'children'))

const projectedOnly = (list: readonly (ProjectedNode | string)[]): readonly ProjectedNode[] =>
  list.filter((child): child is ProjectedNode => typeof child !== 'string')

const drawnOf = (list: readonly (ProjectedNode | string)[]): readonly unknown[] =>
  list.map((child) => (typeof child === 'string' ? child : child.drawn))

/**
 * The page components a placement passes to its slots, projected as the
 * page's own nodes: its `children` (the default slot), then each named slot.
 */
const projectSlotted = (context: ProjectionContext, node: Node, pointer: string) => {
  const { slots } = node
  const named = (
    typeof slots === 'object' && slots !== null ? Object.entries(slots as Node) : []
  ).map(
    ([name, list]) => [name, projectList(context, list, pointerTo(pointer, 'slots', name))] as const
  )
  const own = Array.isArray(node['children']) ? projectChildren(context, node, pointer) : undefined
  return {
    nodes: [...projectedOnly(own ?? []), ...named.flatMap(([, list]) => projectedOnly(list))],
    drawn: {
      ...(own === undefined ? {} : { children: drawnOf(own) }),
      ...(named.length === 0
        ? {}
        : { slots: Object.fromEntries(named.map(([name, list]) => [name, drawnOf(list)])) }),
    },
  }
}

/**
 * One template placement: one locked node, its provenance and its own
 * variables. What the template draws has no id; the components the page passes
 * to its slots are the page's own nodes, its tree children.
 */
const projectPlacement = (
  context: ProjectionContext,
  node: Node,
  id: string,
  pointer: string
): ProjectedNode => {
  const template = templateOf(context, node)
  const name = stringField(node, 'component') ?? stringField(node, '$ref') ?? ''
  const key = stringField(node, 'key')
  const vars = node['vars'] as NonNullable<NodeMapEntry['provenance']>['variables']
  const slotted = projectSlotted(context, node, pointer)
  const own: PageDesignTreeNode = {
    id,
    ...(key === undefined ? {} : { key }),
    type: (template === undefined ? undefined : stringField(template, 'type')) ?? 'component',
    locked: 'template',
    children: [],
  }
  const entry: NodeMapEntry = {
    id,
    ...(key === undefined ? {} : { key }),
    type: own.type,
    // The placement's hash covers what its template draws, so an edit there is
    // seen; a slotted component's edit is that component's, under its own hash.
    contentHash: sha256Of(JSON.stringify({ tree: own, template, vars })),
    provenance: {
      kind: 'template',
      name,
      placement: id,
      ...(vars === undefined ? {} : { variables: vars }),
    },
  }
  return {
    tree: { ...own, children: slotted.nodes.map((child) => child.tree) },
    entries: [entry, ...slotted.nodes.flatMap((child) => child.entries)],
    drawn: { ...drawnAlways(node), ...slotted.drawn, [EXPORT_NODE_ID_KEY]: id },
  }
}

/** The tree node of a component, its own children already projected. */
const treeNodeOf = (
  context: ProjectionContext,
  node: Node,
  id: string,
  children: readonly ProjectedNode[]
): PageDesignTreeNode => {
  const { base, responsive } = layoutsOfClassName(node, context.spacing)
  const key = stringField(node, 'key')
  const variant = stringField(node, 'variant')
  const size = stringField(node, 'size')
  const content = literalContentOf(node)
  return {
    id,
    ...(key === undefined ? {} : { key }),
    type: stringField(node, 'type') ?? 'component',
    ...(variant === undefined ? {} : { variant }),
    ...(size === undefined ? {} : { size }),
    ...(base === undefined ? {} : { layout: base }),
    ...(responsive === undefined ? {} : { responsive }),
    ...(content === undefined ? {} : { content }),
    ...(node['dataSource'] === undefined ? {} : { locked: 'island' as const }),
    children: children.map((child) => child.tree),
  }
}

/** The node map entry of a component, beside its tree node. */
const mapEntryOf = (
  context: ProjectionContext,
  node: Node,
  tree: PageDesignTreeNode
): NodeMapEntry => ({
  id: tree.id,
  ...(tree.key === undefined ? {} : { key: tree.key }),
  type: tree.type,
  // The node as drawn, without its children: a child's edit is the child's.
  contentHash: sha256Of(JSON.stringify({ ...tree, children: undefined })),
  ...textEntriesOf(node),
  ...keptFieldsOf(node),
  ...(node['dataSource'] === undefined
    ? {}
    : { island: { seed: seededTableOf(context, node) === undefined ? 'empty' : 'synthetic' } }),
})

/** One component node, then its own children; an island's inside is not walked. */
function projectNode(context: ProjectionContext, node: Node, pointer: string): ProjectedNode {
  const id = pageNodeIdOf(context.pageName, pointer)
  if (isTemplatePlacement(node)) return projectPlacement(context, node, id, pointer)
  const island = node['dataSource'] !== undefined
  const projected = island ? [] : projectChildren(context, node, pointer)
  const children = projectedOnly(projected)
  const tree = treeNodeOf(context, node, id, children)
  const drawn = {
    ...drawnAlways(island ? drawnIsland(context, node) : node),
    ...(projected.length === 0 ? {} : { children: drawnOf(projected) }),
    [EXPORT_NODE_ID_KEY]: id,
  }
  return {
    tree,
    entries: [mapEntryOf(context, node, tree), ...children.flatMap((child) => child.entries)],
    drawn,
  }
}

/**
 * Project one page of an app for the page export.
 *
 * @param app - the validated config.
 * @param page - one of its pages.
 */
export const projectPageForExport = (app: App, page: Page): ProjectedPage => {
  const context: ProjectionContext = {
    pageName: page.name,
    spacing: (app.design?.spacing ?? {}) as SpacingScale,
    templates: (app.components ?? []) as readonly Node[],
    tables: (app.tables ?? []) as ProjectionContext['tables'],
    routeValues: sampleRouteValuesOf(app, page),
  }
  // The walk reads every node as an untyped record, as the identity walker does.
  const nodes: readonly unknown[] = page.components ?? []
  const projected = nodes.map((node, index) =>
    projectNode(context, node as Node, pointerTo('', 'components', index))
  )
  return {
    tree: {
      format: 'sovrium.design-system.page-tree',
      version: 1,
      page: page.name,
      nodes: projected.map((node) => node.tree),
    },
    map: {
      name: page.name,
      path: page.path,
      ...(page.meta === undefined ? {} : { meta: page.meta }),
      nodes: projected.flatMap((node) => node.entries),
    },
    drawn: { ...page, components: projected.map((node) => node.drawn) } as Page,
  }
}
