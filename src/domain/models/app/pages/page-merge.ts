/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The page MERGE of `sovrium design-system import --pages`: one page of the
 * config, what a design tool made of it, and the patch and report that follow.
 *
 * It trusts no file that travelled with the drawing but the drawing itself.
 * The config's design tree and node map are recomputed by the caller from the
 * config on disk, and so is the BASELINE — the drawing an unedited export of
 * that config would hold, read back by the same tool parser. A property the
 * designer did not touch reads the same in both, whatever the parser makes of
 * it, so a null round trip is a no-op by construction.
 *
 * ─── MATCHING ──────────────────────────────────────────────────────────────
 *
 * A drawn node is matched to a page node by `key` first — the drawing's stamp
 * names the key each drawn id had at export, so a node the config moved since
 * is still found — then by path id, and only when the type is the same. A
 * drawn node matching nothing is a new node when it is a kit component, and
 * refused when it is not. A page node no drawn node matches is REMOVED only
 * when the stamp lists it: one it does not list was added to the config after
 * the export, the designer never saw it, and it stays where it was.
 *
 * ─── STRUCTURE ─────────────────────────────────────────────────────────────
 *
 * The drawing's structure is read from its base board. Each page node is
 * written where the drawing puts it, its config bindings and rules carried
 * along; a template placement and an island keep what their template or their
 * rows draw inside them whatever the drawing shows. The components a page
 * passes to a placement's slots are page nodes, written back into the slot
 * they were exported from. A move is a node whose parent changed, or
 * whose order among the siblings it already had changed — a node that only
 * shifted because a sibling came or went did not move.
 *
 * Pure: no I/O, no clock, the same inputs always give the same plan.
 */

import { drawnNodesById, placedDrawnNodes } from './page-drawing'
import {
  addedLayout,
  joinFindings,
  NO_FINDINGS,
  nodeEdits,
  treeAsDrawn,
  variantPropertyOf,
  withText,
  type CurrentNode,
  type Findings,
  type KitVocabulary,
  type MergeMapEntry,
  type PageImportPageReport,
} from './page-merge-edits-service'
import { matchByPosition, reshapedUnstamped, unstamped } from './page-merge-position-service'
import { ruleFindings } from './page-merge-rules-service'
import type {
  DrawnConflict,
  DrawnLayout,
  DrawnNode,
  DrawnPage,
  DrawnStampEntry,
  PlacedDrawnNode,
} from './page-drawing'
import type { SpacingSteps } from './page-merge-layout-service'
import type { PaintTokens } from './page-merge-paint-service'
import type { RuleReferences } from './page-merge-rules-service'
import type { TranslationScope, TranslationWrite } from './page-merge-translation-service'
import type { PageDesignTreeNode } from '@/domain/models/api/admin/design-system/page-design-tree'
import type { PageNodeMap } from '@/domain/models/api/admin/design-system/page-node-map'

export type { KitVocabulary, PageImportPageReport } from './page-merge-edits-service'

type Node = Readonly<Record<string, unknown>>

/** What one page is merged from. */
export interface PageMergeInput {
  /** The page entry, as the config writes it. */
  readonly page: Node
  /** The page's design tree, recomputed from the config. */
  readonly tree: readonly PageDesignTreeNode[]
  /** The page's node map entry, recomputed from the config. */
  readonly nodeMap: PageNodeMap['pages'][number]
  /** What the designer handed back. */
  readonly drawn: DrawnPage
  /** What an unedited export of the config would hold, read by the same parser. */
  readonly baseline: DrawnPage
  /** The spacing steps lengths are read against: the app's, else the default scale. */
  readonly spacing: SpacingSteps
  readonly kit: KitVocabulary
  /** The app's languages, which a translated edit is written to. */
  readonly languages?: TranslationScope | undefined
  /** Each template's definition, by name, which a placement's inside is read against. */
  readonly templates?: ReadonlyMap<string, Node> | undefined
  /** The app's colour and type tokens, which a drawn paint is read against. */
  readonly paint?: PaintTokens | undefined
  /** What the config declares that a rule a drawing carries may name. */
  readonly references?: RuleReferences | undefined
}

