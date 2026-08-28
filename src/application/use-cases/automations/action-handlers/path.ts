/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { evaluateGroup } from '@/domain/services/automations/condition-eval'
import {
  buildRunContextView,
  rawActionProps,
  resolveRunContextValue,
} from './run-context-resolution'
import type { ActionHandler, ActionOutcome, ActionRunContext } from './shared'

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
 *    (The schema annotation used to say "parallel"; it was corrected to match.)
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
 * So — exactly as `loop.ts` does — this handler reads the RAW pre-substitution
 * action from `runContext.rawAction` and re-resolves per branch via
 * `resolveRunContextValue`, which unwraps a whole-string `{{path}}` to the VALUE
 * at that path (arrays and objects intact) and falls back to string
 * substitution otherwise: the path's `condition` first, then each nested
 * action's `props` immediately before dispatching it through
 * `runContext.invokeNativeAction`.
 *
 * A handler that forwarded the pre-resolved `action.props` instead would still
 * satisfy "the right branch ran" — the scalar rows appear, `matched` is
 * correct — and only the collapsed non-scalar betrays it. That asymmetry is why
 * [internal ref] puts an ARRAY-valued reference inside a
 * branch action and not merely a scalar one: the scalar assertion passes
 * against both implementations and proves nothing on its own. Verified by
 * building the naive variant and watching -001 go red.
 *
 * Spec: [internal ref] + REGRESSION.
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

const ok = (output: Readonly<Record<string, unknown>>): ActionOutcome =>
  ({ status: 'success', output }) as const satisfies ActionOutcome

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
const pathMatches = (path: DeclaredPath, context: Readonly<Record<string, unknown>>): boolean => {
  if (path.condition === undefined) return true
  const resolved = resolveRunContextValue(path.condition, context) as Readonly<
    Record<string, unknown>
  >
  return evaluateGroup(resolved)
}

/**
 * Run one branch's action sub-sequence, in order. Each nested action's props
 * are re-resolved against the run context immediately before dispatch — this
 * is the step that keeps `{{trigger.data.*}}` inside a branch action honest.
 * Returns the last action's output (mirroring `loop/each`), or `{}`.
 */
const runBranch = (input: {
  readonly actions: ReadonlyArray<Readonly<Record<string, unknown>>>
  readonly context: Readonly<Record<string, unknown>>
  readonly invoke: NonNullable<ActionRunContext['invokeNativeAction']>
}): Promise<unknown> => {
  const { actions, context, invoke } = input
  return actions.reduce<Promise<unknown>>(
    (prev, nested) =>
      prev.then(() => {
        const type = String(nested['type'] ?? '')
        const operator = String(nested['operator'] ?? '')
        const props = resolveRunContextValue(nested['props'] ?? {}, context) as Record<
          string,
          unknown
        >
        return invoke(type, operator, props)
      }),
    Promise.resolve<unknown>(undefined)
  )
}

interface BranchRun {
  readonly matched: readonly string[]
  readonly results: Record<string, unknown>
}

/**
 * Run every selected branch as ONE promise chain so declaration order is
 * observable in the rows each branch writes, not merely in `matched`.
 */
const runSelectedBranches = (input: {
  readonly selected: ReadonlyArray<DeclaredPath>
  readonly context: Readonly<Record<string, unknown>>
  readonly invoke: NonNullable<ActionRunContext['invokeNativeAction']>
}): Promise<BranchRun> => {
  const { selected, context, invoke } = input
  return selected.reduce<Promise<BranchRun>>(
    async (prev, path) => {
      const acc = await prev
      const result = await runBranch({ actions: path.actions, context, invoke })
      return {
        matched: [...acc.matched, path.name],
        results: { ...acc.results, [path.name]: result ?? {} },
      }
    },
    Promise.resolve<BranchRun>({ matched: [], results: {} })
  )
}

export const handlePathBranch: ActionHandler = (_action, _app, _automation, runContext) =>
  Effect.gen(function* () {
    if (runContext === undefined || runContext.invokeNativeAction === undefined) {
      return fail('path.branch requires a run context to dispatch its branch actions')
    }
    const invoke = runContext.invokeNativeAction
    const props = rawActionProps(runContext)
    const context = buildRunContextView(runContext)

    const paths = declaredPaths(props)
    const matching = paths.filter((path) => pathMatches(path, context))
    // `first-match` is the default when `mode` is absent (schema annotation).
    const allMatching = String(props['mode'] ?? 'first-match') === 'all-matching'
    const selected = allMatching ? matching : matching.slice(0, 1)

    return yield* Effect.tryPromise({
      try: () => runSelectedBranches({ selected, context, invoke }),
      catch: (cause) =>
        new PathBranchError({
          message: cause instanceof Error ? cause.message : String(cause),
          cause,
        }),
    }).pipe(
      Effect.match({
        onSuccess: (run) => ok({ matched: run.matched, results: run.results }),
        onFailure: (error) => fail(error.message),
      })
    )
  })
