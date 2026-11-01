/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { BrowserFailure } from '@/application/ports/services/browser-driver'
import { resolveFileRef } from '../document/file-ref'
import { fillFields, fillLocator, fillValue, readsEnv, type StepValueScope } from './step-values'
import type { BrowserRunScope } from './run-scope'
import type { BrowserStep, StepOf } from './settings'
import type { StepRequirements } from '../../run/types'
import type {
  BrowserExtraction,
  BrowserLocator,
  BrowserUploadFile,
} from '@/application/ports/services/browser-driver'

/**
 * What each verb of a `browser/run` step does with the session ([internal ref] D6).
 * A verb answers what its trace entry records — never a value it typed when
 * that value is sensitive — and fails with a {@link BrowserFailure}.
 */

/** What one verb leaves for its trace entry and the run's output. */
export interface VerbResult {
  readonly status?: 'ok' | 'skipped'
  readonly value?: string
  readonly extracted?: { readonly as: string; readonly value: unknown }
  readonly truncated?: { readonly leftOut: number }
  readonly screenshot?: { readonly bytes: Uint8Array; readonly name: string }
  /** The irreversible click was made. */
  readonly submitted?: true
  /** The step found its element through a model's suggestion (self-healing). */
  readonly healed?: {
    readonly step: number
    readonly from: Readonly<Record<string, unknown>>
    readonly suggested: Readonly<Record<string, unknown>>
  }
}

/** The largest upload a step carries, in bytes ([internal ref] D6): a constant, not a variable. */
export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024

const failure = (message: string, code: BrowserFailure['code'] = 'step_failed') =>
  new BrowserFailure({ code, message })

/** Read the files an `upload` names, refusing them past {@link UPLOAD_MAX_BYTES}. */
const readUploads = (
  scope: BrowserRunScope,
  refs: StepOf<'upload'>['files']
): Effect.Effect<readonly BrowserUploadFile[], BrowserFailure, StepRequirements> =>
  Effect.gen(function* () {
    const files = yield* Effect.forEach(refs, (ref) =>
      resolveFileRef(
        { ref, origin: 'config', prop: 'steps' },
        { app: scope.app, automation: scope.automation, runContext: scope.runContext },
        UPLOAD_MAX_BYTES
      ).pipe(
        Effect.mapError((error) =>
          error.oversized === undefined
            ? failure(error.message)
            : failure(
                `upload_too_large: ${error.oversized} is larger than the 10 MiB a browser upload may carry`,
                'upload_too_large'
              )
        )
      )
    )
    const total = files.reduce((sum, file) => sum + file.bytes.length, 0)
    if (total > UPLOAD_MAX_BYTES) {
      return yield* failure(
        `upload_too_large: the files weigh ${String(total)} bytes together, more than the 10 MiB a browser upload may carry`,
        'upload_too_large'
      )
    }
    return files.map((file) => ({
      name: file.filename,
      contentType: file.contentType,
      bytes: file.bytes,
    }))
  })

/** A regular expression the config wrote, applied to what was read: its first group, or the match. */
const applyPattern = (value: string, pattern: string): string | undefined => {
  // eslint-disable-next-line sovrium/no-dynamic-regexp -- operator-authored `extract.pattern` is the documented feature; validated at decode, run on page text only
  const match = new RegExp(pattern).exec(value)
  if (match === null) return undefined
  return match[1] ?? match[0]
}

/** The extracted value, with the step's `pattern` applied to every string in it. */
const patterned = (
  extraction: BrowserExtraction,
  pattern: string | undefined
): Effect.Effect<unknown, BrowserFailure> => {
  const values = extraction.kind === 'one' ? [extraction.value] : extraction.values
  if (pattern === undefined) {
    return Effect.succeed(extraction.kind === 'one' ? extraction.value : values)
  }
  const kept = values.map((value) =>
    typeof value === 'string' ? applyPattern(value, pattern) : value
  )
  const missed = values.find((_, index) => kept[index] === undefined)
  if (missed !== undefined) {
    return Effect.fail(failure(`the pattern ${pattern} found nothing in "${String(missed)}"`))
  }
  return Effect.succeed(extraction.kind === 'one' ? kept[0] : kept)
}

/**
 * Where a step plays: the run, the values its templates are filled in
 * against, its time limit, and — once a step missed its element — a locator a
 * model suggested (`self-heal.ts`), plain text played instead of its `target`.
 */
export interface VerbRun {
  readonly scope: BrowserRunScope
  readonly values: StepValueScope
  readonly timeoutMs: number
  readonly retarget?: BrowserLocator
}

/** The runner of a verb, given its step as written. */
type Verb<S extends BrowserStep> = (
  run: VerbRun,
  step: S
) => Effect.Effect<VerbResult, BrowserFailure, StepRequirements>