/** The merge of one page: the patched entry when anything is written, and its report. */
export interface PageMergePlan {
  /** The patched page entry, or `undefined` when the drawing changes nothing written. */
  readonly patch: Node | undefined
  readonly report: PageImportPageReport
  /** How many template and library-block placements the drawing held. */
  readonly templatesFound: number
  /** The default-language translation entries the page's translated edits write. */
  readonly translationWrites: readonly TranslationWrite[]
}

/** A matched node, where the merge wrote it. */
interface Placement {
  readonly current: CurrentNode
  readonly newId: string
  /** The new parent: a page node's id, `added:<at>` for a new node, `''` at the top. */
  readonly newParent: string
}

/** What building one list of children produced. */
interface Built {
  readonly list: readonly unknown[]
  readonly placements: readonly Placement[]
  readonly added: PageImportPageReport['added']
  readonly findings: Findings
}

const EMPTY_BUILT: Built = { list: [], placements: [], added: [], findings: NO_FINDINGS }

const joinBuilt = (a: Built, b: Built): Built => ({
  list: [...a.list, ...b.list],
  placements: [...a.placements, ...b.placements],
  added: [...a.added, ...b.added],
  findings: joinFindings(a.findings, b.findings),
})

/** Everything one page's build reads. */
interface MergeContext {
  readonly input: PageMergeInput
  readonly pageName: string
  readonly current: readonly CurrentNode[]
  readonly matches: ReadonlyMap<string, CurrentNode>
  readonly claimed: ReadonlySet<string>
  readonly baseline: ReadonlyMap<string, DrawnNode>
}

/** Every page node of the tree, depth first, with its parent and place. */
const flattenTree = (
  nodes: readonly PageDesignTreeNode[],
  entries: ReadonlyMap<string, MergeMapEntry>,
  parent = '',
  offset = 0
): readonly CurrentNode[] =>
  nodes.reduce<readonly CurrentNode[]>((acc, tree, index) => {
    const order = offset + acc.length
    const self: CurrentNode = {
      id: tree.id,
      ...(tree.key === undefined ? {} : { key: tree.key }),
      type: tree.type,
      tree,
      entry: entries.get(tree.id),
      parent,
      index,
      order,
    }
    return [...acc, self, ...flattenTree(tree.children, entries, tree.id, order + 1)]
  }, [])

/** Which page node each drawn position is matched to: by key, then by path with the same type. */
const matchDrawn = (
  drawn: readonly PlacedDrawnNode[],
  current: readonly CurrentNode[],
  stamp: ReadonlyMap<string, DrawnStampEntry>
): ReadonlyMap<string, CurrentNode> => {
  const byKey = new Map(
    current.flatMap((node) => (node.key === undefined ? [] : [[node.key, node] as const]))
  )
  const byId = new Map(current.map((node) => [node.id, node] as const))
  const claim = (
    matches: ReadonlyMap<string, CurrentNode>,
    pick: (id: string) => CurrentNode | undefined
  ): ReadonlyMap<string, CurrentNode> =>
    drawn.reduce<ReadonlyMap<string, CurrentNode>>((acc, { at, node }) => {
      if (acc.has(at) || node.id === undefined) return acc
      const candidate = pick(node.id)
      if (candidate === undefined || candidate.type !== node.type) return acc
      const taken = [...acc.values()].some((matched) => matched.id === candidate.id)
      return taken ? acc : new Map([...acc, [at, candidate]])
    }, matches)
  const byStampedKey = claim(new Map(), (id) => {
    const key = stamp.get(id)?.key
    return key === undefined ? undefined : byKey.get(key)
  })
  return claim(byStampedKey, (id) => {
    const candidate = byId.get(id)
    const stampedKey = stamp.get(id)?.key
    // The node at that path now is not the one the drawing was made of.
    const other =
      stampedKey !== undefined && candidate?.key !== undefined && stampedKey !== candidate.key
    return other ? undefined : candidate
  })
}

