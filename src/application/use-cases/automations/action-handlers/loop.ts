/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { pushLoopScope } from './loop-scope'
import { changedItemRefusal, EMPTY_TALLY, resumedLoopState, type LoopTally } from './loop-tally'
import {
  haltedOutcome,
  runNestedSequence,
  type SequenceResume,
  type SequenceRun,
} from './nested-sequence'
import { laterResponse } from './response-precedence'
import {
  asArray,
  authoredActionProps,
  buildRunContextView,
  fillNestedActionProps,
  finalNestedActionProps,
  resolveOwnProp,
} from './run-context-resolution'
import { actionAttributes, itemLoopOutcome } from './shared'
import type { ActionHandler, ActionOutcome, ActionRunContext } from './shared'
import type { RenderedActionProps } from '../run/render-action-props'
import type { ExecutedStep } from '../run/types'

/**
 * `loop/each` handler — for-each over an array.
 *
 * Iterates the array referenced by `props.items` (a `{{...}}` template) and,
 * for each item, runs the nested `props.actions` sub-sequence with the
 * current item exposed as `{{loop.item}}` / `{{loop.item.<field>}}` and the
 * zero-based position as `{{loop.index}}`. Per-item outputs are collected
 * into `steps.<name>.results[]`; a failed item contributes `{ error }` in its
 * position so the array stays aligned with the declared order.
 *
 * `props.continueOnItemError` decides what a failing item does to the rest:
 * absent or `false` stops the loop there and fails the step, `true` attempts
 * every item and reports the count in `output.failed`. See {@link foldIteration}
 * for why the rule is shared with `record/batch*` by wording rather than by code.
 *
 * Why this resolves templates itself instead of relying on the run loop's
 * `resolveTriggerInValue` (cf. `data.ts`): that resolver runs BEFORE the
 * handler and stringifies non-scalar values — it would both flatten the
 * `items` array and erase the `{{loop.*}}` placeholders inside the nested
 * `actions` (which only exist once iteration is under way). So the handler
 * reads its props as AUTHORED (`authoredActionProps`, nothing filled in yet),
 * resolves `items` against the trigger/steps context, and re-resolves each
 * nested action's props against a per-item context before dispatching it
 * through `runContext.runNestedStep`. The raw-props/`{{path}}`-or-raw
 * resolution machinery is shared with `data.ts` via
 * `./run-context-resolution`.
 *
 * A nested action receives its props FINAL (`propsFinal`) — a nested loop or
 * path excepted, which fills in its own body as it runs: filled in once
 * here, per item, and taken as given by its handler — a raw-props handler
 * (e.g. `data:sort` with `input: '{{loop.item.orders}}'`) gets the array this
 * pass unwrapped, and `{{...}}` text an item carries is never rendered again.
 *
 * Spec: [internal ref] + REGRESSION.
 */

const DEFAULT_MAX_ITERATIONS = 1000

/** Tagged failure when a nested action throws (or rejects) mid-iteration. */
class LoopIterationError extends Data.TaggedError('LoopIterationError')<{
  readonly message: string
  readonly cause: unknown
}> {}

const asActionList = (value: unknown): ReadonlyArray<Readonly<Record<string, unknown>>> =>
  Array.isArray(value)
    ? (value.filter((a) => a !== null && typeof a === 'object') as ReadonlyArray<
        Readonly<Record<string, unknown>>
      >)
    : []

const maxIterationsOf = (props: Readonly<Record<string, unknown>>): number => {
  const raw = props['maxIterations']
  if (typeof raw === 'number' && Number.isInteger(raw) && raw > 0) return raw
  if (typeof raw === 'string' && raw.trim() !== '') {
    const parsed = Number(raw)
    if (Number.isInteger(parsed) && parsed > 0) return parsed
  }
  return DEFAULT_MAX_ITERATIONS
}

const ok = (output: Readonly<Record<string, unknown>>): ActionOutcome =>
  ({ status: 'success', output }) as const satisfies ActionOutcome

const fail = (message: string): ActionOutcome =>
  ({ status: 'failure', error: message }) as const satisfies ActionOutcome

