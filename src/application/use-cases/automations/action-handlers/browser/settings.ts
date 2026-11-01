/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  BrowserAgentActionSchema,
  BrowserRunActionSchema,
} from '@/domain/models/app/automations/actions/browser'
import { FilledText, OptionalFilledText, filledSettings } from '../document/filled-settings'
import type { DecodedAction } from '../decoded-handler'
import type { BrowserStep } from '@/domain/models/app/automations/actions/browser'

/**
 * The settings a `browser/*` handler is dispatched with (see
 * `../decoded-handler.ts`): each operator's declared props, refused when outside
 * them on every road the action comes by.
 *
 * A `browser/run`'s `steps` and a `browser/agent`'s `credentials` reach the
 * handler AS WRITTEN: the run keeps them out of its template pass and the
 * handler fills each value when its step is reached (`step-values.ts`), so
 * they are judged in their declared shape — a step a script hands over with a
 * verb that does not exist, a value that is not text or a `$env` read where it
 * would be recorded is refused before the browser opens. Kept as declared too:
 * `allowedHosts`, `session`, `timeouts`, `artifacts`, `selfHeal`, `maxSteps`,
 * `output` and `approveSubmit`. Filled: `idempotencyKey`, and an agent's
 * `goal` and `startUrl`.
 */

export const BrowserRunSettings = filledSettings(BrowserRunActionSchema, {
  idempotencyKey: OptionalFilledText,
})

export const BrowserAgentSettings = filledSettings(BrowserAgentActionSchema, {
  goal: FilledText,
  startUrl: FilledText,
})

/** A `browser/run` as its handler reads it. */
export type BrowserRunAction = DecodedAction<typeof BrowserRunSettings>

/** A `browser/agent` as its handler reads it. */
export type BrowserAgentAction = DecodedAction<typeof BrowserAgentSettings>

/** One step of a `browser/run`, as written. */
export type { BrowserStep }

/** The step of verb `V`. */
export type StepOf<V extends BrowserStep['do']> = Extract<BrowserStep, { readonly do: V }>

/** A step's element locator, as written. */
export type StepLocator = StepOf<'click'>['target']