/** Whether a drawing of a declared page carries no export stamp and was reshaped (see `reshapedUnstamped`). */
export const isReshapedUnstampedDrawing = (
  input: Pick<PageMergeInput, 'page' | 'tree' | 'nodeMap' | 'drawn'>
): boolean => {
  const entries = new Map(input.nodeMap.nodes.map((entry) => [entry.id, entry] as const))
  const current = flattenTree(input.tree, entries)
  return reshapedUnstamped(input.drawn, current, String(input.page['name']))
}

/** Whether the export drew a page node: the stamp lists its key, or its path with no key. */
const stampListed = (node: CurrentNode, stamp: readonly DrawnStampEntry[]): boolean =>
  node.key === undefined
    ? stamp.some((entry) => entry.id === node.id && entry.key === undefined)
    : stamp.some((entry) => entry.key === node.key)

/** The RFC 6901 segments of a pointer, unescaped. */
const segmentsOf = (pointer: string): readonly string[] =>
  pointer
    .split('/')
    .slice(1)
    .map((segment) => segment.replaceAll('~1', '/').replaceAll('~0', '~'))

/** The config node a page node id points at. */
const configNodeOf = (page: Node, pageName: string, id: string): Node =>
  segmentsOf(id.slice(pageName.length + 1)).reduce<unknown>(
    (node, segment) =>
      typeof node === 'object' && node !== null
        ? (node as Readonly<Record<string, unknown>>)[segment]
        : undefined,
    page
  ) as Node

const isLocked = (node: CurrentNode): boolean =>
  node.entry?.provenance !== undefined ||
  node.entry?.island !== undefined ||
  node.tree.locked !== undefined

/** One drawn item of a list, before the list is laid out. */
type Item =
  | { readonly kind: 'matched'; readonly placed: PlacedDrawnNode; readonly current: CurrentNode }
  | { readonly kind: 'added'; readonly placed: PlacedDrawnNode }
  | { readonly kind: 'kept'; readonly current: CurrentNode }

/**
 * The property a kit type keeps its required label in, which a new node of
 * that type takes from the text drawn on it: a collapsible's trigger.
 */
const REQUIRED_LABELS: Readonly<Record<string, string>> = { collapsible: 'triggerLabel' }

/** Whether a new kit node lacks the label its type requires: none was drawn on it. */
const lacksRequiredLabel = (node: DrawnNode): boolean =>
  node.type !== undefined &&
  REQUIRED_LABELS[node.type] !== undefined &&
  (node.content ?? '').trim() === ''

/** A new node refused for the value its type requires and the drawing does not show. */
const requiredValueMissing = (
  id: string,
  node: DrawnNode
): PageImportPageReport['refused'][number] => ({
  node: id,
  code: 'REQUIRED_VALUE_MISSING',
  reason: `A new ${node.type ?? ''} needs a ${REQUIRED_LABELS[node.type ?? ''] ?? 'value'}, and none is drawn on it, so it was not added; draw its label, or add it in the config.`,
})

/** A layer that is no kit component, refused by name. */
const notAKitComponent = (
  id: string,
  node: DrawnNode
): PageImportPageReport['refused'][number] => ({
  node: id,
  code: 'NOT_A_KIT_COMPONENT',
  reason: `The layer "${node.name ?? node.type ?? 'unnamed'}" is no kit component, so it was not imported; draw it with a component of the kit.`,
})

/**
 * The drawn items of one list: a matched node, a new kit node, and the kit
 * nodes inside a layer that is no kit component, which is refused and
 * unwrapped rather than lost with its content.
 */
