/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { referenceAuthoredValues } from '../authored-references'
import { resolveTriggerInString } from '../resolve-trigger-data'
import { buildRunContextView } from './run-context-resolution'
import type { ActionRunContext } from './shared'
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

/** A raw step, as written in the config. */
export type RawStep = Readonly<Record<string, unknown>>

/** What a step's values are filled in against. */
export interface StepValueScope {
  readonly runContext: ActionRunContext | undefined
  /** The browser action's own name, read back as `{{steps.<name>.extracted.*}}`. */
  readonly stepName: string
  readonly extracted: Readonly<Record<string, unknown>>
}

/** Whether a written value reads an environment variable. */
export const readsEnv = (value: unknown): boolean =>
  typeof value === 'string' && value.includes('$env.')

/** Fill in one written value. Non-strings are read as text. */
export const fillValue = (scope: StepValueScope, value: unknown): string => {
  if (value === undefined || value === null) return ''
  const text = String(value)
  const { runContext } = scope
  if (runContext === undefined || runContext.propsFinal === true) return text
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

const TEXT_KEYS = ['name', 'label', 'text', 'placeholder'] as const

/** A step locator with its text filled in. */
export const fillLocator = (scope: StepValueScope, raw: unknown): BrowserLocator => {
  const locator = (typeof raw === 'object' && raw !== null ? raw : {}) as Readonly<
    Record<string, unknown>
  >
  const filled = Object.fromEntries(
    TEXT_KEYS.filter((key) => locator[key] !== undefined).map((key) => [
      key,
      fillValue(scope, locator[key]),
    ])
  )
  return {
    ...(typeof locator['role'] === 'string' ? { role: locator['role'] } : {}),
    ...filled,
    ...(typeof locator['testId'] === 'string' ? { testId: locator['testId'] } : {}),
    ...(typeof locator['selector'] === 'string' ? { selector: locator['selector'] } : {}),
    ...(typeof locator['exact'] === 'boolean' ? { exact: locator['exact'] } : {}),
    ...(typeof locator['nth'] === 'number' ? { nth: locator['nth'] } : {}),
  }
}

/** The `fields` locators of an `extract`, filled in. */
export const fillFields = (
  scope: StepValueScope,
  raw: unknown
): Readonly<Record<string, BrowserLocator>> | undefined =>
  typeof raw === 'object' && raw !== null
    ? Object.fromEntries(
        Object.entries(raw as Record<string, unknown>).map(([key, locator]) => [
          key,
          fillLocator(scope, locator),
        ])
      )
    : undefined

/** How a step is named in a trace and an error: its label, or its position. */
export const stepTitle = (step: RawStep, index: number): string => {
  const label = typeof step['label'] === 'string' ? ` "${step['label']}"` : ''
  return `browser step ${String(index + 1)}${label} (${String(step['do'] ?? '?')})`
}
