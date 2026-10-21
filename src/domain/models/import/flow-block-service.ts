/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Nested blocks of steps (`flow-graph-service.ts`) as Sovrium actions.
 *
 * - A branch becomes `path/branch`, one path per source branch in order, in the
 *   source's mode (`first-match` or `all-matching`). A path the source left
 *   empty keeps its place with a no-op under `first-match`, where it still
 *   consumes the match, and is dropped under `all-matching`. A branch left
 *   with one path gains an `otherwise` no-op path; one left with none is
 *   dropped. Under `all-matching`, a fallback path (no condition) runs only
 *   when nothing else matched, which takes a second, first-match branch.
 * - A loop becomes `loop/each`; inside its body a reference to the loop's own
 *   step reads the current item.
 * - A filter at the top of the automation becomes `filter/continue`, which
 *   ends the run when the condition fails, exactly as the source stops. A
 *   filter inside a path or a loop gates only what follows it there, so it
 *   becomes a `path/branch` around the rest of that path, with a no-op
 *   `otherwise`: stopping the whole run would be wider than the source.
 */

import { quoteOriginal } from './credential-redaction-service'
import { noOp, translateCondition } from './flow-control-service'
import { BRANCH_MODE_DEFAULTS } from './flow-expression-mappings'
import { untranslatedIn, renderText, type RenderContext } from './flow-expression-service'
import {
  droppedReason,
  mapStep,
  stub,
  type ConnectionCall,
  type LibraryConnection,
  type SecretUrl,
  type StepPlacement,
} from './flow-step-service'
import { derivedActionName } from './import-names-service'
import { toolDisplayName } from './source-display-name-service'
import type { CanonicalCondition, CanonicalStep } from './canonical-flow'
import type { FlowBlock, FlowItem, FlowPath } from './flow-graph-service'
import type { FieldPaths } from './flow-set-fields-service'
import type { AutomationSourceTool } from './flow-step-mappings'
import type { ConfigEntry } from './table-mapper-service'

/** Something to report about one action: a TODO, or a lossy mapping. */
export interface ActionNote {
  readonly action: string
  readonly original: string
  readonly reason: string
}

/** A block emitted. */
export interface Emitted {
  readonly actions: readonly ConfigEntry[]
  readonly todo: readonly ActionNote[]
  readonly unmapped: readonly ActionNote[]
  readonly calls: readonly ConnectionCall[]
  /** The credential URLs moved to the environment, by action. */
  readonly secrets: readonly (SecretUrl & { readonly action: string })[]
}

/** What emitting a block reads. */
export interface Emission {
  readonly tool: AutomationSourceTool
  /** The action name of every step, by source step id. */
  readonly names: ReadonlyMap<string, string>
  readonly connection: (slug: string) => LibraryConnection | undefined
  /** The `connections[]` name a connection need was given; absent, its slug. */
  readonly connectionName?: (need: ConnectionCall) => string
  /** The loop steps around the block, innermost last. */
  readonly loops: readonly string[]
  /** Whether the block is the automation's own list, so a filter may end the run. */
  readonly top: boolean
  /** The automation's name, which names the env variables its credential URLs move to. */
  readonly automation?: string
  /** Where a trigger reference reads from, when not `trigger.data`. */
  readonly triggerRoot?: string
  /** Where each set step's named values landed, by source step id. */
  readonly fieldPaths?: ReadonlyMap<string, FieldPaths>
}

const EMPTY: Emitted = { actions: [], todo: [], unmapped: [], calls: [], secrets: [] }

const merge = (...parts: readonly Emitted[]): Emitted => ({
  actions: parts.flatMap((part) => part.actions),
  todo: parts.flatMap((part) => part.todo),
  unmapped: parts.flatMap((part) => part.unmapped),
  calls: parts.flatMap((part) => part.calls),
  secrets: parts.flatMap((part) => part.secrets),
})

const nameOf = (step: CanonicalStep, emission: Emission): string =>
  emission.names.get(step.id) ?? 'step'

const renderingOf = (emission: Emission): RenderContext => ({
  actionOf: emission.names,
  tool: emission.tool,
  loops: emission.loops,
  ...(emission.triggerRoot === undefined ? {} : { triggerRoot: emission.triggerRoot }),
  ...(emission.fieldPaths === undefined ? {} : { fieldPaths: emission.fieldPaths }),
})

const placementOf = (step: CanonicalStep, emission: Emission): StepPlacement => ({
  name: nameOf(step, emission),
  label: step.name,
  tool: emission.tool,
  connection: emission.connection,
  ...(emission.connectionName === undefined ? {} : { connectionName: emission.connectionName }),
  rendering: renderingOf(emission),
  ...(emission.automation === undefined ? {} : { automation: emission.automation }),
})

