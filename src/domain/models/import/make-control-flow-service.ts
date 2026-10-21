/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Make's control-flow modules as branch and loop steps.
 *
 * - **A router** `builtin:BasicRouter` is an all-matching branch, one branch
 *   per route; a route's condition is the filter on its first module. The
 *   route `parameters.else` names is the fallback and carries no condition; a
 *   route with no filter always runs (a condition with no rules). Routes never
 *   rejoin.
 * - **An if-else** `builtin:BasicIfElse` is a first-match branch whose
 *   `type: "else"` branch is the fallback (left out when disabled); branches
 *   with `merge: true` rejoin at the next module, a `builtin:BasicMerge`. A
 *   merge that outputs nothing is only that join; one that outputs values
 *   chosen per branch has no Sovrium equivalent and is quoted.
 * - **An iterator** `builtin:BasicFeeder` is a loop over `mapper.array`; its
 *   body runs up to the aggregator whose `parameters.feeder` names it, which
 *   is where the flow continues after the loop.
 *
 * Each reads the modules inside it through `chain`, the module reader, which
 * is handed in so the two files do not import each other.
 */

import { arrayOf, isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { tokeniseMakeValue } from './make-expression-service'
import {
  EMPTY,
  conditionOf,
  edge,
  labelOf,
  modulesOf,
  objectOf,
  rawOf,
  single,
  then,
  unknownStep,
  type MakeModule,
  type MakeScope,
  type Piece,
} from './make-piece-service'
import type { CanonicalFlow, CanonicalStep } from './canonical-flow'

type Edge = CanonicalFlow['edges'][number]

/** Reads a `flow[]` as one piece; on a route's first module the filter is the route's. */
export type Chain = (
  flow: readonly MakeModule[],
  scope: MakeScope,
  options?: { readonly routeHead?: boolean }
) => Piece

/** Names made unique within one branch step, so each edge names one branch. */
const distinct = (names: readonly string[]): readonly string[] =>
  names.reduce<readonly string[]>((out, name) => {
    const taken = (candidate: string) => out.includes(candidate)
    const suffix = Array.from({ length: out.length + 1 }, (_unused, i) => i + 2).find(
      (n) => !taken(`${name} ${String(n)}`)
    )
    return [...out, taken(name) ? `${name} ${String(suffix ?? 2)}` : name]
  }, [])

/** One path out of a branch: its flow, entered by the edge labelled `branch`. */
const pathPiece = (
  branchId: string,
  branch: string,
  body: Piece
): { readonly edges: readonly Edge[]; readonly steps: readonly CanonicalStep[] } => ({
  steps: body.steps,
  edges: [...(body.entry === undefined ? [] : [edge(branchId, body.entry, branch)]), ...body.edges],
})

/** A router: one all-matching branch, its routes never rejoining. */
export const routerPiece = (module: MakeModule, scope: MakeScope, chain: Chain): Piece => {
  const fallback = objectOf(module['parameters'])['else']
  const routes = arrayOf(module['routes']).map((route) => modulesOf(objectOf(route)['flow']))
  const id = String(module.id)
  const names = distinct(
    routes.map((flow, index) => {
      const label = objectOf(flow[0]?.['filter'])['name']
      return typeof label === 'string' && label !== '' ? label : `Route ${String(index + 1)}`
    })
  )
  const read = routes.map((flow, index) => {
    const [first] = flow
    const condition = conditionOf(objectOf(first?.['filter'])['conditions'], scope)
    const gate =
      condition === 'mixed' && first !== undefined
        ? single(
            unknownStep(`${String(first.id)}:filter`, 'Route filter', 'filter', first['filter'])
          )
        : EMPTY
    const own = index === fallback ? undefined : condition === 'mixed' ? undefined : condition
    const body = then(gate, chain(flow, scope, { routeHead: true }))
    return {
      branch: {
        name: names[index] ?? `Route ${String(index + 1)}`,
        ...(index === fallback
          ? {}
          : { condition: own ?? ({ combinator: 'and', rules: [] } as const) }),
      },
      path: pathPiece(id, names[index] ?? '', body),
    }
  })
  const step: CanonicalStep = {
    id,
    name: labelOf(module),
    kind: 'branch',
    mode: 'all-matching',
    branches: read.map((one) => one.branch),
  }
  return {
    steps: [step, ...read.flatMap((one) => one.path.steps)],
    edges: read.flatMap((one) => one.path.edges),
    entry: id,
    exits: [],
  }
}

/** An if-else: one first-match branch; merging branches end where the flow resumes. */
export const ifElsePiece = (module: MakeModule, scope: MakeScope, chain: Chain): Piece => {
  const id = String(module.id)
  const branches = arrayOf(module['branches'])
    .filter(isRecord)
    .filter((branch) => !(branch['type'] === 'else' && branch['disabled'] === true))
  const names = distinct(
    branches.map((branch, index) => {
      const { label } = branch
      if (typeof label === 'string' && label !== '') return label
      return branch['type'] === 'else' ? 'Else' : `Condition ${String(index + 1)}`
    })
  )
  const read = branches.map((branch, index) => {
    const name = names[index] ?? ''
    const condition =
      branch['type'] === 'else' ? undefined : conditionOf(branch['conditions'], scope)
    const gate =
      condition === 'mixed'
        ? single(
            unknownStep(`${id}:${String(index + 1)}:filter`, name, 'filter', branch['conditions'])
          )
        : EMPTY
    const body = then(gate, chain(modulesOf(branch['flow']), scope))
    const exits =
      branch['merge'] === true
        ? body.entry === undefined
          ? [{ from: id, branch: name }]
          : body.exits
        : []
    return {
      branch: {
        name,
        ...(branch['type'] === 'else'
          ? {}
          : {
              condition:
                condition === undefined || condition === 'mixed'
                  ? ({ combinator: 'and', rules: [] } as const)
                  : condition,
            }),
      },
      path: pathPiece(id, name, body),
      exits,
    }
  })
  const step: CanonicalStep = {
    id,
    name: labelOf(module),
    kind: 'branch',
    mode: 'first-match',
    branches: read.map((one) => one.branch),
  }
  return {
    steps: [step, ...read.flatMap((one) => one.path.steps)],
    edges: read.flatMap((one) => one.path.edges),
    entry: id,
    exits: read.flatMap((one) => one.exits),
  }
}

/** A merge: only the join when it outputs nothing, else quoted. */
export const mergePiece = (module: MakeModule): Piece =>
  arrayOf(module['outputs']).length === 0
    ? EMPTY
    : single(unknownStep(String(module.id), labelOf(module), module.module, rawOf(module)))

/**
 * An iterator and the modules after it in its flow: what runs per item, up to
 * the aggregator that names it, which follows the loop; with no aggregator,
 * all of them.
 */
export const loopPiece = (
  module: MakeModule,
  following: readonly MakeModule[],
  scope: MakeScope,
  chain: Chain
): Piece => {
  const end = following.findIndex((next) => objectOf(next['parameters'])['feeder'] === module.id)
  const body = end < 0 ? following : following.slice(0, end)
  const after = end < 0 ? [] : following.slice(end)
  const id = String(module.id)
  const step: CanonicalStep = {
    id,
    name: labelOf(module),
    kind: 'loop',
    over: tokeniseMakeValue(objectOf(module['mapper'])['array'], scope.trigger),
  }
  const inner = chain(body, scope)
  const rest = chain(after, scope)
  return {
    steps: [step, ...inner.steps, ...rest.steps],
    edges: [
      ...(inner.entry === undefined ? [] : [edge(id, inner.entry)]),
      ...inner.edges,
      ...(rest.entry === undefined ? [] : [edge(id, rest.entry, 'done')]),
      ...rest.edges,
    ],
    entry: id,
    exits: rest.entry === undefined ? [{ from: id, branch: 'done' }] : rest.exits,
  }
}
