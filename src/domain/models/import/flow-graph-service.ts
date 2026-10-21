/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A flow's step graph as nested blocks, the shape a Sovrium automation has.
 *
 * A source draws a graph; a Sovrium automation is a list of actions where a
 * branch holds one list per path and a loop holds the list it repeats. The
 * graph is walked from the trigger:
 *
 * - a plain step is followed by its successors; several successors (one output
 *   wired to several nodes) run one after the other, in edge order;
 * - a branch step's outgoing edges name the branch they leave by (`branch`);
 *   an unlabelled edge leaves by the first branch. The steps reached from one
 *   branch only form that path; the first step reached from two or more is
 *   where the paths join, and the walk resumes there after the branch;
 * - a loop step's `done` edges continue after the loop; every other edge is
 *   its body, which ends where it leads back to the loop.
 *
 * A step no edge reaches is appended after the rest, in source order, so
 * nothing the source holds is lost.
 */

import type { CanonicalCondition, CanonicalFlow, CanonicalStep } from './canonical-flow'

type BranchStep = Extract<CanonicalStep, { readonly kind: 'branch' }>
type LoopStep = Extract<CanonicalStep, { readonly kind: 'loop' }>

/** One path of a branch: its label, its condition, and the steps it runs. */
export interface FlowPath {
  readonly name: string
  readonly condition?: CanonicalCondition | undefined
  readonly block: FlowBlock
}

/** One entry of a block. */
export type FlowItem =
  | { readonly kind: 'step'; readonly step: CanonicalStep }
  | { readonly kind: 'branch'; readonly step: BranchStep; readonly paths: readonly FlowPath[] }
  | { readonly kind: 'loop'; readonly step: LoopStep; readonly body: FlowBlock }

/** Steps run in order. */
export type FlowBlock = readonly FlowItem[]

interface Walk {
  readonly block: FlowBlock
  readonly seen: ReadonlySet<string>
}

interface Graph {
  readonly byId: ReadonlyMap<string, CanonicalStep>
  readonly out: (id: string) => CanonicalFlow['edges']
}

const withAll = (set: ReadonlySet<string>, ids: readonly string[]): ReadonlySet<string> =>
  new Set([...set, ...ids])

/** Every step reachable from `entries`, never entering a `stop` step. */
const reach = (
  graph: Graph,
  entries: readonly string[],
  stop: ReadonlySet<string>
): readonly string[] => {
  const expand = (frontier: readonly string[], found: readonly string[]): readonly string[] => {
    const next = [
      ...new Set(frontier.flatMap((id) => graph.out(id).map((edge) => edge.to))),
    ].filter((id) => !stop.has(id) && !found.includes(id))
    return next.length === 0 ? found : expand(next, [...found, ...next])
  }
  const start = entries.filter((id) => !stop.has(id))
  return expand(start, start)
}

/** The first step reached from two or more of the groups, in walk order. */
const joinOf = (
  graph: Graph,
  groups: readonly (readonly string[])[],
  stop: ReadonlySet<string>
): string | undefined => {
  const reaches = groups.map((group) => new Set(reach(graph, group, stop)))
  const order = reach(graph, groups.flat(), stop)
  return order.find((id) => reaches.filter((one) => one.has(id)).length >= 2)
}

/** Walk several entries one after the other, then resume where they join. */
const fanOut = (
  graph: Graph,
  entries: readonly string[],
  stop: ReadonlySet<string>,
  seen: ReadonlySet<string>
): Walk => {
  const unique = [...new Set(entries)]
  if (unique.length <= 1) return walkFrom(graph, unique[0], stop, seen)
  const join = joinOf(
    graph,
    unique.map((id) => [id]),
    stop
  )
  const inner = join === undefined ? stop : withAll(stop, [join])
  const chains = unique.reduce<Walk>(
    (acc, id) => {
      const next = walkFrom(graph, id, inner, acc.seen)
      return { block: [...acc.block, ...next.block], seen: next.seen }
    },
    { block: [], seen }
  )
  const after = walkFrom(graph, join, stop, chains.seen)
  return { block: [...chains.block, ...after.block], seen: after.seen }
}

const walkBranch = (
  graph: Graph,
  step: BranchStep,
  stop: ReadonlySet<string>,
  seen: ReadonlySet<string>
): Walk => {
  const edges = graph.out(step.id)
  const groups = step.branches.map((branch, index) =>
    edges
      .filter((edge) => edge.branch === branch.name || (edge.branch === undefined && index === 0))
      .map((edge) => edge.to)
  )
  const around = withAll(stop, [step.id])
  const join = joinOf(graph, groups, around)
  const inner = join === undefined ? around : withAll(around, [join])
  const paths = step.branches.reduce<{
    readonly paths: readonly FlowPath[]
    readonly seen: ReadonlySet<string>
  }>(
    (acc, branch, index) => {
      const walked = fanOut(graph, groups[index] ?? [], inner, acc.seen)
      const path: FlowPath = { name: branch.name, condition: branch.condition, block: walked.block }
      return { paths: [...acc.paths, path], seen: walked.seen }
    },
    { paths: [], seen }
  )
  const after = walkFrom(graph, join, stop, paths.seen)
  return { block: [{ kind: 'branch', step, paths: paths.paths }, ...after.block], seen: after.seen }
}

const walkLoop = (
  graph: Graph,
  step: LoopStep,
  stop: ReadonlySet<string>,
  seen: ReadonlySet<string>
): Walk => {
  const edges = graph.out(step.id)
  const done = edges.filter((edge) => edge.branch === 'done').map((edge) => edge.to)
  const entries = edges.filter((edge) => edge.branch !== 'done').map((edge) => edge.to)
  const body = fanOut(graph, entries, withAll(stop, [step.id, ...done]), seen)
  const after = fanOut(graph, done, stop, body.seen)
  return { block: [{ kind: 'loop', step, body: body.block }, ...after.block], seen: after.seen }
}

/** Walk from one step until a `stop` step, a step already walked, or the end. */
function walkFrom(
  graph: Graph,
  id: string | undefined,
  stop: ReadonlySet<string>,
  seen: ReadonlySet<string>
): Walk {
  const step = id === undefined ? undefined : graph.byId.get(id)
  if (step === undefined || stop.has(step.id) || seen.has(step.id)) return { block: [], seen }
  const marked = withAll(seen, [step.id])
  if (step.kind === 'branch') return walkBranch(graph, step, stop, marked)
  if (step.kind === 'loop') return walkLoop(graph, step, stop, marked)
  const next = fanOut(
    graph,
    graph.out(step.id).map((edge) => edge.to),
    stop,
    marked
  )
  return { block: [{ kind: 'step', step }, ...next.block], seen: next.seen }
}

/** The flow's steps as nested blocks, in run order. */
export const structureFlow = (flow: CanonicalFlow): FlowBlock => {
  const graph: Graph = {
    byId: new Map(flow.steps.map((step) => [step.id, step] as const)),
    out: (id) => flow.edges.filter((edge) => edge.from === id),
  }
  const empty: ReadonlySet<string> = new Set()
  const fromTrigger = fanOut(
    graph,
    graph.out('trigger').map((edge) => edge.to),
    empty,
    empty
  )
  return flow.steps.reduce<Walk>((acc, step) => {
    const orphan = walkFrom(graph, step.id, empty, acc.seen)
    return { block: [...acc.block, ...orphan.block], seen: orphan.seen }
  }, fromTrigger).block
}