/** What happened to one loop item. */
type IterationOutcome = (
  | { readonly kind: 'ok'; readonly output: unknown }
  | { readonly kind: 'failed'; readonly error: string }
  | { readonly kind: 'halted'; readonly output: unknown; readonly halt: ActionOutcome }
) & { readonly steps: readonly ExecutedStep[]; readonly tolerated: number }

/**
 * Fold one item's outcome into the tally, halting the sequence when an item
 * failed and the author did not opt into `continueOnItemError`.
 *
 * The rule is the one the three `record/batch*` operators share — "Continue
 * processing remaining items if one fails (default: false)", byte-identical
 * wording across all four schemas — so the DEFAULT stops at the first failing
 * item rather than attempting the rest and reporting afterwards.
 *
 * Why this does not reuse `record-batch.ts`'s `runBatchItems`: that loop is an
 * `Effect` fold over `TableRepository`-requiring per-item Effects, tallying a
 * created/updated/failed vocabulary and deliberately DISCARDING each item's
 * output. A loop item is a promise-returning sub-sequence dispatched through
 * `runNestedStep` over any action type, and its output is the whole point
 * — `results[]` is a documented template surface. Sharing the loop would mean
 * generalising over both the effect requirement and the result vocabulary to
 * save four lines; sharing the RULE, which is what actually drifted, is what
 * this comment is for.
 */
const foldIteration = (
  tally: LoopTally,
  outcome: IterationOutcome,
  continueOnItemError: boolean
): LoopTally => {
  const iteration = { index: tally.iterations.length, steps: outcome.steps }
  const tolerated = tally.tolerated + outcome.tolerated
  const ran = { ...tally, iterations: [...tally.iterations, iteration], tolerated }
  if (outcome.kind === 'ok') return { ...ran, results: [...tally.results, outcome.output ?? {}] }
  if (outcome.kind === 'halted') {
    // An item parked on a long wait has no result yet: it is added at resume.
    const parked = outcome.halt.park !== undefined
    return {
      ...ran,
      results: parked ? tally.results : [...tally.results, outcome.output ?? {}],
      stopped: true,
      halt: outcome.halt,
    }
  }
  return {
    ...ran,
    results: [...tally.results, { error: outcome.error }],
    failed: tally.failed + 1,
    firstError: tally.firstError ?? outcome.error,
    stopped: !continueOnItemError,
  }
}

/**
 * Turn the tally into the step outcome. A loop with failures fails the STEP
 * (and so the run) unless the author opted into `continueOnItemError`; the
 * per-item results ride along either way so run-history records what did land.
 *
 * The RULE lives in `itemLoopOutcome` (`./shared`), shared with the four
 * `record/batch*` operators — this is the `LoopTally`-shaped adapter onto it,
 * and the only thing it adds is the loop's own output vocabulary
 * (`results`/`iterations`/`failed`) and fallback message. Note that the fold
 * ABOVE stays separate on purpose (see `foldIteration`); only the outcome rule
 * is shared, because only the outcome rule was duplicated.
 */
const loopOutcome = (tally: LoopTally, continueOnItemError: boolean): ActionOutcome => {
  const output = { results: tally.results, iterations: tally.results.length, failed: tally.failed }
  const nestedSteps = { iterations: tally.iterations }
  // An item skipped under `continueOnItemError` is a tolerated failure: the
  // run goes on past it, and ends `completed-with-errors` rather than `completed`.
  const skipped = continueOnItemError ? tally.failed : 0
  const count = tally.tolerated + skipped
  const tolerated = count > 0 ? { toleratedFailures: count } : {}
  // A park: the loop's row waits with what it has so far, the run with it.
  if (tally.halt?.park !== undefined) {
    return { status: 'success', output, nestedSteps, park: tally.halt.park }
  }
  const halted =
    tally.halt === undefined
      ? undefined
      : haltedOutcome(tally.halt, {
          output,
          nestedSteps,
          ...tolerated,
          ...(tally.responseOverride === undefined
            ? {}
            : { responseOverride: tally.responseOverride }),
        })
  return (
    halted ?? {
      ...itemLoopOutcome({
        failed: tally.failed,
        firstError: tally.firstError,
        output,
        continueOnItemError,
        fallbackError: 'loop.each: an item failed',
      }),
      nestedSteps,
      ...tolerated,
    }
  )
}

