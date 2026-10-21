/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { utilityOf } from '@/domain/models/app/pages/page-merge-layout-service'
import { migratedLiteral } from './migrated-literal-tokens-service'
import { RETOOL_CLASSIC_PAGE_MAPPINGS } from './retool-classic-page-mappings'
import { stringAttribute, type RsxElement } from './retool-toolscript-read'
import type { MappedNode, MigratedComponentMapping } from './migrated-page-mapping'
import type { RetoolPosition, RetoolPositions } from './retool-classic-export-read'

/**
 * The Retool classic components of a screen, drafted into the kit nodes they
 * become through `RETOOL_CLASSIC_PAGE_MAPPINGS` and nothing else, BEFORE any
 * node has its place: a draft is a node and the bindings it carried, or a
 * GHOST — a component the table does not hold, or one whose kit type needs a
 * value the export keeps behind a binding — which takes no place and is
 * reported where it sat. Placing the drafts (`retool-classic-pages-migrate.ts`)
 * gives every node and every ghost its path id at once.
 *
 * ─── ORDER AND ROWS (`.positions`, fact b3) ────────────────────────────────
 *
 * Siblings that all have a position are ordered by row, then column; any
 * other list keeps the file's order, which already follows the canvas (b4).
 * Nodes that share a row become a 12-column grid, each on its own columns. A
 * lone node that ends on the last column and starts after the first is
 * aligned to the end. Row heights are never carried: no export publishes a
 * row's pixel height (fact c5).
 *
 * ─── BINDINGS ──────────────────────────────────────────────────────────────
 *
 * A Retool expression (`{{ … }}`) only ever sits in a string value. Every
 * string attribute holding one is listed verbatim with the node it sat on,
 * and so are those of the parts a node absorbs (a table's columns and toolbar
 * buttons, a select's options) and of its `Event` handlers. A braced JSX value
 * such as `{{ showStepper: true }}` is code, not a binding, and is never
 * listed. A text whose value holds an expression arrives without content.
 */

/** A tab of a migrated `tabs` node. */
export interface RetoolTabPanel {
  readonly label: string
}

/** One kit node of a migrated Retool page, as the config writes it. */
export interface RetoolPageNode {
  readonly type: string
  readonly key?: string
  readonly element?: string
  readonly content?: string
  readonly triggerLabel?: string
  readonly props?: Readonly<Record<string, string>>
  readonly panels?: readonly RetoolTabPanel[]
  readonly children?: readonly RetoolPageNode[]
}

/** A binding a node carried: the component it sat on, and the expression verbatim. */
export interface DraftBinding {
  readonly component: string
  readonly expression: string
}

/** A node not yet placed, with the drafts it holds and the bindings it carried. */
export interface NodeDraft {
  readonly kind: 'node'
  readonly node: Omit<RetoolPageNode, 'children' | 'key'>
  readonly holdsChildren: boolean
  readonly children: readonly Draft[]
  readonly bindings: readonly DraftBinding[]
}

/** A component reported where it sat, with nothing drawn for it. */
export interface GhostDraft {
  readonly kind: 'ghost'
  readonly component: string
  readonly missing?: string
}

export type Draft = NodeDraft | GhostDraft

const EXPRESSION = /\{\{[\s\S]*?\}\}/

/** The components that are handlers: their bindings are their parent's, and they draw nothing. */
const HANDLERS: ReadonlySet<string> = new Set(['Event'])

/** The attribute each component's literal text is read from. */
const CONTENT_ATTRIBUTE: Readonly<Record<string, string>> = {
  Text: 'value',
  Button: 'text',
  Link: 'text',
  Alert: 'title',
}

const rowOf = (type: string): MigratedComponentMapping | undefined =>
  Object.hasOwn(RETOOL_CLASSIC_PAGE_MAPPINGS.components, type)
    ? RETOOL_CLASSIC_PAGE_MAPPINGS.components[type]
    : undefined

const idOf = (element: RsxElement): string | undefined => stringAttribute(element, 'id')

const ghost = (component: string, missing?: string): GhostDraft =>
  missing === undefined ? { kind: 'ghost', component } : { kind: 'ghost', component, missing }

const isGhost = (draft: Draft): draft is GhostDraft => draft.kind === 'ghost'

/** A literal string attribute, when it holds no expression, through {@link migratedLiteral}. */
const literalOf = (element: RsxElement, name: string): string | undefined => {
  const value = stringAttribute(element, name)
  return value === undefined || EXPRESSION.test(value) ? undefined : migratedLiteral(value)
}

