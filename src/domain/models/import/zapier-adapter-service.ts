/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Zapier adapter: Zaps as `CanonicalFlow`s.
 *
 * It reads the two shapes a Zap reaches the import in:
 *
 * - **an export file**: the Zaps list's "Export Zaps" download, the Team
 *   "Download Zap workflows" file and the `Zapfile.json` of "Export my data",
 *   all `{ metadata, zaps: [{ id, title, nodes }] }`. `nodes` is keyed by step
 *   id, and each node names its parent (`parent_id`): the trigger has none, a
 *   step hangs under the one before it, a Paths step (`BranchingAPI` `branch`)
 *   has one `filter` child per path, ordered by `path_eval_index`, and each
 *   path's steps hang under its filter;
 * - **an API dump**: one Zap as `{ id, title, steps: [...] }` or
 *   `{ id, title, nodes: [...] }`, each step naming its app (`selected_api`),
 *   `action` and `type_of` but carrying no `params`. When its steps name their
 *   parent (`parent_id`), they form the same tree as an export file's and are
 *   read by the same code; when they do not, they are a chain in list order.
 *   Each step still maps to its registry target, and its inputs are TODOs. A
 *   step whose app is `null` is kept as a TODO, and a trigger whose app is
 *   `null` becomes a manual start carrying one. A file may hold one such Zap
 *   or a list of them.
 *
 * Nothing is dropped silently: a Zap with no first step, an entry of a list
 * that is not a Zap, and a file that holds no Zap each get a report line.
 *
 * A Zap is switched on in the source when its trigger is not paused, or when
 * an API dump says `state: "on"`.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { lookupTrigger } from './flow-step-mappings'
import {
  labelOf,
  pathOfNode,
  stepOfNode,
  triggerOfNode,
  zapierNodeOf,
  type ZapierNode,
} from './zapier-node-service'
import type { CanonicalFlow, CanonicalStep } from './canonical-flow'
import type { ImportReport } from './import-report'
import type { ZapierScope } from './zapier-expression-service'

type Json = Readonly<Record<string, unknown>>
type Edge = CanonicalFlow['edges'][number]

/** A file of a Zapier input: its path and its parsed content. */
export interface ZapierDocument {
  readonly path: string
  readonly json: unknown
}

/** What the adapter read. */
export interface ZapierRead {
  readonly flows: readonly CanonicalFlow[]
  /** What the conversion loses on a trigger, by Zap. */
  readonly notes: ImportReport['unmapped']
}

/** A Zap step of an API dump: an app (or `null`, when the dump names none) and no inputs. */
const isDumpStep = (step: unknown): boolean =>
  isRecord(step) && 'selected_api' in step && !('params' in step)

/** A Zap's steps as a list, when it lists them (`steps`, or `nodes` as an array). */
const stepListOf = (zap: Json): readonly unknown[] | undefined => {
  const { nodes, steps } = zap
  if (Array.isArray(nodes)) return nodes
  return Array.isArray(steps) ? steps : undefined
}

/**
 * An API-dump Zap: a non-empty list of steps, every one a dump step. A Zap
 * whose steps all name no app (`"selected_api": null`, its trigger included)
 * is still one: it is kept, each unnamed step a TODO.
 */
const isDumpZap = (zap: unknown): zap is Json => {
  if (!isRecord(zap)) return false
  const list = stepListOf(zap)
  return list !== undefined && list.length > 0 && list.every(isDumpStep)
}

/** A Zap of an export file: a node tree keyed by id, or a list of steps as a dump has. */
const isExportZap = (zap: unknown): zap is Json =>
  (isRecord(zap) && isRecord(zap['nodes'])) || isDumpZap(zap)

/** The Zaps of an export file, when at least one of its `zaps` holds a node tree. */
const zapsOfExport = (document: unknown): readonly unknown[] | undefined => {
  if (!isRecord(document)) return undefined
  const { zaps } = document
  return Array.isArray(zaps) && zaps.some(isExportZap) ? zaps : undefined
}