/** How a nested action's props are filled in for one item, from the item's run context. */
type FillProps = (
  action: Readonly<Record<string, unknown>>,
  itemContext: ActionRunContext
) => RenderedActionProps

interface IterationInput {
  readonly actions: ReadonlyArray<Readonly<Record<string, unknown>>>
  readonly runContext: ActionRunContext
  readonly loop: { readonly name: string; readonly item: unknown; readonly index: number }
  readonly runNested: NonNullable<ActionRunContext['runNestedStep']>
  readonly fill: FillProps
  /** Set on the item the run resumes inside. */
  readonly resume?: SequenceResume
}

/**
 * Run the nested action sub-sequence for one loop item, under the loop scopes
 * around it plus this item's own. Each action's props are filled in just
 * before it runs — so `{{loop.*}}` (this loop) and `{{loops.<name>.*}}` (any
 * loop around it) resolve, and so does `{{<step>.*}}` for an earlier action of
 * the SAME item (never another item's). The item's
 * result is its last action's output; a failure fails the item, and a stop, a
 * stopping filter or a pause ends the loop and the run.
 */
const runIteration = async (input: IterationInput): Promise<IterationOutcome> => {
  const { actions, runContext, loop, runNested, fill } = input
  const loopScopes = pushLoopScope(runContext.loopScopes, loop)
  const run = await runNestedSequence({
    actions,
    runNested,
    previousSteps: runContext.previousSteps,
    loopScopes,
    fillProps: (action, previousSteps) =>
      fill(action, { ...runContext, previousSteps, loopScopes }),
    ...(input.resume === undefined ? {} : { resume: input.resume }),
  })
  const { steps, tolerated } = run
  if (run.halt === undefined) return { kind: 'ok', output: run.last, steps, tolerated }
  if (run.halt.status === 'failure' && run.halt.cancelRun === undefined) {
    const error = run.halt.error ?? 'loop.each: an item failed'
    return { kind: 'failed', error, steps, tolerated }
  }
  const halt = { ...run.halt, ...pickOverride(run) }
  return { kind: 'halted', output: run.last, halt, steps, tolerated }
}

/** The `responseOverride` a sequence set, as a spreadable overlay. */
const pickOverride = (run: SequenceRun): Pick<ActionOutcome, 'responseOverride'> =>
  run.responseOverride === undefined ? {} : { responseOverride: run.responseOverride }

/**
 * Run one item's sub-sequence and reduce a rejection to a value: a defect in a
 * nested dispatch fails the item, and the caller DECIDES whether to continue
 * rather than having the whole chain unwound for it.
 */
const runIterationSafely = (input: IterationInput): Promise<IterationOutcome> =>
  runIteration(input).catch((cause: unknown): IterationOutcome => ({
    kind: 'failed',
    error: cause instanceof Error ? cause.message : String(cause),
    steps: [],
    tolerated: 0,
  }))

/** The iterations to run: every item up to `limit`, or — resuming — from the paused one. */
interface IterationsInput {
  readonly items: readonly unknown[]
  readonly limit: number
  readonly actions: ReadonlyArray<Readonly<Record<string, unknown>>>
  readonly runContext: ActionRunContext
  readonly runNested: NonNullable<ActionRunContext['runNestedStep']>
  readonly fill: FillProps
  readonly continueOnItemError: boolean
  /** The loop's step name, which `{{loops.<name>.*}}` reads its scope by. */
  readonly name: string
  readonly from?: {
    readonly item: number
    readonly tally: LoopTally
    readonly resume: SequenceResume
  }
}

