/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { referenceAuthoredValues } from '../../authored-references'
import { resolveTriggerInString } from '../../resolve-trigger-data'
import { buildRunContextView } from '../run-context-resolution'
import type { BrowserStep, StepLocator } from './settings'
import type { ActionRunContext } from '../shared'
import type { BrowserLocator } from '@/application/ports/services/browser-driver'

/**
 * Filling in a browser step's values, one step at a time.
 *
 * The run's generic template pass leaves `steps` AS WRITTEN
 * (`run/render-action-props.ts`): a step's values are filled in here, when the
 * step is reached, so `{{steps.<this step>.extracted.x}}` reads what this very
 * run read a moment earlier, and a `$env` value is typed into the page without
 * ever being written to the run's stored input, its trace or an error.
 *
 * A value that reads `$env` is SENSITIVE whatever the step says: it is shown
 * as `***` in the trace and its field is painted over in screenshots.
 */

/** What a step's values are filled in against. */
export interface StepValueScope {
  readonly runContext: ActionRunContext | undefined
  /** The browser action's own name, read back as `{{steps.<name>.extracted.*}}`. */
  readonly stepName: string
  readonly extracted: Readonly<Record<string, unknown>>
}

/** Whether a written value reads an environment variable. */
export const readsEnv = (value: string): boolean => value.includes('$env.')

/** Fill in one written value. */
export const fillValue = (scope: StepValueScope, text: string): string => {
  const { runContext } = scope
  if (runContext === undefined) return text
  // Props a caller handed over as data stay text; a `path` or `loop` kept these as written for us.
  if (runContext.propsFinal === true && runContext.handlerFills !== true) return text
  const referenced = referenceAuthoredValues(text, { envLookup: runContext.envLookup })
  const view = buildRunContextView({
    ...runContext,
    previousSteps: {
      ...runContext.previousSteps,
      [scope.stepName]: { extracted: scope.extracted },
    },
  })
  return resolveTriggerInString(referenced, view, runContext.templates)
}

/** A written text of a locator, filled in; absent stays absent. */
const filledText = (scope: StepValueScope, written: string | undefined) =>
  written === undefined ? undefined : fillValue(scope, written)

/** A step locator with its text filled in. */
export const fillLocator = (scope: StepValueScope, locator: StepLocator): BrowserLocator => {
  const { name, label, text, placeholder, ...fixed } = locator
  const filled = { name, label, text, placeholder }
  return {
    ...fixed,
    ...Object.fromEntries(
      Object.entries(filled).flatMap(([key, written]) => {
        const value = filledText(scope, written)
        return value === undefined ? [] : [[key, value]]
      })
    ),
  }
}

/** The `fields` locators of an `extract`, filled in. */
export const fillFields = (
  scope: StepValueScope,
  fields: Readonly<Record<string, StepLocator>> | undefined
): Readonly<Record<string, BrowserLocator>> | undefined =>
  fields === undefined
    ? undefined
    : Object.fromEntries(
        Object.entries(fields).map(([key, locator]) => [key, fillLocator(scope, locator)])
      )

/** How a step is named in a trace and an error: its label, or its position. */
export const stepTitle = (step: BrowserStep, index: number): string => {
  const label = step.label === undefined ? '' : ` "${step.label}"`
  return `browser step ${String(index + 1)}${label} (${step.do})`
}