/** The TODOs an action carries for the expressions in its step that do not translate. */
const expressionNotes = (step: CanonicalStep, emission: Emission): readonly ActionNote[] =>
  untranslatedIn(step, emission.tool).map((original) => ({
    action: nameOf(step, emission),
    original,
    reason: 'The expression does not translate; it is kept as text.',
  }))

/** One action, with its step's expression TODOs. */
const single = (step: CanonicalStep, action: ConfigEntry, emission: Emission): Emitted => ({
  ...EMPTY,
  actions: [action],
  todo: expressionNotes(step, emission),
})

const stubbed = (step: CanonicalStep, emission: Emission, reason: string): Emitted => {
  const outcome = stub(
    nameOf(step, emission),
    `rebuild the ${toolDisplayName(emission.tool)} step "${step.name}"`,
    quoteOriginal(step),
    reason
  )
  return {
    ...EMPTY,
    actions: [outcome.action],
    todo: [{ action: nameOf(step, emission), original: outcome.todo?.original ?? '', reason }],
  }
}

const BRANCH_DROPPED = 'None of its branches leads to a step that does anything; it is dropped'

const RULE_LEFT_OUT =
  'The rule does not translate; it is left out of the condition, so the path runs more often than in the source until it is rebuilt.'

/** A source condition as a group, with each untranslated rule as a TODO on `action`. */
const conditionFor = (
  condition: CanonicalCondition | undefined,
  action: string,
  emission: Emission
): { readonly group?: ConfigEntry; readonly todo: readonly ActionNote[] } => {
  if (condition === undefined) return { todo: [] }
  const translated = translateCondition(condition, renderingOf(emission))
  const todo = translated.problems.map((original) => ({ action, original, reason: RULE_LEFT_OUT }))
  return translated.group === undefined ? { todo } : { group: translated.group, todo }
}

interface BuiltPath {
  readonly name: string
  readonly condition?: ConfigEntry
  readonly emitted: Emitted
  /** The source path has no condition: it runs when no other path matched. */
  readonly fallback: boolean
}

const pathEntry = (path: BuiltPath, actions: readonly ConfigEntry[]): ConfigEntry => ({
  name: path.name,
  ...(path.condition === undefined ? {} : { condition: path.condition }),
  actions,
})

/** The paths with their actions, empty ones settled per the branch's mode. */
const settledPaths = (
  built: readonly BuiltPath[],
  mode: 'first-match' | 'all-matching',
  owner: string
): readonly ConfigEntry[] => {
  const kept = built.flatMap((path, index) => {
    if (path.emitted.actions.length > 0) return [pathEntry(path, path.emitted.actions)]
    const last = index === built.length - 1
    return mode === 'all-matching' || last
      ? []
      : [pathEntry(path, [noOp(derivedActionName(owner, 'skip', index + 1))])]
  })
  if (kept.length !== 1) return kept
  const taken = new Set(kept.map((path) => String(path['name'])))
  const name = taken.has('otherwise') ? 'otherwise_2' : 'otherwise'
  return [...kept, { name, actions: [noOp(derivedActionName(owner, 'otherwise'))] }]
}

const branchAction = (
  name: string,
  mode: 'first-match' | 'all-matching',
  paths: readonly ConfigEntry[]
): ConfigEntry => ({ name, type: 'path', operator: 'branch', props: { mode, paths } })

/**
 * An all-matching branch with a fallback, as Sovrium actions. Sovrium runs an
 * all-matching path with no condition every time, while the source runs its
 * fallback only when no other path matched. So the other paths stay an
 * all-matching branch, and a second, first-match branch follows it: one no-op
 * path per condition, then the fallback, which therefore runs exactly when no
 * condition held. With a single other path, one first-match branch says it.
 */
const withFallback = (
  built: readonly BuiltPath[],
  fallback: BuiltPath,
  owner: string
): readonly ConfigEntry[] => {
  const others = built.filter((path) => path !== fallback)
  if (others.length <= 1) {
    return [
      branchAction(owner, 'first-match', settledPaths([...others, fallback], 'first-match', owner)),
    ]
  }
  const main = others.some((path) => path.emitted.actions.length > 0)
    ? [branchAction(owner, 'all-matching', settledPaths(others, 'all-matching', owner))]
    : []
  const guard = branchAction(`${owner}Fallback`, 'first-match', [
    ...others.map((path, index) =>
      pathEntry(path, [noOp(derivedActionName(owner, 'fallback_skip', index + 1))])
    ),
    pathEntry(fallback, fallback.emitted.actions),
  ])
  return fallback.emitted.actions.length === 0 ? main : [...main, guard]
}

