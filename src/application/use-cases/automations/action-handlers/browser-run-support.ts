/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The pieces of a `browser/run` that are not its steps: its options, its
 * output, where its screenshots go, and its idempotency key.
 */

import { Effect, Ref } from 'effect'
import { AutomationStateRepository } from '@/application/ports/repositories/automations/automation-state-repository'
import { StorageService } from '@/application/ports/services/storage-service'
import { browserArtifactKey } from '@/domain/models/app/automations/actions/browser/browser-artifact-service'
import { SYSTEM_BUCKET_NAME } from '@/domain/models/app/buckets/bucket-identity'
import { logError } from '@/infrastructure/logging/logger'
import { uploadArtifactTo } from './file-support'
import type { BrowserProgress, ScreenshotPolicy, ScreenshotRef } from './browser-run-scope'
import type { RawStep } from './browser-step-values'
import type { ActionRunContext, AutomationContext } from './shared'
import type { BrowserSession } from '@/application/ports/services/browser-driver'
import type { Option } from 'effect'

type Props = Readonly<Record<string, unknown>>

const recordOf = (value: unknown): Props =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Props) : {}

/** The state key an idempotency key is kept under, per action. */
export const idempotencyStateKey = (stepName: string, key: string): string =>
  `browser-submission:${stepName}:${key}`

/** What an idempotency key says about an earlier run. */
export type KeyState =
  { readonly state: 'pending' } | { readonly state: 'done'; readonly reference?: string }

/** What an idempotency key says, or `undefined` when no run used it yet. */
export const readIdempotencyKey = Effect.fn('automations.browser-read-idempotency-key')(function* (
  automationId: string,
  stateKey: string
) {
  const repo = yield* AutomationStateRepository
  const value = recordOf(yield* repo.get({ automationId, key: stateKey }))
  if (value['state'] === 'pending') return { state: 'pending' } as KeyState
  if (value['state'] !== 'done') return undefined
  return {
    state: 'done',
    ...(typeof value['reference'] === 'string' ? { reference: value['reference'] } : {}),
  } as KeyState
})

/** Record what an idempotency key says. A key that cannot be written never stops the run. */
export const writeIdempotencyKey = Effect.fn('automations.browser-write-idempotency-key')(
  function* (automationId: string, stateKey: string, value: Props) {
    const repo = yield* AutomationStateRepository
    yield* repo.set({ automationId, key: stateKey, value })
  },
  (written) =>
    written.pipe(
      Effect.tapCause((cause) =>
        Effect.sync(() => logError('[browser] the idempotency key could not be written', cause))
      ),
      // effect-swallow: logged above; a key that cannot be written must not stop a run already under way.
      Effect.ignoreCause
    )
)

/** The run's output: what later steps read as `{{steps.<name>.*}}`. */
export const browserRunOutputOf = (
  progress: BrowserProgress,
  extra: Props = {}
): Readonly<Record<string, unknown>> => ({
  ...(progress.url === undefined ? {} : { url: progress.url }),
  extracted: progress.extracted,
  ...(progress.reference === undefined ? {} : { reference: progress.reference }),
  ...(progress.healed === undefined ? {} : { healed: progress.healed }),
  screenshots: progress.screenshots,
  trace: progress.trace,
  ...extra,
})

/**
 * A picture of the page for the run's record, or `None` when the page could not
 * be captured. Never fails: the picture illustrates an outcome the step already
 * decided.
 */
export const pageShot = (session: BrowserSession): Effect.Effect<Option.Option<Uint8Array>> =>
  session.screenshot(false).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() => logError('[browser] the page could not be captured', cause))
    ),
    // effect-swallow: logged above; a missing picture never changes how the step or the run ended.
    Effect.option,
    Effect.withSpan('automations.browser-page-shot')
  )

/**
 * Store a screenshot under the run's prefix, in the artifact bucket. Pictures
 * are numbered in the order they are taken, from `counter`.
 */
export const shotStore =
  (input: {
    readonly runId: string
    readonly bucket: string
    readonly automation: AutomationContext
    readonly counter: Ref.Ref<number>
  }) =>
  (bytes: Uint8Array, name: string) =>
    Effect.gen(function* () {
      const storage = yield* StorageService
      const sequence = yield* Ref.getAndUpdate(input.counter, (n) => n + 1)
      const key = browserArtifactKey(input.runId, sequence, name)
      const stored = yield* uploadArtifactTo(
        storage,
        key,
        { bytes, contentType: 'image/png' },
        { bucket: input.bucket, uploadedById: undefined, generatedBy: input.automation.name }
      )
      return stored ? ({ key, bucket: input.bucket } satisfies ScreenshotRef) : undefined
    }).pipe(Effect.withSpan('automations.browser-store-shot'))

/** The run's limits and options, read from its props. */
export interface BrowserRunOptions {
  readonly stepName: string
  readonly allowedHosts: readonly string[]
  readonly session: string | undefined
  readonly idempotencyKey: string | undefined
  readonly steps: readonly RawStep[]
  readonly stepMs: number | undefined
  readonly runMs: number | undefined
  readonly screenshots: ScreenshotPolicy
  readonly bucket: string
}

const stringOr = <F>(value: unknown, fallback: F): string | F =>
  typeof value === 'string' && value !== '' ? value : fallback

const numberOrUndefined = (value: unknown): number | undefined =>
  typeof value === 'number' ? value : undefined

const screenshotPolicyOf = (value: unknown): ScreenshotPolicy =>
  value === 'steps' || value === 'off' ? value : 'failure'

export const browserRunOptionsOf = (action: Props): BrowserRunOptions => {
  const props = recordOf(action['props'])
  const timeouts = recordOf(props['timeouts'])
  const artifacts = recordOf(props['artifacts'])
  const hosts = Array.isArray(props['allowedHosts']) ? props['allowedHosts'] : []
  return {
    stepName: stringOr(action['name'], 'browser'),
    allowedHosts: hosts.filter((h): h is string => typeof h === 'string'),
    session: stringOr(props['session'], undefined),
    idempotencyKey: stringOr(props['idempotencyKey'], undefined),
    steps: Array.isArray(props['steps']) ? (props['steps'] as RawStep[]) : [],
    stepMs: numberOrUndefined(timeouts['stepMs']),
    runMs: numberOrUndefined(timeouts['runMs']),
    screenshots: screenshotPolicyOf(artifacts['screenshots']),
    bucket: stringOr(artifacts['bucket'], SYSTEM_BUCKET_NAME),
  }
}

/** What a resumed run (its confirmation approved) starts from. */
export const resumedFrom = (
  runContext: ActionRunContext | undefined
): { readonly progress: BrowserProgress; readonly index: number } | undefined => {
  const prior = recordOf(runContext?.resume?.prior.output)
  if (typeof prior['confirmAt'] !== 'number') return undefined
  return {
    index: prior['confirmAt'],
    progress: {
      trace: Array.isArray(prior['trace']) ? prior['trace'] : [],
      extracted: recordOf(prior['extracted']),
      screenshots: Array.isArray(prior['screenshots']) ? prior['screenshots'] : [],
      url: typeof prior['url'] === 'string' ? prior['url'] : undefined,
      submitted: false,
      ...(Array.isArray(prior['healed']) ? { healed: prior['healed'] } : {}),
    },
  }
}
