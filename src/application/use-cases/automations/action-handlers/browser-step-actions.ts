/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { BrowserFailure } from '@/application/ports/services/browser-driver'
import {
  fillFields,
  fillLocator,
  fillValue,
  readsEnv,
  type RawStep,
  type StepValueScope,
} from './browser-step-values'
import { resolveFileRef } from './document-file-ref'
import type { BrowserRunScope } from './browser-run-scope'
import type { StepRequirements } from '../run/types'
import type {
  BrowserExtraction,
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

/** A `check` / `waitFor` field read as a boolean or a literal, with its default. */
const flag = (step: RawStep, key: string, fallback: boolean): boolean =>
  typeof step[key] === 'boolean' ? (step[key] as boolean) : fallback

/** Read the files an `upload` names, refusing them past {@link UPLOAD_MAX_BYTES}. */
const readUploads = (
  scope: BrowserRunScope,
  refs: readonly unknown[]
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

const extractStep = (
  scope: BrowserRunScope,
  values: StepValueScope,
  step: RawStep,
  timeoutMs: number
) =>
  Effect.gen(function* () {
    const all = step['all'] === true
    const limit = typeof step['limit'] === 'number' ? step['limit'] : 100
    const fields = fillFields(values, step['fields'])
    const extraction = yield* scope.session.read(
      {
        target: fillLocator(values, step['target']),
        ...(typeof step['attribute'] === 'string' ? { attribute: step['attribute'] } : {}),
        ...(fields === undefined ? {} : { fields }),
        ...(all ? { all: { limit } } : {}),
      },
      timeoutMs
    )
    const value = yield* patterned(
      extraction,
      typeof step['pattern'] === 'string' ? step['pattern'] : undefined
    )
    const leftOut = extraction.kind === 'all' ? extraction.total - extraction.values.length : 0
    return {
      extracted: { as: String(step['as']), value },
      ...(leftOut > 0 ? { truncated: { leftOut } } : {}),
    } satisfies VerbResult
  })

const fillStep = (
  scope: BrowserRunScope,
  values: StepValueScope,
  step: RawStep,
  timeoutMs: number
) =>
  Effect.gen(function* () {
    const sensitive = step['sensitive'] === true || readsEnv(step['value'])
    const text = fillValue(values, step['value'])
    yield* scope.session.fill({
      target: fillLocator(values, step['target']),
      text,
      sensitive,
      timeoutMs,
    })
    return { value: sensitive ? '***' : text } satisfies VerbResult
  })

const waitOrAssert = (
  scope: BrowserRunScope,
  values: StepValueScope,
  step: RawStep,
  timeoutMs: number
) => {
  const target = step['target'] === undefined ? undefined : fillLocator(values, step['target'])
  if (step['do'] === 'waitFor') {
    const state = step['state'] === 'hidden' ? ('hidden' as const) : ('visible' as const)
    return scope.session.waitFor(
      target === undefined ? { url: fillValue(values, step['url']) } : { target, state },
      timeoutMs
    )
  }
  const text = step['text'] === undefined ? {} : { text: fillValue(values, step['text']) }
  return scope.session.assert(
    target === undefined ? { url: fillValue(values, step['url']) } : { target, ...text },
    timeoutMs
  )
}

/** One verb's runner. */
type Verb = (
  scope: BrowserRunScope,
  values: StepValueScope,
  step: RawStep,
  timeoutMs: number
) => Effect.Effect<VerbResult, BrowserFailure, StepRequirements>

const targetOf = (values: StepValueScope, step: RawStep) => fillLocator(values, step['target'])

const VERBS: Readonly<Record<string, Verb>> = {
  goto: (scope, values, step, timeoutMs) =>
    scope.session.goto(fillValue(values, step['url']), timeoutMs).pipe(Effect.as({})),
  fill: fillStep,
  click: (scope, values, step, timeoutMs) =>
    scope.session
      .click(targetOf(values, step), timeoutMs)
      .pipe(Effect.as(step['irreversible'] === true ? { submitted: true as const } : {})),
  select: (scope, values, step, timeoutMs) => {
    const option = fillValue(values, step['option'])
    return scope.session
      .select(targetOf(values, step), option, timeoutMs)
      .pipe(Effect.as({ value: option }))
  },
  check: (scope, values, step, timeoutMs) =>
    scope.session
      .check(targetOf(values, step), flag(step, 'checked', true), timeoutMs)
      .pipe(Effect.as({})),
  upload: (scope, values, step, timeoutMs) =>
    readUploads(scope, Array.isArray(step['files']) ? step['files'] : []).pipe(
      Effect.flatMap((files) => scope.session.upload(targetOf(values, step), files, timeoutMs)),
      Effect.as({})
    ),
  press: (scope, values, step, timeoutMs) => {
    const key = String(step['key'] ?? '')
    const on = step['target'] === undefined ? undefined : targetOf(values, step)
    return scope.session.press(key, on, timeoutMs).pipe(Effect.as({ value: key }))
  },
  waitFor: (scope, values, step, timeoutMs) =>
    waitOrAssert(scope, values, step, timeoutMs).pipe(Effect.as({})),
  assert: (scope, values, step, timeoutMs) =>
    waitOrAssert(scope, values, step, timeoutMs).pipe(Effect.as({})),
  extract: extractStep,
  screenshot: (scope, _values, step) =>
    scope.session.screenshot(step['fullPage'] === true).pipe(
      Effect.map((bytes) => ({
        screenshot: {
          bytes,
          name: typeof step['name'] === 'string' ? step['name'] : 'screenshot',
        },
      }))
    ),
  dismiss: (scope, values, step, timeoutMs) =>
    scope.session
      .dismiss(targetOf(values, step), timeoutMs)
      .pipe(Effect.map((shown) => (shown ? {} : { status: 'skipped' as const }))),
}

/** Run one verb. */
export const runVerb: Verb = (scope, values, step, timeoutMs) => {
  const verb = VERBS[String(step['do'])]
  return verb === undefined
    ? Effect.fail(failure(`unknown browser step "${String(step['do'])}"`))
    : verb(scope, values, step, timeoutMs)
}