/** The Zaps of an API dump: one Zap, or a list holding at least one. */
const zapsOfDump = (document: unknown): readonly unknown[] | undefined => {
  if (isDumpZap(document)) return [document]
  return Array.isArray(document) && document.some(isDumpZap) ? document : undefined
}

/** Whether a parsed JSON document is a Zapier export file or API dump. */
export const isZapierExport = (document: unknown): boolean =>
  zapsOfExport(document) !== undefined || zapsOfDump(document) !== undefined

/** One Zap's steps and edges, read from its node tree. */
interface Graph {
  readonly steps: readonly CanonicalStep[]
  readonly edges: readonly Edge[]
}

const join = (...parts: readonly Graph[]): Graph => ({
  steps: parts.flatMap((part) => part.steps),
  edges: parts.flatMap((part) => part.edges),
})

/** A Zap step, read, with the id of the step it hangs under (`undefined` for the trigger). */
type TreeNode = Json & { readonly node: ZapierNode; readonly parent: string | undefined }

/** A Zap's node tree: each node's children, in id order, and how its curlies read. */
interface Tree {
  readonly children: (id: string) => readonly TreeNode[]
  readonly scope: ZapierScope
}

const evalIndex = (raw: Json): number => {
  const index = isRecord(raw['params']) ? Number(raw['params']['path_eval_index']) : Number.NaN
  return Number.isFinite(index) ? index : Number.MAX_SAFE_INTEGER
}

/** The steps under `id`, entered by an edge from `from` (labelled `branch`, if any). */
const chainUnder = (id: string, from: string, tree: Tree, branch?: string): Graph =>
  join(
    ...tree.children(id).map((child, index) => {
      const label = index === 0 ? branch : undefined
      return stepAndBelow(child, from, tree, label)
    })
  )

const edgeTo = (from: string, to: string, branch: string | undefined): Edge => ({
  from,
  to,
  ...(branch === undefined ? {} : { branch }),
})

/** A Paths step: one branch per child filter, each path's steps below its filter. */
const pathsBelow = (node: ZapierNode, tree: Tree): Graph => {
  const filters = tree
    .children(node.id)
    .toSorted((a, b) => evalIndex(a) - evalIndex(b) || Number(a.node.id) - Number(b.node.id))
  const paths = filters.map((filter, index) => ({
    path: pathOfNode(filter.node, index, tree.scope),
    filter,
  }))
  const names = paths.map((one, index) =>
    paths.findIndex((other) => other.path.name === one.path.name) === index
      ? one.path.name
      : `${one.path.name} (${String(index + 1)})`
  )
  const step: CanonicalStep = {
    id: node.id,
    name: labelOf({ ...node, title: node.title ?? 'Paths' }),
    kind: 'branch',
    branches: paths.map((one, index) => ({ ...one.path, name: names[index] ?? one.path.name })),
  }
  return join(
    { steps: [step], edges: [] },
    ...paths.map((one, index) => chainUnder(one.filter.node.id, node.id, tree, names[index]))
  )
}

function stepAndBelow(
  child: TreeNode,
  from: string,
  tree: Tree,
  branch: string | undefined
): Graph {
  const { node } = child
  const edge = edgeTo(from, node.id, branch)
  if (node.app === 'BranchingAPI' && node.action === 'branch') {
    return join({ steps: [], edges: [edge] }, pathsBelow(node, tree))
  }
  return join(
    { steps: [stepOfNode(node, tree.scope)], edges: [edge] },
    chainUnder(node.id, node.id, tree)
  )
}

/** A Zap's steps, keyed: a node tree keyed by id, or a list keyed by position. */
const rawNodesOf = (zap: Json): readonly (readonly [string, unknown])[] => {
  if (isRecord(zap['nodes'])) return Object.entries(zap['nodes'])
  return (stepListOf(zap) ?? []).map((raw, position) => [String(position + 1), raw] as const)
}

const parentOf = (raw: Json): string | undefined =>
  typeof raw['parent_id'] === 'number' || typeof raw['parent_id'] === 'string'
    ? String(raw['parent_id'])
    : undefined

/**
 * A Zap's steps with the step each hangs under. A step that names its parent
 * (`parent_id`, in an export or a dump that carries it) hangs under it; a list
 * whose steps name none is a chain, each step under the one before it.
 */