const drawnItems = (
  context: MergeContext,
  placed: readonly PlacedDrawnNode[],
  arrayPointer: string
): { readonly items: readonly Item[]; readonly refused: Findings['refused'] } =>
  placed.reduce<{ readonly items: readonly Item[]; readonly refused: Findings['refused'] }>(
    (acc, entry) => {
      const current = context.matches.get(entry.at)
      if (current !== undefined) {
        return { ...acc, items: [...acc.items, { kind: 'matched', placed: entry, current }] }
      }
      const kit = entry.node.type !== undefined && context.input.kit.types.has(entry.node.type)
      if (kit && !lacksRequiredLabel(entry.node)) {
        return { ...acc, items: [...acc.items, { kind: 'added', placed: entry }] }
      }
      // Refused, and unwrapped: its kit nodes are kept rather than lost with it.
      const id = `${context.pageName}:${arrayPointer}/${acc.items.length}`
      const inner = drawnItems(context, childPlacements(entry), arrayPointer)
      const refusal = kit ? requiredValueMissing(id, entry.node) : notAKitComponent(id, entry.node)
      return {
        items: [...acc.items, ...inner.items],
        refused: [...acc.refused, refusal, ...inner.refused],
      }
    },
    { items: [], refused: [] }
  )

/** A drawn node's children, each with its position. */
const childPlacements = ({ at, node }: PlacedDrawnNode): readonly PlacedDrawnNode[] =>
  node.children.map((child, index) => ({ at: `${at}.${index}`, node: child }))

/** The page nodes of a parent the drawing never saw, which stay at their place. */
const keptItems = (
  context: MergeContext,
  parentId: string,
  slot: string | undefined
): readonly CurrentNode[] =>
  context.current.filter(
    (node) =>
      node.parent === parentId &&
      (slot === undefined || slotOfNode(parentId, node.id) === slot) &&
      !context.claimed.has(node.id) &&
      !stampListed(node, context.input.drawn.stamp)
  )

/** The items with each kept page node put back at its index. */
const withKept = (items: readonly Item[], kept: readonly CurrentNode[]): readonly Item[] =>
  kept.reduce<readonly Item[]>((acc, current) => {
    const at = Math.min(current.index, acc.length)
    return [...acc.slice(0, at), { kind: 'kept', current }, ...acc.slice(at)]
  }, items)

/** The final list: the original string children at their places, the items in the others. */
const interleave = (
  original: readonly unknown[],
  items: readonly Item[]
): readonly (Item | string)[] => {
  const walked = original.reduce<{
    readonly out: readonly (Item | string)[]
    readonly next: number
  }>(
    (acc, child) =>
      typeof child === 'string'
        ? { ...acc, out: [...acc.out, child] }
        : acc.next < items.length
          ? { out: [...acc.out, items[acc.next] as Item], next: acc.next + 1 }
          : acc,
    { out: [], next: 0 }
  )
  return [...walked.out, ...items.slice(walked.next)]
}

/** A new node's own properties: its type, variant (a badge's as its tone), size and label. */
const bareAddedNode = (node: DrawnNode, label: string | undefined): Node => ({
  type: node.type,
  ...(node.variant === undefined
    ? {}
    : { [variantPropertyOf(node.type, node.variant)]: node.variant }),
  ...(node.size === undefined ? {} : { size: node.size }),
  ...(label === undefined || node.content === undefined ? {} : { [label]: node.content }),
})

/** The table a page reads, when its data source names one. */
const pageTableOf = (page: Node): string | undefined => {
  const table = (page['dataSource'] as { readonly table?: unknown } | undefined)?.table
  return typeof table === 'string' ? table : undefined
}

/**
 * The rules a new node carries, judged as an edited node's are against an
 * export that drew none: a binding, a visibility rule, a data source, a form
 * reference and a button link, each written in the config's own shape.
 */
const addedRules = (context: MergeContext, id: string, node: DrawnNode) =>
  ruleFindings(
    { node: id, entry: undefined, drawn: node.rules, baseline: undefined },
    { references: context.input.references, pageTable: pageTableOf(context.input.page) }
  )

/**
 * A new kit node, built from what was drawn, its rules carried. An addition
 * is all or nothing: a node whose rule names what the config does not declare
 * is refused by name and left out, so no grid reading nothing and no form
 * posting nowhere is written. The text a bound node draws is its sample,
 * never read as copy.
 */