/** The element a step acts on: the suggested locator, else its own target filled in. */
const targetOf = (run: VerbRun, step: { readonly target: Parameters<typeof fillLocator>[1] }) =>
  run.retarget ?? fillLocator(run.values, step.target)

const extractStep: Verb<StepOf<'extract'>> = (run, step) =>
  Effect.gen(function* () {
    const fields = fillFields(run.values, step.fields)
    const extraction = yield* run.scope.session.read(
      {
        target: targetOf(run, step),
        ...(step.attribute === undefined ? {} : { attribute: step.attribute }),
        ...(fields === undefined ? {} : { fields }),
        ...(step.all === true ? { all: { limit: step.limit ?? 100 } } : {}),
      },
      run.timeoutMs
    )
    const value = yield* patterned(extraction, step.pattern)
    const leftOut = extraction.kind === 'all' ? extraction.total - extraction.values.length : 0
    return {
      extracted: { as: step.as, value },
      ...(leftOut > 0 ? { truncated: { leftOut } } : {}),
    } satisfies VerbResult
  })

const fillStep: Verb<StepOf<'fill'>> = (run, step) =>
  Effect.gen(function* () {
    const sensitive = step.sensitive === true || readsEnv(step.value)
    const text = fillValue(run.values, step.value)
    yield* run.scope.session.fill({
      target: targetOf(run, step),
      text,
      sensitive,
      timeoutMs: run.timeoutMs,
    })
    return { value: sensitive ? '***' : text } satisfies VerbResult
  })

/** `waitFor` and `assert`: a target (for `waitFor`, its state; for `assert`, its text), or an address. */
const waitOrAssert = (
  { scope, values, timeoutMs }: VerbRun,
  step: StepOf<'waitFor' | 'assert'>
) => {
  const target = step.target === undefined ? undefined : fillLocator(values, step.target)
  const url = { url: fillValue(values, step.url ?? '') }
  if (step.do === 'waitFor') {
    return scope.session.waitFor(
      target === undefined ? url : { target, state: step.state ?? 'visible' },
      timeoutMs
    )
  }
  const text = step.text === undefined ? {} : { text: fillValue(values, step.text) }
  return scope.session.assert(target === undefined ? url : { target, ...text }, timeoutMs)
}

/** Every verb's runner, by verb. */
const VERBS: { readonly [V in BrowserStep['do']]: Verb<StepOf<V>> } = {
  goto: ({ scope, values, timeoutMs }, step) =>
    scope.session.goto(fillValue(values, step.url), timeoutMs).pipe(Effect.as({})),
  fill: fillStep,
  // An irreversible click holds its idempotency key once its element is found, right before the click.
  click: (run, step) =>
    step.irreversible === true
      ? run.scope.session
          .click(targetOf(run, step), run.timeoutMs, run.scope.beforeSubmit)
          .pipe(Effect.as({ submitted: true as const }))
      : run.scope.session.click(targetOf(run, step), run.timeoutMs).pipe(Effect.as({})),
  select: (run, step) => {
    const option = fillValue(run.values, step.option)
    return run.scope.session
      .select(targetOf(run, step), option, run.timeoutMs)
      .pipe(Effect.as({ value: option }))
  },
  check: (run, step) =>
    run.scope.session
      .check(targetOf(run, step), step.checked ?? true, run.timeoutMs)
      .pipe(Effect.as({})),
  upload: (run, step) =>
    readUploads(run.scope, step.files).pipe(
      Effect.flatMap((files) =>
        run.scope.session.upload(targetOf(run, step), files, run.timeoutMs)
      ),
      Effect.as({})
    ),
  press: ({ scope, values, timeoutMs }, step) => {
    const key = fillValue(values, step.key)
    const on = step.target === undefined ? undefined : fillLocator(values, step.target)
    return scope.session
      .press(key, on, timeoutMs)
      .pipe(Effect.as({ value: readsEnv(step.key) ? '***' : key }))
  },
  waitFor: (run, step) => waitOrAssert(run, step).pipe(Effect.as({})),
  assert: (run, step) => waitOrAssert(run, step).pipe(Effect.as({})),
  extract: extractStep,
  screenshot: ({ scope }, step) =>
    scope.session
      .screenshot(step.fullPage === true)
      .pipe(Effect.map((bytes) => ({ screenshot: { bytes, name: step.name ?? 'screenshot' } }))),
  dismiss: (run, step) =>
    run.scope.session
      .dismiss(fillLocator(run.values, step.target), run.timeoutMs)
      .pipe(Effect.map((shown) => (shown ? {} : { status: 'skipped' as const }))),
}

/** Run the verb `V` on its step. */
const runOne = <V extends BrowserStep['do']>(verb: V, run: VerbRun, step: StepOf<V>) =>
  VERBS[verb](run, step)

/** Run one step's verb. */
export const runVerb: Verb<BrowserStep> = (run, step) => runOne(step.do, run, step)
