/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/** `app.components` — the templates a `$ref` / `component` reference names. */
export type Templates = readonly unknown[]

/** One component node, as authored: references unexpanded, fields undecoded. */
export type TreeNode = Readonly<Record<string, unknown>>

/**
 * The bodies of every template a page draws, each ONCE however many times it
 * is placed — see {@link collectPlacedTemplates}.
 */
export type PlacedTemplates = readonly TreeNode[]

/**
 * A question asked of one component node.
 *
 * Receives the raw node rather than a decoded component: the walk runs over
 * plain objects, and a predicate that needed a decoded shape could not be
 * asked about a shared component reached by name.
 */
export type ComponentMatcher = (node: TreeNode) => boolean

/**
 * The template a node places, or `undefined` for a node written inline. Keyed
 * on the VALUE being a string: a `specimen` carries a whole component object
 * under `component`, which is a child to draw, not a template name.
 */
const referencedTemplateName = (node: TreeNode): string | undefined => {
  if (typeof node['$ref'] === 'string') return node['$ref']
  return typeof node['component'] === 'string' ? node['component'] : undefined
}

/** The child lists a node renders: its own `children`, and each breakpoint's. */
const renderedChildLists = (node: TreeNode): readonly (readonly unknown[])[] => {
  const own = Array.isArray(node['children']) ? [node['children'] as readonly unknown[]] : []
  const { responsive } = node
  if (responsive === null || typeof responsive !== 'object') return own
  const breakpoints = Object.values(responsive).flatMap((variant) => {
    const children = (variant as { readonly children?: unknown } | null)?.children
    return Array.isArray(children) ? [children as readonly unknown[]] : []
  })
  return [...own, ...breakpoints]
}

/** The template named `name`, or `undefined` when the app declares none. */
const findTemplate = (templates: Templates, name: string): unknown =>
  templates.find((template) => (template as { readonly name?: unknown } | null)?.name === name)

/**
 * Every template the renderer would draw for `items`, keyed by name, each
 * collected ONCE.
 *
 * Walks each node's own `children` and every `responsive.<bp>.children` — the
 * two lists the renderer expands references in — and follows each `$ref` /
 * `component` into its template in `templates`. A template already collected is
 * not walked again, which is both the cycle guard (a template placing itself,
 * directly or A → B → A, still gets a verdict) and what keeps the cost linear in
 * the size of the app rather than in the number of placements: a template
 * placed forty times is read once.
 *
 * Collecting once is exact, not an approximation, for a yes/no question: every
 * node a path-guarded walk would visit is either on the page or inside some
 * collected template body.
 */
function collectPlacedTemplates(
  items: readonly unknown[],
  templates: Templates,
  found: ReadonlyMap<string, TreeNode> = new Map()
): ReadonlyMap<string, TreeNode> {
  return items.reduce<ReadonlyMap<string, TreeNode>>((acc, item) => {
    if (item === null || typeof item !== 'object') return acc
    const node = item as TreeNode
    const name = referencedTemplateName(node)
    if (name === undefined) {
      return renderedChildLists(node).reduce(
        (inner, list) => collectPlacedTemplates(list, templates, inner),
        acc
      )
    }
    // The page components a placement passes into its template's `$children`
    // slot are drawn on the page like any other — walked whatever the template.
    const withSlotted = renderedChildLists(node).reduce(
      (inner, list) => collectPlacedTemplates(list, templates, inner),
      acc
    )
    if (withSlotted.has(name)) return withSlotted
    const template = findTemplate(templates, name)
    if (template === null || typeof template !== 'object') return withSlotted
    const body = template as TreeNode
    return collectPlacedTemplates([body], templates, new Map([...withSlotted, [name, body]]))
  }, found)
}

/** The bodies of every template the page's `items` place — see {@link collectPlacedTemplates}. */
export const placedTemplatesOf = (
  items: readonly unknown[],
  templates: Templates
): PlacedTemplates =>
  templates.length === 0 ? [] : [...collectPlacedTemplates(items, templates).values()]

/**
 * Whether any node drawn from `items` itself — through its `children` and each
 * `responsive.<bp>.children` — satisfies `trips`. A reference is not itself a
 * drawn node: its template body is covered by walking each placed template
 * separately, and only its `children` — the page components it passes into the
 * template's `$children` slot — are descended here.
 */
