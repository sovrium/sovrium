/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { evaluateGroup } from '@/domain/models/app/automations/condition-eval'
import {
  EMPTY_SEQUENCE,
  haltedOutcome,
  runNestedSequence,
  type SequenceResume,
} from './nested-sequence'
import { resumedBranchRun, type BranchRun } from './path-resume'
import { laterResponse } from './response-precedence'
import {
  authoredActionProps,
  buildRunContextView,
  finalNestedActionProps,
  renderNestedActionProps,
  resolveOwnProp,
} from './run-context-resolution'
import { actionAttributes } from './shared'
import type { ActionHandler, ActionOutcome, ActionRunContext } from './shared'
import type { RenderedActionProps } from '../run/render-action-props'

/**
 * `path/branch` handler — conditional branching (n8n Switch / Make router).
 *
 * Each declared path carries a `condition` and its own sequence of actions. A
 * path with NO condition is the default/fallback branch: an empty
 * `ConditionGroup` passes, so a condition-less path always matches, which in
 * `first-match` mode makes a trailing condition-less path the fallback.
 *
 * Modes:
 *  - `first-match` (default) — run only the first matching path.
 *  - `all-matching` — run EVERY matching path, SEQUENTIALLY, in declaration
 *    order. Sequential is the decided semantics: two branches writing to the
 *    same table must have a defined order, and `matched` reports that order.
 *    The schema annotation says the same.
 *
 * Output: `{ matched: readonly string[], results: Record<pathName, unknown> }`.
 * `matched` is the SELECTION half of the contract — the only place path
 * selection is observable independently of the branch bodies' side effects.
 *
 * ── Why this resolves templates itself (the load-bearing part) ───────────────
 *
 * The run loop's `resolveTriggerInValue` pass runs over the WHOLE `props` tree
 * before any handler is invoked, descending into `props.paths[].actions[].props`
 * along the way. Being `mapStringsDeep`, it preserves object and array
 * STRUCTURE and rewrites only string LEAVES — so a scalar reference nested in a
 * branch action (`who: '{{trigger.data.name}}'`) survives that pass intact and
 * would resolve correctly either way.
 *
 * What does NOT survive is a whole-string template pointing at a NON-SCALAR.
 * `records: '{{trigger.data.entries}}'` is a string leaf, so the global pass
 * renders it through the template engine and the array becomes text; a nested
 * `batchCreate` then iterates zero items. Same failure `loop.ts` documents for
 * its `items` prop, reached here through a branch body instead.
 *
 * So — exactly as `loop.ts` does — this handler reads its props as AUTHORED
 * (`authoredActionProps`, nothing filled in yet) and resolves them per branch via
 * `resolveRunContextValue`, which unwraps a whole-string `{{path}}` to the VALUE
 * at that path (arrays and objects intact) and falls back to string
 * substitution otherwise: the path's `condition` first, then each nested
 * action's `props` immediately before dispatching it through
 * `runContext.runNestedStep`.
 *
 * A handler that forwarded the pre-resolved `action.props` instead would still
 * satisfy "the right branch ran" — the scalar rows appear, `matched` is
 * correct — and only the collapsed non-scalar betrays it. That asymmetry is why
 * an automation action path branch spec puts an ARRAY-valued reference inside a
 * branch action and not merely a scalar one: the scalar assertion passes
 * against both implementations and proves nothing on its own. Verified by
 * building the naive variant and watching -001 go red.
 *
 * Spec: an automation action path branch spec + REGRESSION.
 */

/** Tagged failure when a branch's nested action throws (or rejects). */
class PathBranchError extends Data.TaggedError('PathBranchError')<{
  readonly message: string
  readonly cause: unknown
}> {}

interface DeclaredPath {
  readonly name: string
  readonly condition: Readonly<Record<string, unknown>> | undefined
  readonly actions: ReadonlyArray<Readonly<Record<string, unknown>>>
}

const fail = (message: string): ActionOutcome =>
  ({ status: 'failure', error: message }) as const satisfies ActionOutcome

const asObject = (value: unknown): Readonly<Record<string, unknown>> | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : undefined

const asActionList = (value: unknown): ReadonlyArray<Readonly<Record<string, unknown>>> =>
  Array.isArray(value)
    ? value.flatMap((a) => {
        const action = asObject(a)
        return action ? [action] : []
      })
    : []

/** Normalise the declared `props.paths[]` into a total shape. */
const declaredPaths = (props: Readonly<Record<string, unknown>>): ReadonlyArray<DeclaredPath> => {
  const raw = props['paths']
  if (!Array.isArray(raw)) return []
  return raw.flatMap((entry, index) => {
    const branch = asObject(entry)
    if (branch === undefined) return []
    return [
      {
        name: String(branch['name'] ?? `path-${String(index)}`),
        condition: asObject(branch['condition']),
        actions: asActionList(branch['actions']),
      },
    ]
  })
}

/**
 * Does this path match?
 *
 * A path with no `condition` always matches (the fallback branch). A declared
 * condition is re-resolved against the run context first, because the raw
 * action still carries `{{trigger.data.plan}}` in its `field` positions.
 */
const pathMatches = (path: DeclaredPath, runContext: ActionRunContext): boolean => {
  if (path.condition === undefined) return true
  return evaluateGroup(
    resolveOwnProp(runContext, path.condition) as Readonly<Record<string, unknown>>
  )
}

/**
 * Run every selected branch as ONE promise chain so declaration order is
 * observable in the rows each branch writes, not merely in `matched`.
 *
 * Each path's actions read the outputs of every action that ran before them —
 * in the run, earlier in the path, and in the paths that ran before it (each
 * one's props filled in just before it runs). An action that ends its
 * sequence — a failure, a `flow/stop`, a stopping filter, a pause — ends the
 * branch there: no later action of its path and no later path runs.
 */