/** The expressions of an element's own string attributes, verbatim. */
const ownBindings = (element: RsxElement): readonly DraftBinding[] =>
  [...element.attributes.values()].flatMap((value) =>
    value.kind === 'string' && EXPRESSION.test(value.value)
      ? [{ component: element.type, expression: value.value }]
      : []
  )

/** Every binding of a subtree the parent absorbs: its own, and its descendants'. */
const subtreeBindings = (element: RsxElement): readonly DraftBinding[] => [
  ...ownBindings(element),
  ...element.children.flatMap(subtreeBindings),
]

/** Whether a child is absorbed by its parent or is a handler: it draws nothing of its own. */
const isAbsorbed = (element: RsxElement): boolean =>
  HANDLERS.has(element.type) || rowOf(element.type)?.outcome === 'absorbed'

/** A node's bindings: its own, then those of the parts it absorbs and of its handlers. */
const bindingsOf = (element: RsxElement): readonly DraftBinding[] => [
  ...ownBindings(element),
  ...element.children.filter(isAbsorbed).flatMap(subtreeBindings),
]

const shellOf = (row: MappedNode): NodeDraft['node'] => ({
  type: row.type,
  ...(row.element !== undefined && row.element !== 'source-tag' ? { element: row.element } : {}),
})

const nodeDraft = (
  node: NodeDraft['node'],
  children: readonly Draft[] | undefined,
  bindings: readonly DraftBinding[]
): NodeDraft => ({
  kind: 'node',
  node,
  holdsChildren: children !== undefined,
  children: children ?? [],
  bindings,
})

/** The trigger label of a collapsible: its title, else the first literal text of its header. */
const triggerLabelOf = (element: RsxElement): string | undefined =>
  literalOf(element, 'title') ??
  element.children
    .filter((child) => child.type === 'Header')
    .flatMap((header) => header.children)
    .filter((child) => child.type === 'Text')
    .map((text) => literalOf(text, 'value'))
    .find((value) => value !== undefined && value !== '')

/** The value a required kit key takes from the component, or `undefined` when only a binding holds it. */
const requiredValueOf = (element: RsxElement, key: string): string | undefined =>
  key === 'triggerLabel' ? triggerLabelOf(element) : undefined

/** What drafting a list of siblings reads. */
export interface DraftContext {
  readonly positions: RetoolPositions
}

const mappedNodeOf = (element: RsxElement, row: MappedNode, context: DraftContext): Draft => {
  const required = (row.requires ?? []).map((key) => [key, requiredValueOf(element, key)] as const)
  const missing = required.find(([, value]) => value === undefined)
  if (missing !== undefined) return ghost(element.type, missing[0])
  const attribute = Object.hasOwn(CONTENT_ATTRIBUTE, element.type)
    ? CONTENT_ATTRIBUTE[element.type]
    : undefined
  const content =
    row.holds === 'content' && attribute !== undefined ? literalOf(element, attribute) : undefined
  const node = {
    ...shellOf(row),
    ...(content === undefined ? {} : { content }),
    ...Object.fromEntries(required),
  }
  const children =
    row.holds === 'children'
      ? draftSiblings(
          element.children.filter((child) => !isAbsorbed(child)),
          context
        )
      : undefined
  return nodeDraft(node, children, bindingsOf(element))
}

const views = (element: RsxElement): readonly RsxElement[] =>
  element.children.filter((child) => child.type === 'View')

/** A container holding more than one view is a tabbed container. */
const isTabbed = (element: RsxElement): boolean =>
  (element.type === 'Container' || element.type === 'TabbedContainer') && views(element).length > 1

const panelLabelOf = (view: RsxElement, index: number): string =>
  literalOf(view, 'label') || literalOf(view, 'viewKey') || `Tab ${index + 1}`

/** One panel's single child: the view's one node, else a container holding all it drew. */
const panelChildOf = (drafts: readonly Draft[]): Draft => {
  const [only] = drafts
  return drafts.length === 1 && only?.kind === 'node'
    ? only
    : nodeDraft({ type: 'container' }, drafts, [])
}

/**
 * A tabbed container: its header's other components first, then one `tabs`
 * node with a panel per view. The header's tab strip is the tab set's own and
 * is absorbed, its bindings listed on the `tabs` node.
 */
const tabbedDrafts = (element: RsxElement, context: DraftContext): readonly Draft[] => {
  const header = element.children
    .filter((child) => child.type === 'Header')
    .flatMap((h) => h.children)
  const strip = header.filter((child) => child.type === 'Tabs')
  const above = draftSiblings(
    header.filter((child) => child.type !== 'Tabs'),
    context
  )
  const panels = views(element).map((view, index) => ({
    label: panelLabelOf(view, index),
    child: panelChildOf(draftSiblings(view.children, context)),
  }))
  const bindings = [...bindingsOf(element), ...strip.flatMap(subtreeBindings)]
  const tabs = nodeDraft(
    { type: 'tabs', panels: panels.map(({ label }) => ({ label })) },
    panels.map(({ child }) => child),
    bindings
  )
  return [...above, tabs]
}