const emitBranch = (
  item: Extract<FlowItem, { readonly kind: 'branch' }>,
  emission: Emission
): Emitted => {
  const owner = nameOf(item.step, emission)
  const mode = item.step.mode ?? BRANCH_MODE_DEFAULTS[emission.tool]
  const inner = { ...emission, top: false }
  const built = item.paths.map((path: FlowPath) => {
    const condition = conditionFor(path.condition, owner, emission)
    return {
      name: path.name,
      ...(condition.group === undefined ? {} : { condition: condition.group }),
      emitted: emitBlock(path.block, inner),
      fallback: path.condition === undefined,
      todo: condition.todo,
    }
  })
  const nested = merge(...built.map((path) => ({ ...path.emitted, actions: [] })))
  if (built.every((path) => path.emitted.actions.length === 0)) {
    const dropped = { action: owner, original: item.step.name, reason: BRANCH_DROPPED }
    return { ...nested, unmapped: [...nested.unmapped, dropped] }
  }
  const fallback = mode === 'all-matching' ? built.find((path) => path.fallback) : undefined
  const actions =
    fallback === undefined
      ? [branchAction(owner, mode, settledPaths(built, mode, owner))]
      : withFallback(built, fallback, owner)
  const conditions = { ...EMPTY, todo: built.flatMap((path) => path.todo) }
  const own = { ...EMPTY, actions, todo: expressionNotes(item.step, emission) }
  return merge(own, conditions, nested)
}

const emitLoop = (
  item: Extract<FlowItem, { readonly kind: 'loop' }>,
  emission: Emission
): Emitted => {
  const name = nameOf(item.step, emission)
  const body = emitBlock(item.body, {
    ...emission,
    top: false,
    loops: [...emission.loops, item.step.id],
  })
  const items =
    item.step.over === undefined ? '' : renderText(item.step.over, renderingOf(emission))
  const actions = body.actions.length === 0 ? [noOp(derivedActionName(name, 'skip'))] : body.actions
  const action = { name, type: 'loop', operator: 'each', props: { items, actions } }
  return merge(single(item.step, action, emission), { ...body, actions: [] })
}

type FilterStep = Extract<CanonicalStep, { readonly kind: 'filter' }>

/** A filter at the top: `filter/continue`, or a stub when a rule does not translate. */
const emitTopFilter = (step: FilterStep, emission: Emission): Emitted => {
  const translated = translateCondition(step.condition, renderingOf(emission))
  if (translated.group === undefined || translated.problems.length > 0) {
    return stubbed(step, emission, 'A rule of the filter does not translate; it does not gate yet.')
  }
  const action = {
    name: nameOf(step, emission),
    type: 'filter',
    operator: 'continue',
    props: { condition: translated.group },
  }
  return single(step, action, emission)
}

/** A filter inside a path or a loop: a branch around what follows it there. */
const emitGate = (step: FilterStep, rest: FlowBlock, emission: Emission): Emitted => {
  const after = emitBlock(rest, emission)
  const translated = translateCondition(step.condition, renderingOf(emission))
  if (translated.group === undefined || translated.problems.length > 0) {
    return merge(
      stubbed(step, emission, 'A rule of the filter does not translate; it does not gate yet.'),
      after
    )
  }
  if (after.actions.length === 0) return after
  const name = nameOf(step, emission)
  const action = {
    name,
    type: 'path',
    operator: 'branch',
    props: {
      mode: 'first-match',
      paths: [
        { name: step.name, condition: translated.group, actions: after.actions },
        { name: 'otherwise', actions: [noOp(derivedActionName(name, 'otherwise'))] },
      ],
    },
  }
  return merge(single(step, action, emission), { ...after, actions: [] })
}

const emitStep = (step: CanonicalStep, emission: Emission): Emitted => {
  const dropped = droppedReason(step, emission.tool)
  if (dropped !== undefined) {
    return {
      ...EMPTY,
      unmapped: [{ action: nameOf(step, emission), original: step.name, reason: dropped }],
    }
  }
  if (step.kind === 'filter') return emitTopFilter(step, emission)
  const outcome = mapStep(step, placementOf(step, emission))
  const action = nameOf(step, emission)
  return {
    actions: [outcome.action],
    todo:
      outcome.todo === undefined
        ? expressionNotes(step, emission)
        : [{ action, original: outcome.todo.original, reason: outcome.todo.reason }],
    unmapped:
      outcome.loss === undefined ? [] : [{ action, original: step.name, reason: outcome.loss }],
    calls: outcome.connection === undefined ? [] : [outcome.connection],
    secrets: outcome.secretUrl === undefined ? [] : [{ ...outcome.secretUrl, action }],
  }
}

const emitItem = (item: FlowItem, emission: Emission): Emitted => {
  if (item.kind === 'branch') return emitBranch(item, emission)
  if (item.kind === 'loop') return emitLoop(item, emission)
  return emitStep(item.step, emission)
}

/** A block as actions, in order. */
export function emitBlock(block: FlowBlock, emission: Emission): Emitted {
  const [first, ...rest] = block
  if (first === undefined) return EMPTY
  if (first.kind === 'step' && first.step.kind === 'filter' && !emission.top) {
    return emitGate(first.step, rest, emission)
  }
  return merge(emitItem(first, emission), emitBlock(rest, emission))
}
