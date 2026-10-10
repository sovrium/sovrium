/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Clock, Effect } from 'effect'
import { isAllowedHost } from '@/domain/models/app/automations/actions/browser/browser-host-service'
import { pageShot } from './browser-run-support'
import { runVerbHealing } from './browser-self-heal'
import { stepTitle, type RawStep } from './browser-step-values'
import type {
  BrowserProgress,
  BrowserRunScope,
  ScreenshotRef,
  StepsResult,
  TraceEntry,
} from './browser-run-scope'
import type { VerbResult } from './browser-step-actions'
import type { StepRequirements } from '../run/types'

/**
 * Playing a `browser/run`'s steps, in order, one at a time.
 *
 * Each step gets a trace entry — status, duration, the address it ended on,
 * what it typed (`***` when sensitive), the dialog it met. A step marked
 * `optional` whose element never shows is traced as skipped and the run goes
 * on; any other failure ends the run there, and no later step runs.
 *
 * Before an irreversible click that asks a person first, the steps STOP and
 * answer `confirm`: the caller parks the run with the browser held open. When
 * the person approves, the steps are played again from that click.
 */

/** The value scope a step's templates are filled in against. */
const valuesOf = (scope: BrowserRunScope, progress: BrowserProgress) => ({
  runContext: scope.runContext,
  stepName: scope.stepName,
  extracted: progress.extracted,
})

const timeoutOf = (scope: BrowserRunScope, step: RawStep): number =>
  typeof step['timeoutMs'] === 'number' ? step['timeoutMs'] : scope.stepTimeoutMs

/** The address the page is on, or the last one known when it cannot be read. */
const urlAfter = (scope: BrowserRunScope, previous: string | undefined) =>
  scope.session.currentUrl.pipe(
    // effect-swallow: a page that cannot say where it is keeps the last address known; the step's own outcome already decided the run.
    Effect.orElseSucceed(() => previous)
  )

/** The trace fields a verb's result adds. */
const verbTrace = (result: VerbResult): Partial<TraceEntry> => ({
  ...(result.value === undefined ? {} : { value: result.value }),
  ...(result.truncated === undefined
    ? {}
    : { truncated: true as const, leftOut: result.truncated.leftOut }),
})

/** The submission's reference after this step: the first text read after the click, or `as: reference`. */
const referenceAfter = (progress: BrowserProgress, result: VerbResult): string | undefined => {
  const { extracted } = result
  const value = extracted?.value
  if (!progress.submitted || typeof value !== 'string') return progress.reference
  return progress.reference === undefined || extracted?.as === 'reference'
    ? value
    : progress.reference
}

/** Fold one finished step into the progress. */
const advance = (
  progress: BrowserProgress,
  entry: TraceEntry,
  result: VerbResult,
  shots: readonly ScreenshotRef[]
): BrowserProgress => {
  const { extracted } = result
  const reference = referenceAfter(progress, result)
  return {
    trace: [...progress.trace, entry],
    extracted:
      extracted === undefined
        ? progress.extracted
        : { ...progress.extracted, [extracted.as]: extracted.value },
    screenshots: [...progress.screenshots, ...shots],
    url: entry.url ?? progress.url,
    submitted: progress.submitted || result.submitted === true,
    ...(reference === undefined ? {} : { reference }),
    ...(result.healed === undefined && progress.healed === undefined
      ? {}
      : {
          healed: [
            ...(progress.healed ?? []),
            ...(result.healed === undefined ? [] : [result.healed]),
          ],
        }),
  }
}

/** The pictures a finished step leaves: its own `screenshot`, and one per step under `steps`. */
const stepShots = (
  scope: BrowserRunScope,
  result: VerbResult,
  index: number
): Effect.Effect<readonly ScreenshotRef[], never, StepRequirements> =>
  Effect.gen(function* () {
    if (result.screenshot !== undefined) {
      const shot = yield* scope.storeShot(result.screenshot.bytes, result.screenshot.name)
      return shot === undefined ? [] : [shot]
    }
    if (scope.screenshots !== 'steps') return []
    const bytes = yield* pageShot(scope.session)
    if (bytes._tag === 'None') return []
    const shot = yield* scope.storeShot(bytes.value, `step-${String(index + 1)}`)
    return shot === undefined ? [] : [shot]
  })