/** An item parked the run: its park gains where the loop stands, for the loop's own frame. */
const withItemFrame = (outcome: IterationOutcome, index: number, items: readonly unknown[]) =>
  outcome.kind === 'halted' && outcome.halt.park !== undefined
    ? {
        ...outcome,
        halt: {
          ...outcome.halt,
          park: {
            ...outcome.halt.park,
            container: { kind: 'loop' as const, item: index, itemValue: items[index] },
          },
        },
      }
    : outcome

/** Run all iterations sequentially (one Promise chain) so step order and a
 *  failing item surface deterministically. */
const runAllIterations = (input: IterationsInput): Promise<LoopTally> => {
  const { items, limit, actions, runContext, runNested, fill, continueOnItemError, name } = input
  const first = input.from?.item ?? 0
  const indices = Array.from({ length: Math.max(0, limit - first) }, (_v, i) => first + i)
  return indices.reduce<Promise<LoopTally>>(
    async (prev, i) => {
      const tally = await prev
      if (tally.stopped) return tally
      const loop = { name, item: items[i], index: i }
      const resume = i === first ? input.from?.resume : undefined
      const iteration = { actions, runContext, loop, runNested, fill }
      const ran = await runIterationSafely(
        resume === undefined ? iteration : { ...iteration, resume }
      )
      const outcome = withItemFrame(ran, i, items)
      const next = foldIteration(tally, outcome, continueOnItemError)
      return outcome.kind === 'halted'
        ? {
            ...next,
            responseOverride: laterResponse(tally.responseOverride, outcome.halt.responseOverride),
          }
        : next
    },
    Promise.resolve(input.from?.tally ?? EMPTY_TALLY)
  )
}

/**
 * Where a loop the run resumes inside starts again: the item it paused on,
 * with the tally of the items before it — or the refusal that cancels the run
 * when the list it walks no longer holds that item there.
 */
const resumeFrom = (
  action: Readonly<Record<string, unknown>>,
  runContext: ActionRunContext,
  items: readonly unknown[]
): IterationsInput['from'] | string | undefined => {
  if (runContext.resume === undefined) return undefined
  const refusal = changedItemRefusal(String(action['name'] ?? ''), runContext.resume, items)
  return refusal ?? resumedLoopState(runContext.resume)
}

export const handleLoopEach: ActionHandler = (action, _app, _automation, runContext) =>
  Effect.gen(function* () {
    if (runContext === undefined || runContext.runNestedStep === undefined) {
      return ok({ results: [], iterations: 0 })
    }
    const runNested = runContext.runNestedStep
    const props = authoredActionProps(runContext)
    const items = asArray(resolveOwnProp(runContext, props['items']))
    // The loop body is the configuration as written, filled in once per item —
    // except a loop or a path in it, which fills in its own body as it runs.
    // A loop whose props a step handed over (final) runs them as given.
    const fill: FillProps =
      runContext.propsFinal === true
        ? finalNestedActionProps
        : (nested, item) => fillNestedActionProps(nested, item, buildRunContextView(item))
    const actions = asActionList(props['actions'])
    const limit = Math.min(items.length, maxIterationsOf(props))
    const continueOnItemError = props['continueOnItemError'] === true
    const from = resumeFrom(action, runContext, items)
    if (typeof from === 'string')
      return { status: 'failure' as const, error: from, cancelRun: from }

    return yield* Effect.tryPromise({
      // A per-item rejection is now caught inside the sequence, so this catch
      // only fires for a defect in the iteration machinery itself.
      try: () =>
        runAllIterations({
          items,
          limit,
          actions,
          runContext,
          runNested,
          fill,
          continueOnItemError,
          name: String(action['name'] ?? ''),
          ...(from === undefined ? {} : { from }),
        }),
      catch: (cause) =>
        new LoopIterationError({
          message: cause instanceof Error ? cause.message : String(cause),
          cause,
        }),
    }).pipe(
      Effect.match({
        onSuccess: (tally) => loopOutcome(tally, continueOnItemError),
        onFailure: (error) => fail(error.message),
      })
    )
  }).pipe(Effect.withSpan('automations.handle-loop-each', { attributes: actionAttributes(action) }))