const nodesOf = (zap: Json): readonly TreeNode[] => {
  const entries = rawNodesOf(zap).flatMap(([key, raw]) =>
    isRecord(raw) ? [{ ...raw, node: zapierNodeOf(raw, key) }] : []
  )
  const tree = entries.some((one) => 'parent_id' in one)
  return entries.map((one, position) => ({
    ...one,
    parent: tree ? parentOf(one) : entries[position - 1]?.node.id,
  }))
}

const byId = (a: { readonly node: ZapierNode }, b: { readonly node: ZapierNode }) =>
  Number(a.node.id) - Number(b.node.id) || a.node.id.localeCompare(b.node.id)

const nameOf = (zap: Json, fallback: string): string => {
  const { title } = zap
  return typeof title === 'string' && title.trim() !== '' ? title.trim() : fallback
}

const note = (source: string, reason: string): ImportReport['unmapped'][number] => ({
  domain: 'automations',
  source,
  kind: 'other',
  reason,
})

/** The trigger's loss, when its registry row states one. */
const noteOf = (zap: string, trigger: ZapierNode): ImportReport['unmapped'] => {
  const loss = lookupTrigger('zapier', trigger.app, trigger.action)?.loss
  return loss === undefined
    ? []
    : [
        {
          domain: 'automations',
          source: `${zap} › ${labelOf(trigger)}`,
          kind: 'trigger',
          reason: loss,
        },
      ]
}

const NO_STEP = 'The Zap holds no step to start from, so it is not imported.'

/**
 * One Zap as a flow, from its node tree: the same tree for an export file and
 * an API dump, so Paths, their filters and the steps under each path read the
 * same from either. A Zap with no first step is reported, never dropped
 * silently.
 */
const flowOfZap = (zap: Json, path: string, index: number): ZapierRead => {
  const nodes = nodesOf(zap).toSorted(byId)
  const root = nodes.find((one) => one.parent === undefined)
  const sourceId = String(zap['id'] ?? root?.node.id ?? index + 1)
  const name = nameOf(zap, `Zap ${sourceId}`)
  if (root === undefined) return { flows: [], notes: [note(`${path} › ${name}`, NO_STEP)] }
  const tree: Tree = {
    children: (id) => nodes.filter((one) => one.parent === id),
    scope: { trigger: root.node.id },
  }
  const flow: CanonicalFlow = {
    tool: 'zapier',
    sourceId,
    name,
    active: root['paused'] === false || zap['state'] === 'on' || zap['is_enabled'] === true,
    trigger: triggerOfNode(root.node),
    ...chainUnder(root.node.id, 'trigger', tree),
  }
  return { flows: [flow], notes: noteOf(name, root.node) }
}

const NOT_A_ZAP = 'The entry is not a Zap: it lists no step, so it is not imported.'

const NO_ZAP =
  'The file holds no Zap: neither the `zaps` of an export file nor one Zap listing its steps.'

/** Every Zap of one document, and a report line for each entry that is not one. */
const readDocument = (document: ZapierDocument): readonly ZapierRead[] => {
  const exported = zapsOfExport(document.json)
  const zaps = exported ?? zapsOfDump(document.json)
  const isZap = exported === undefined ? isDumpZap : isExportZap
  if (zaps === undefined) return [{ flows: [], notes: [note(document.path, NO_ZAP)] }]
  return zaps.map((zap, index) =>
    isZap(zap)
      ? flowOfZap(zap, document.path, index)
      : { flows: [], notes: [note(`${document.path} › entry ${String(index + 1)}`, NOT_A_ZAP)] }
  )
}

/** Every Zap of a Zapier input, file by file in path order. */
export const adaptZapierExport = (documents: readonly ZapierDocument[]): ZapierRead => {
  const read = documents
    .toSorted((a, b) => a.path.localeCompare(b.path, 'en', { numeric: true }))
    .flatMap(readDocument)
  return { flows: read.flatMap((one) => one.flows), notes: read.flatMap((one) => one.notes) }
}