const buildAdded = (context: MergeContext, entry: PlacedDrawnNode, pointer: string): Built => {
  const id = `${context.pageName}:${pointer}`
  const rules = addedRules(context, id, entry.node)
  if (rules.refused.length > 0) {
    return { ...EMPTY_BUILT, findings: { ...NO_FINDINGS, refused: rules.refused } }
  }
  const node: DrawnNode = rules.rebound ? { ...entry.node, content: undefined } : entry.node
  const children = buildList(context, childPlacements(entry), {
    parentKey: `added:${entry.at}`,
    parentId: undefined,
    original: [],
    pointer: `${pointer}/children`,
  })
  const layout = addedLayout(id, node, context.input.spacing)
  const label = REQUIRED_LABELS[String(node.type)]
  const bare = bareAddedNode(node, label)
  const withChildren: Node =
    children.list.length > 0
      ? { ...bare, children: children.list }
      : node.content === undefined || label !== undefined
        ? bare
        : withText(bare, node.content, context.input.kit)
  const built: Node =
    children.list.length > 0 &&
    node.content !== undefined &&
    context.input.kit.contentTypes.has(String(node.type))
      ? { ...withChildren, content: node.content }
      : withChildren
  return {
    list: [rules.apply(layout.apply(built))],
    placements: children.placements,
    added: [{ node: id, type: String(node.type) }, ...children.added],
    findings: joinFindings(
      { ...layout.findings, ignored: [...layout.findings.ignored, ...rules.ignored] },
      children.findings
    ),
  }
}

/** A matched page node, written where it was drawn with its edits. */
const buildMatched = (
  context: MergeContext,
  entry: PlacedDrawnNode,
  current: CurrentNode,
  placement: { readonly pointer: string; readonly parentKey: string }
): Built => {
  const config = configNodeOf(context.input.page, context.pageName, current.id)
  const baseline = context.baseline.get(current.id) ?? treeAsDrawn(current.tree)
  const edits = nodeEdits(
    { current, drawn: entry.node, baseline, config },
    {
      ...context.input,
      samplesDrawn: context.input.drawn.samplesDrawn,
      pageTable: pageTableOf(context.input.page),
    }
  )
  const self: Placement = {
    current,
    newId: `${context.pageName}:${placement.pointer}`,
    newParent: placement.parentKey,
  }
  if (current.entry?.provenance?.kind === 'template') {
    const slotted = buildSlotted(context, entry, current, {
      pointer: placement.pointer,
      config,
    })
    return {
      list: [edits.apply(slotted.node)],
      placements: [self, ...slotted.built.placements],
      added: slotted.built.added,
      findings: joinFindings(edits.findings, slotted.built.findings),
    }
  }
  if (isLocked(current)) {
    return { list: [edits.apply(config)], placements: [self], added: [], findings: edits.findings }
  }
  const original = Array.isArray(config['children'])
    ? (config['children'] as readonly unknown[])
    : []
  const children = buildList(context, childPlacements(entry), {
    parentKey: current.id,
    parentId: current.id,
    original,
    pointer: `${placement.pointer}/children`,
  })
  const rebuilt: Node =
    config['children'] === undefined && children.list.length === 0
      ? config
      : { ...config, children: children.list }
  return {
    list: [edits.apply(rebuilt)],
    placements: [self, ...children.placements],
    added: children.added,
    findings: joinFindings(edits.findings, children.findings),
  }
}

/**
 * The slot a page node sits in under a placement: `children`, or
 * `slots/<name>`, read off its path id; `undefined` for any other node.
 */
const slotOfNode = (placementId: string, id: string): string | undefined => {
  if (!id.startsWith(`${placementId}/`)) return undefined
  const [first, second] = id.slice(placementId.length + 1).split('/')
  if (first === 'children') return 'children'
  return first === 'slots' && second !== undefined ? `slots/${second}` : undefined
}