const runSelectedBranches = (input: {
  readonly selected: ReadonlyArray<DeclaredPath>
  readonly runContext: ActionRunContext
  readonly runNested: NonNullable<ActionRunContext['runNestedStep']>
  /** Resuming: what had run before the park, and how the first selected path re-enters. */
  readonly from?: { readonly run: BranchRun; readonly resume: SequenceResume }
}): Promise<BranchRun> => {
  const { selected, runContext, runNested } = input
  const fillProps = (
    action: Readonly<Record<string, unknown>>,
    previousSteps: ActionRunContext['previousSteps']
  ): RenderedActionProps => {
    if (runContext.propsFinal === true) return finalNestedActionProps(action)
    // A loop fills in its own body per item: rendered here, its `{{loop.*}}`
    // references would resolve to nothing before any item exists.
    if (action['type'] === 'loop') {
      return { props: (action['props'] ?? {}) as Record<string, unknown>, authored: true }
    }
    return renderNestedActionProps(
      action,
      buildRunContextView({ ...runContext, previousSteps }),
      runContext.templates
    )
  }
  return selected.reduce<Promise<BranchRun>>(
    async (prev, path, position) => {
      const acc = await prev
      if (acc.sequence.halt !== undefined) return acc
      const resume = position === 0 ? input.from?.resume : undefined
      const run = await runNestedSequence({
        actions: path.actions,
        runNested,
        previousSteps: { ...runContext.previousSteps, ...acc.sequence.outputs },
        fillProps,
        ...(resume === undefined ? {} : { resume }),
      })
      return {
        matched: [...acc.matched, path.name],
        results: { ...acc.results, [path.name]: run.last ?? {} },
        paths: [...acc.paths, { name: path.name, steps: run.steps }],
        sequence: {
          ...run,
          outputs: { ...acc.sequence.outputs, ...run.outputs },
          responseOverride: laterResponse(acc.sequence.responseOverride, run.responseOverride),
        },
      }
    },
    Promise.resolve<BranchRun>(
      input.from?.run ?? { matched: [], results: {}, paths: [], sequence: EMPTY_SEQUENCE }
    )
  )
}

/** The branch's outcome: its selection and results, and whatever ended it early. */
const branchOutcome = (run: BranchRun, selected: readonly string[]): ActionOutcome => {
  const { outputs, halt, responseOverride } = run.sequence
  const carried = {
    output: { matched: run.matched, results: run.results },
    nestedOutputs: outputs,
    nestedSteps: { paths: run.paths },
    ...(responseOverride === undefined ? {} : { responseOverride }),
  }
  if (halt === undefined) return { ...carried, status: 'success' }
  // A park: the path's row waits with the branch it is in and every branch it chose.
  if (halt.park !== undefined) {
    const branch = run.matched.at(-1) ?? ''
    const container = { kind: 'path' as const, branch, selected: [...selected] }
    return { ...carried, status: 'success', park: { ...halt.park, container } }
  }
  return (
    haltedOutcome(halt, carried) ?? {
      status: 'failure',
      error: halt.error ?? 'path.branch: an action of the path failed',
      nestedOutputs: outputs,
      nestedSteps: { paths: run.paths },
    }
  )
}

/**
 * The paths to run, in order. A path the run resumes inside does not decide
 * again: it re-enters the branch it parked in, then runs the branches it had
 * chosen after that one — each looked up by name in the current configuration.
 */
const selectionOf = (
  paths: ReadonlyArray<DeclaredPath>,
  props: Readonly<Record<string, unknown>>,
  runContext: ActionRunContext
): {
  readonly selected: ReadonlyArray<DeclaredPath>
  readonly from?: { readonly run: BranchRun; readonly resume: SequenceResume }
} => {
  const { resume } = runContext
  if (resume !== undefined) {
    const chosen = resume.frame.selected ?? []
    const remaining = chosen.slice(Math.max(0, chosen.indexOf(resume.frame.branch ?? '')))
    const selected = remaining.flatMap((name) => paths.filter((path) => path.name === name))
    return { selected, from: resumedBranchRun(resume) }
  }
  const matching = paths.filter((path) => pathMatches(path, runContext))
  // `first-match` is the default when `mode` is absent (schema annotation).
  const allMatching = String(props['mode'] ?? 'first-match') === 'all-matching'
  return { selected: allMatching ? matching : matching.slice(0, 1) }
}

export const handlePathBranch: ActionHandler = (action, _app, _automation, runContext) =>
  Effect.gen(function* () {
    if (runContext === undefined || runContext.runNestedStep === undefined) {
      return fail('path.branch requires a run context to dispatch its branch actions')
    }
    const runNested = runContext.runNestedStep
    const props = authoredActionProps(runContext)

    const paths = declaredPaths(props)
    const { selected, from } = selectionOf(paths, props, runContext)
    const names = runContext.resume?.frame.selected ?? selected.map((path) => path.name)

    return yield* Effect.tryPromise({
      try: () =>
        runSelectedBranches({
          selected,
          runContext,
          runNested,
          ...(from === undefined ? {} : { from }),
        }),
      catch: (cause) =>
        new PathBranchError({
          message: cause instanceof Error ? cause.message : String(cause),
          cause,
        }),
    }).pipe(
      Effect.match({
        onSuccess: (run) => branchOutcome(run, names),
        onFailure: (error) => fail(error.message),
      })
    )
  }).pipe(
    Effect.withSpan('automations.handle-path-branch', { attributes: actionAttributes(action) })
  )