/** One element, drafted: the drafts it draws, or the ghost it is reported as. */
const draftElement = (element: RsxElement, context: DraftContext): readonly Draft[] => {
  if (HANDLERS.has(element.type)) return []
  const row = rowOf(element.type)
  if (row === undefined) return [ghost(element.type)]
  if (isTabbed(element)) return tabbedDrafts(element, context)
  if (row.outcome === 'transparent') return draftSiblings(element.children, context)
  if (row.outcome !== 'node') return []
  return [mappedNodeOf(element, row, context)]
}

const positionOf = (element: RsxElement, context: DraftContext): RetoolPosition | undefined => {
  const id = idOf(element)
  return id === undefined ? undefined : context.positions.get(id)
}

/** Siblings by row, then column, when every one has a position; else the file's order. */
const ordered = (
  elements: readonly RsxElement[],
  context: DraftContext
): readonly (readonly [RsxElement, RetoolPosition | undefined])[] => {
  const placed = elements.map((element) => [element, positionOf(element, context)] as const)
  const everyPlaced = placed.every(([, position]) => position !== undefined)
  return everyPlaced
    ? placed.toSorted(
        ([, a], [, b]) => (a?.row ?? 0) - (b?.row ?? 0) || (a?.col ?? 0) - (b?.col ?? 0)
      )
    : placed
}

const LAST_COLUMN = 12

const withClasses = (draft: Draft, classes: readonly string[]): Draft => {
  if (draft.kind === 'ghost') return draft
  const className = [draft.node.props?.['className'], ...classes].filter(Boolean).join(' ')
  return { ...draft, node: { ...draft.node, props: { ...draft.node.props, className } } }
}

/** A row of several nodes: a 12-column grid, each node on its own columns. */
const gridRowOf = (
  cells: readonly (readonly [RetoolPosition | undefined, readonly Draft[]])[]
): readonly Draft[] => {
  const children = cells.flatMap(([position, drafts]) =>
    drafts.map((draft) =>
      position === undefined
        ? draft
        : withClasses(draft, [
            ['col', 'start', String(position.col + 1)].join('-'),
            ['col', 'span', String(position.width)].join('-'),
          ])
    )
  )
  return [
    nodeDraft(
      { type: 'grid', props: { className: ['grid', 'cols', '12'].join('-') } },
      children,
      []
    ),
  ]
}

/** A row of one node, aligned to the end when it ends on the last column and starts after the first. */
const loneRowOf = (
  position: RetoolPosition | undefined,
  drafts: readonly Draft[]
): readonly Draft[] => {
  const end = utilityOf('justify', { kind: 'keyword', value: 'end' })
  const atEnd =
    position !== undefined && position.col > 0 && position.col + position.width >= LAST_COLUMN
  return atEnd && end !== undefined && drafts.filter((d) => !isGhost(d)).length === 1
    ? [nodeDraft({ type: 'flex', props: { className: end } }, drafts, [])]
    : drafts
}

type Placed = readonly [RsxElement, RetoolPosition | undefined]

/** Consecutive placed siblings grouped by the row they share; an unplaced sibling is a row alone. */
const rowsOf = (placed: readonly Placed[]): readonly (readonly Placed[])[] =>
  placed.reduce<readonly (readonly Placed[])[]>((rows, entry) => {
    const last = rows.at(-1)
    const lastRow = last?.at(-1)?.[1]?.row
    return entry[1] !== undefined && lastRow !== undefined && entry[1].row === lastRow && last
      ? [...rows.slice(0, -1), [...last, entry]]
      : [...rows, [entry]]
  }, [])

/**
 * Siblings drafted in order, row by row.
 *
 * @param elements - the sibling components, as the file holds them.
 * @param context - the positions of the frame they sit on.
 */
export const draftSiblings = (
  elements: readonly RsxElement[],
  context: DraftContext
): readonly Draft[] =>
  rowsOf(ordered(elements, context)).flatMap((row) => {
    const cells = row.map(
      ([element, position]) => [position, draftElement(element, context)] as const
    )
    const nodes = cells.flatMap(([, drafts]) => drafts).filter((draft) => !isGhost(draft))
    if (cells.length > 1 && nodes.length > 1) return gridRowOf(cells)
    const [first] = cells
    return cells.length === 1 && first !== undefined
      ? loneRowOf(first[0], first[1])
      : cells.flatMap(([, drafts]) => drafts)
  })