/**
 * A template placement's slots, rebuilt from the drawing: the page's own
 * components in each slot are page nodes, edited, moved, added and removed as
 * any other; what the template draws around them is never written. A drawn
 * node is put back in the slot it was exported from, and a new one in the
 * default slot.
 */
const buildSlotted = (
  context: MergeContext,
  entry: PlacedDrawnNode,
  current: CurrentNode,
  { pointer, config }: { readonly pointer: string; readonly config: Node }
): { readonly node: Node; readonly built: Built } => {
  const slots = (
    typeof config['slots'] === 'object' && config['slots'] !== null ? config['slots'] : {}
  ) as Node
  const lists = [
    ['children', config['children']] as const,
    ...Object.entries(slots).map(([name, list]) => [`slots/${name}`, list] as const),
  ]
  const placed = childPlacements(entry)
  const slotOfPlaced = (child: PlacedDrawnNode): string => {
    const matched = context.matches.get(child.at)
    return (matched === undefined ? undefined : slotOfNode(current.id, matched.id)) ?? 'children'
  }
  const builtLists = lists.map(([slot, original]) => {
    const built = buildList(
      context,
      placed.filter((child) => slotOfPlaced(child) === slot),
      {
        parentKey: current.id,
        parentId: current.id,
        original: Array.isArray(original) ? (original as readonly unknown[]) : [],
        pointer: `${pointer}/${slot}`,
        slot,
      }
    )
    return [slot, built] as const
  })
  const listOf = (slot: string): readonly unknown[] | undefined =>
    builtLists.find(([candidate]) => candidate === slot)?.[1].list
  const children = listOf('children')
  const named = Object.keys(slots).map((name) => [name, listOf(`slots/${name}`) ?? []] as const)
  return {
    node: {
      ...config,
      ...(children === undefined || (config['children'] === undefined && children.length === 0)
        ? {}
        : { children }),
      ...(named.length === 0 ? {} : { slots: Object.fromEntries(named) }),
    },
    built: builtLists.reduce<Built>((acc, [, built]) => joinBuilt(acc, built), EMPTY_BUILT),
  }
}

/** Where a list is built, and what it held before. */
interface ListPlace {
  /** The parent as placements name it. */
  readonly parentKey: string
  /** The parent page node, whose unseen children are kept; `undefined` for a new node. */
  readonly parentId: string | undefined
  /** The list as the config writes it. */
  readonly original: readonly unknown[]
  /** The pointer of the list itself. */
  readonly pointer: string
  /** For a placement's slot, which one (`children`, `slots/<name>`): only its nodes are kept. */
  readonly slot?: string | undefined
}

/** One list of children, built from the drawing. */
function buildList(
  context: MergeContext,
  placed: readonly PlacedDrawnNode[],
  place: ListPlace
): Built {
  const drawn = drawnItems(context, placed, place.pointer)
  const kept = place.parentId === undefined ? [] : keptItems(context, place.parentId, place.slot)
  const laidOut = interleave(place.original, withKept(drawn.items, kept))
  const built = laidOut.reduce<Built>((acc, item, index) => {
    const pointer = `${place.pointer}/${index}`
    if (typeof item === 'string') return { ...acc, list: [...acc.list, item] }
    if (item.kind === 'kept') {
      // A node the designer never saw is written as the config has it.
      const config = configNodeOf(context.input.page, context.pageName, item.current.id)
      return { ...acc, list: [...acc.list, config] }
    }
    if (item.kind === 'added') return joinBuilt(acc, buildAdded(context, item.placed, pointer))
    return joinBuilt(
      acc,
      buildMatched(context, item.placed, item.current, { pointer, parentKey: place.parentKey })
    )
  }, EMPTY_BUILT)
  return {
    ...built,
    findings: joinFindings({ ...NO_FINDINGS, refused: drawn.refused }, built.findings),
  }
}

