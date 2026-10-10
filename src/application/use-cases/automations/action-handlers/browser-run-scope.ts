/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { HealPolicy } from './browser-self-heal'
import type { VerbResult } from './browser-step-actions'
import type { RawStep } from './browser-step-values'
import type { ActionRunContext, AutomationContext } from './shared'
import type { StepRequirements } from '../run/types'
import type { AutomationRunRepository } from '@/application/ports/repositories/automations/automation-run-repository'
import type { BrowserSessionRepository } from '@/application/ports/repositories/automations/browser-session-repository'
import type { BrowserDriver, BrowserSession } from '@/application/ports/services/browser-driver'
import type { App } from '@/domain/models/app'
import type { Effect } from 'effect'

/**
 * The shapes one `browser/run` carries from step to step: what the run is
 * playing, and what it has produced so far.
 */

/**
 * What a `browser/run` needs beyond every step's services: the browser, the
 * stored sessions, and the run row a held confirmation abandons when nobody
 * answers in time.
 */
export type BrowserStepRequirements =
  BrowserDriver | BrowserSessionRepository | AutomationRunRepository

/** One entry of the run trace. Never holds a sensitive value. */
export interface TraceEntry {
  /** The step's position, from 1. */
  readonly step: number
  readonly label?: string
  readonly do: string
  readonly status: 'ok' | 'skipped' | 'failed'
  readonly ms: number
  /** The address the page was on when the step ended. */
  readonly url?: string
  /** What the step typed or chose — `***` for a sensitive value. */
  readonly value?: string
  /** The last dialog the step opened, and how it was answered. */
  readonly dialog?: string
  readonly answer?: string
  /** An `extract` with `all` read fewer elements than matched. */
  readonly truncated?: true
  readonly leftOut?: number
  /** Why the step failed. */
  readonly error?: string
}

/** A stored screenshot. */
export interface ScreenshotRef {
  readonly key: string
  readonly bucket: string
}

/** What the run has produced so far. */
export interface BrowserProgress {
  readonly trace: readonly TraceEntry[]
  readonly extracted: Readonly<Record<string, unknown>>
  readonly screenshots: readonly ScreenshotRef[]
  readonly url: string | undefined
  /** The irreversible click was made. */
  readonly submitted: boolean
  /** The value read after the irreversible click, kept as the submission's reference. */
  readonly reference?: string
  /** The steps a model's suggestion found (self-healing), in order. */
  readonly healed?: readonly NonNullable<VerbResult['healed']>[]
}

export const EMPTY_PROGRESS: BrowserProgress = {
  trace: [],
  extracted: {},
  screenshots: [],
  url: undefined,
  submitted: false,
}

/** How the steps ended. */
export type StepsResult =
  | { readonly kind: 'done'; readonly progress: BrowserProgress }
  | {
      readonly kind: 'failed'
      readonly progress: BrowserProgress
      readonly error: string
      readonly code: string
    }
  /** Stopped before an irreversible click that asks a person first. */
  | { readonly kind: 'confirm'; readonly progress: BrowserProgress; readonly index: number }

/** When the run keeps a picture of the page. */
export type ScreenshotPolicy = 'failure' | 'steps' | 'off'

/** What a run plays its steps with. */
export interface BrowserRunScope {
  readonly session: BrowserSession
  readonly app: App
  readonly automation: AutomationContext
  readonly runContext: ActionRunContext | undefined
  /** The browser action's own name. */
  readonly stepName: string
  readonly steps: readonly RawStep[]
  readonly allowedHosts: readonly string[]
  readonly stepTimeoutMs: number
  readonly screenshots: ScreenshotPolicy
  /** Store a picture; `undefined` when it could not be stored. */
  readonly storeShot: (
    bytes: Uint8Array,
    name: string
  ) => Effect.Effect<ScreenshotRef | undefined, never, StepRequirements>
  /** Runs just before the irreversible click: the idempotency key turns `pending`. */
  readonly beforeSubmit: Effect.Effect<void, never, StepRequirements>
  /** The step whose confirmation a person approved: it clicks without asking again. */
  readonly confirmedIndex?: number
  /** How a step that missed its element may be healed; absent, only `heal: true` steps are. */
  readonly healPolicy?: HealPolicy
}