function someNodeIn(items: readonly unknown[], trips: (node: TreeNode) => boolean): boolean {
  return items.some((item) => {
    if (item === null || typeof item !== 'object') return false
    const node = item as TreeNode
    if (referencedTemplateName(node) === undefined && trips(node)) return true
    return renderedChildLists(node).some((list) => someNodeIn(list, trips))
  })
}

/** Every node drawn from `items` itself that satisfies `keeps` — {@link someNodeIn}'s reach. */
function nodesIn(
  items: readonly unknown[],
  keeps: (node: TreeNode) => boolean
): readonly TreeNode[] {
  return items.flatMap((item) => {
    if (item === null || typeof item !== 'object') return []
    const node = item as TreeNode
    const nested = renderedChildLists(node).flatMap((list) => nodesIn(list, keeps))
    return referencedTemplateName(node) === undefined && keeps(node) ? [node, ...nested] : nested
  })
}

/**
 * Every node the renderer would draw that satisfies `keeps` — the same reach as
 * {@link someRenderedNode}, collected rather than asked. A node inside a
 * template is returned once however many times the template is placed.
 */
export const renderedNodesWhere = (
  items: readonly unknown[],
  placed: PlacedTemplates,
  keeps: (node: TreeNode) => boolean
): readonly TreeNode[] => [...nodesIn(items, keeps), ...nodesIn(placed, keeps)]

/**
 * Whether any node the renderer would draw — on the page, inside a placed
 * template at any depth, or only in a breakpoint's children — satisfies `trips`.
 */
export const someRenderedNode = (
  items: readonly unknown[],
  placed: PlacedTemplates,
  trips: (node: TreeNode) => boolean
): boolean => someNodeIn(items, trips) || someNodeIn(placed, trips)

/**
 * What the component-tree search reads off an app: its templates and each
 * page's components. The walk treats every node as an untyped tree, so the
 * decoded `App` and the authored (encoded) config both satisfy it.
 */
export type ComponentTreeSource = {
  readonly components?: Templates
  readonly pages?: ReadonlyArray<{ readonly components?: readonly unknown[] }>
}

/**
 * `componentTreeHasMatch` — the shared component-tree search behind every
 * "does this app place a component of kind X anywhere?" predicate
 * (`hasPageSearchComponent`, `appRequiresAi`).
 *
 * It asks its question of the page AS RENDERED, through the same reach the
 * page-cache verdict uses (`page-cacheability.ts`): each page's components,
 * every container's `children`, every breakpoint's `responsive.<bp>.children`,
 * the page components a reference passes into its template's `$children` slot,
 * and the template each `$ref` / `component` reference places, at any depth,
 * each template read once (which is also the cycle guard). A private walk used
 * to stand here that knew `children` and references but not breakpoints, so an
 * `ai-chat` or a page search placed only in a breakpoint's children was drawn
 * on the page and never counted at boot. Two walks that must agree about what
 * a page draws cannot be kept in step by review, so there is one.
 *
 * ## Why the caller supplies a PREDICATE, not a set of type names
 *
 * Merging two component types into one leaves questions that are about a
 * FIELD VALUE, not a name. `hasPageSearchComponent` has to find a
 * `search-input` whose `scope` is `page` and ignore one whose scope is
 * `subscribers`. `componentTreeHasType` builds the name-matching predicate for
 * the callers that still want one.
 *
 * @param app - The app's pages and templates, decoded or as authored.
 * @param matches - Predicate over a component node; ANY match answers `true`.
 * @returns `true` when at least one matching component is drawn on some page.
 */
export const componentTreeHasMatch = (
  app: ComponentTreeSource,
  matches: ComponentMatcher
): boolean => {
  const templates: Templates = app.components ?? []
  return (app.pages ?? []).some((page) => {
    const items = page.components ?? []
    return someRenderedNode(items, placedTemplatesOf(items, templates), matches)
  })
}

/**
 * `componentTreeHasMatch` for the common case: any component of one of `types`.
 *
 * Kept because most callers genuinely are asking about a name, and writing the
 * `typeof node.type === 'string'` guard at each of them is how one of them
 * eventually forgets it and matches a node with no `type` at all.
 *
 * @param app - Validated application schema.
 * @param types - The `type` literals to look for; ANY match answers `true`.
 * @returns `true` when at least one component of one of `types` is reachable.
 */
export const componentTreeHasType = (
  app: ComponentTreeSource,
  types: ReadonlySet<string>
): boolean =>
  componentTreeHasMatch(
    app,
    (node) => typeof node['type'] === 'string' && types.has(node['type'] as string)
  )