/** The matched nodes that moved: to another parent, or out of order among their old siblings. */
const movesOf = (placements: readonly Placement[]): PageImportPageReport['moved'] => {
  const byParent = Map.groupBy(placements, (placement) => placement.newParent)
  return placements.flatMap((placement) => {
    const { current } = placement
    if (current.id === placement.newId) return []
    if (current.parent !== placement.newParent) return [{ node: current.id, to: placement.newId }]
    const stayed = (byParent.get(placement.newParent) ?? []).filter(
      (sibling) => sibling.current.parent === placement.newParent
    )
    const newRank = stayed.indexOf(placement)
    const oldRank = stayed.toSorted((a, b) => a.current.index - b.current.index).indexOf(placement)
    return newRank === oldRank ? [] : [{ node: current.id, to: placement.newId }]
  })
}

/** The page nodes the drawing deleted: unmatched, drawn by the export, the topmost of a subtree. */
const removedOf = (context: MergeContext): readonly string[] => {
  const removed = new Set(
    context.current
      .filter(
        (node) => !context.claimed.has(node.id) && stampListed(node, context.input.drawn.stamp)
      )
      .map((node) => node.id)
  )
  return context.current
    .filter((node) => removed.has(node.id) && !removed.has(node.parent))
    .map((node) => node.id)
}

/** A page setting the drawing shows, compared with an unedited drawing. */
const settingsRefusals = (input: PageMergeInput, pageName: string): Findings['refused'] =>
  input.drawn.title !== undefined &&
  input.baseline.title !== undefined &&
  input.drawn.title !== input.baseline.title
    ? [
        {
          node: `${pageName}:/meta/title`,
          code: 'PAGE_SETTINGS_EDIT',
          reason:
            "The page title is the page's meta, which the config keeps; change it in the config.",
        },
      ]
    : []

/**
 * What a drawing holds less what an unedited drawing holds too, counted: a
 * finding the export draws twice is set aside twice, and a third is new.
 */
const freshOf = <T>(drawn: readonly T[], unedited: readonly T[], keyOf: (entry: T) => string) => {
  const counts = unedited.reduce<ReadonlyMap<string, number>>(
    (acc, entry) => new Map([...acc, [keyOf(entry), (acc.get(keyOf(entry)) ?? 0) + 1]]),
    new Map()
  )
  return drawn.reduce<{ readonly kept: readonly T[]; readonly left: ReadonlyMap<string, number> }>(
    (acc, entry) => {
      const left = acc.left.get(keyOf(entry)) ?? 0
      return left > 0
        ? { kept: acc.kept, left: new Map([...acc.left, [keyOf(entry), left - 1]]) }
        : { kept: [...acc.kept, entry], left: acc.left }
    },
    { kept: [], left: counts }
  ).kept
}

/**
 * Whether a conflict only sets the export's own `data-kit-layout` against a
 * value the config already holds: that stamp lags the class the designer
 * wrote, and once the config holds that class's value the board changes
 * nothing. A conflict between two sources a designer writes is always named.
 */
const isSettledConflict = (
  unedited: ReadonlyMap<string, DrawnNode>,
  conflict: DrawnConflict
): boolean =>
  conflict.overridden.every((source) => source === 'data-kit-layout') &&
  layoutValueAt(unedited.get(conflict.node), conflict.property) === conflict.value

/** A node's layout value at a dotted path (`layout.gap`, `responsive.md.gap`). */
const layoutValueAt = (node: DrawnNode | undefined, path: string): string | undefined => {
  const [scope, first = '', second = ''] = path.split('.')
  const [layout, property] =
    scope === 'layout' ? [node?.layout, first] : [node?.responsive?.[first], second]
  return layout?.[property as keyof DrawnLayout]?.value
}