/** On the WebKit guard, a step that ends off `allowedHosts` fails ([internal ref] D3.2). */
const offListFailure = (scope: BrowserRunScope, url: string | undefined): string | undefined =>
  scope.session.guard === 'navigation-only' &&
  url !== undefined &&
  /^https?:/i.test(url) &&
  !isAllowedHost(url, scope.allowedHosts)
    ? `host_not_allowed: the page went to ${url}, which is not in allowedHosts`
    : undefined

interface StepOutcome {
  readonly progress: BrowserProgress
  readonly failure?: { readonly error: string; readonly code: string }
}

/** Run step `index` and fold it in, or answer how it failed. */
const runStep = (
  scope: BrowserRunScope,
  index: number,
  progress: BrowserProgress
): Effect.Effect<StepOutcome, never, StepRequirements> =>
  Effect.gen(function* () {
    const step = scope.steps[index] as RawStep
    const started = yield* Clock.currentTimeMillis
    if (step['irreversible'] === true && step['do'] === 'click') yield* scope.beforeSubmit
    const values = valuesOf(scope, progress)
    const timeoutMs = timeoutOf(scope, step)
    const result = yield* Effect.result(runVerbHealing({ scope, values, step, index, timeoutMs }))
    const dialogs = yield* scope.session.takeDialogs
    const url = yield* urlAfter(scope, progress.url)
    const lastDialog = dialogs.at(-1)
    const base: TraceEntry = {
      step: index + 1,
      ...(typeof step['label'] === 'string' ? { label: step['label'] } : {}),
      do: String(step['do']),
      status: 'ok',
      ms: (yield* Clock.currentTimeMillis) - started,
      ...(url === undefined ? {} : { url }),
      ...(lastDialog === undefined ? {} : { dialog: lastDialog.dialog, answer: lastDialog.answer }),
    }
    const end: StepEnd = { step, index, progress, base }
    if (result._tag === 'Failure') return foldFailure(end, result.failure)
    const offList = offListFailure(scope, url)
    if (offList !== undefined) {
      return failedAt(end, { error: offList, code: 'host_not_allowed' })
    }
    const verb = result.success
    const entry: TraceEntry = { ...base, ...verbTrace(verb), status: verb.status ?? 'ok' }
    const shots = yield* stepShots(scope, verb, index)
    return { progress: advance(progress, entry, verb, shots) }
  })

/** Where a step ended: the step, its position, the progress before it and its trace entry. */
interface StepEnd {
  readonly step: RawStep
  readonly index: number
  readonly progress: BrowserProgress
  readonly base: TraceEntry
}

/** A step that failed: traced, and the run's error naming it. */
const failedAt = (
  end: StepEnd,
  failure: { readonly error: string; readonly code: string }
): StepOutcome => ({
  progress: advance(end.progress, { ...end.base, status: 'failed', error: failure.error }, {}, []),
  failure: { error: `${stepTitle(end.step, end.index)}: ${failure.error}`, code: failure.code },
})

/** A step's failure: skipped when the step is optional and its element never showed. */
const foldFailure = (
  end: StepEnd,
  failure: { readonly code: string; readonly message: string }
): StepOutcome =>
  end.step['optional'] === true && failure.code === 'step_failed'
    ? { progress: advance(end.progress, { ...end.base, status: 'skipped' }, {}, []) }
    : failedAt(end, { error: failure.message, code: failure.code })

/** Whether step `index` is an irreversible click that asks first, and was not approved yet. */
const asksFirst = (scope: BrowserRunScope, index: number): boolean => {
  const step = scope.steps[index]
  return (
    step !== undefined &&
    step['do'] === 'click' &&
    step['irreversible'] === true &&
    step['confirm'] !== undefined &&
    scope.confirmedIndex !== index
  )
}

/** Play the steps from `index` on. */
const playFrom = (
  scope: BrowserRunScope,
  index: number,
  progress: BrowserProgress
): Effect.Effect<StepsResult, never, StepRequirements> =>
  Effect.gen(function* () {
    if (index >= scope.steps.length) return { kind: 'done', progress } as const
    if (asksFirst(scope, index)) return { kind: 'confirm', progress, index } as const
    const outcome = yield* runStep(scope, index, progress)
    if (outcome.failure !== undefined) {
      return { kind: 'failed', progress: outcome.progress, ...outcome.failure } as const
    }
    return yield* playFrom(scope, index + 1, outcome.progress)
  })

/** Play the steps from `index` on, under one span. */
export const runSteps = (
  scope: BrowserRunScope,
  index: number,
  progress: BrowserProgress
): Effect.Effect<StepsResult, never, StepRequirements> =>
  playFrom(scope, index, progress).pipe(Effect.withSpan('automations.browser-run-steps'))