/** The findings a parser worded itself, less those an unedited drawing holds too. */
const parserReports = (
  input: PageMergeInput
): {
  readonly refused: Findings['refused']
  readonly ignored: Findings['ignored']
  readonly conflicts: NonNullable<PageImportPageReport['conflicts']>
} => {
  const fresh = (
    pick: (
      page: DrawnPage
    ) => readonly { readonly node: string; readonly reason: string }[] | undefined
  ) =>
    freshOf(
      pick(input.drawn) ?? [],
      pick(input.baseline) ?? [],
      (entry) => `${entry.node} ${entry.reason}`
    )
  const unedited = drawnNodesById(input.baseline)
  return {
    refused: fresh((page) => page.reported?.notAKitComponent).map((entry) => ({
      node: entry.node,
      code: 'NOT_A_KIT_COMPONENT' as const,
      reason: entry.reason,
    })),
    ignored: fresh((page) => page.reported?.unread),
    conflicts: freshOf(
      input.drawn.reported?.conflicts ?? [],
      input.baseline.reported?.conflicts ?? [],
      (entry) => JSON.stringify(entry)
    )
      .filter((entry) => !isSettledConflict(unedited, entry))
      .map(({ node, property, kept, overridden, value }) => ({
        node,
        property,
        kept,
        overridden,
        value,
      })),
  }
}

/** The order a report lists a page's changes in: by node, then by property. */
const byNodeThenProperty =
  (order: ReadonlyMap<string, number>) =>
  (
    a: { readonly node: string; readonly property: string },
    b: { readonly node: string; readonly property: string }
  ): number =>
    (order.get(a.node) ?? Number.MAX_SAFE_INTEGER) -
      (order.get(b.node) ?? Number.MAX_SAFE_INTEGER) || a.property.localeCompare(b.property)

/**
 * Merge one page's drawing into its config entry.
 *
 * @param input - the page entry, its recomputed tree and node map, the drawing and its baseline.
 * @returns the patched entry (or `undefined` when nothing is written) and the page report.
 */
export const planPageMerge = (input: PageMergeInput): PageMergePlan => {
  const pageName = String(input.page['name'])
  const entries = new Map(input.nodeMap.nodes.map((entry) => [entry.id, entry] as const))
  const current = flattenTree(input.tree, entries)
  const stamp = new Map(input.drawn.stamp.map((entry) => [entry.id, entry] as const))
  const placed = placedDrawnNodes(input.drawn.nodes)
  const matches = unstamped(input.drawn, placed)
    ? matchByPosition(placed, current, pageName)
    : matchDrawn(placed, current, stamp)
  const context: MergeContext = {
    input,
    pageName,
    current,
    matches,
    claimed: new Set([...matches.values()].map((node) => node.id)),
    baseline: drawnNodesById(input.baseline),
  }
  const components = Array.isArray(input.page['components'])
    ? (input.page['components'] as readonly unknown[])
    : []
  const built = buildList(
    context,
    input.drawn.nodes.map((node, index) => ({ at: String(index), node })),
    { parentKey: '', parentId: '', original: components, pointer: '/components' }
  )
  const order = new Map(current.map((node) => [node.id, node.order] as const))
  const moved = movesOf(built.placements)
  const removed = removedOf(context)
  const changes = built.findings.changes.toSorted(byNodeThenProperty(order))
  const reported = parserReports(input)
  const report: PageImportPageReport = {
    name: pageName,
    matched: [...context.claimed].toSorted((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0)),
    moved,
    added: built.added,
    removed,
    changes,
    offScale: built.findings.offScale,
    refused: [...settingsRefusals(input, pageName), ...built.findings.refused, ...reported.refused],
    translations: built.findings.translations,
    ignored: [...built.findings.ignored, ...reported.ignored],
    ...(reported.conflicts.length === 0 ? {} : { conflicts: reported.conflicts }),
  }
  const writes =
    moved.length > 0 || built.added.length > 0 || removed.length > 0 || changes.length > 0
  return {
    patch: writes ? { ...input.page, components: built.list } : undefined,
    report,
    templatesFound: [...matches.values()].filter((node) => {
      const kind = node.entry?.provenance?.kind
      return kind === 'template' || kind === 'library-block'
    }).length,
    translationWrites: built.findings.writes,
  }
}
