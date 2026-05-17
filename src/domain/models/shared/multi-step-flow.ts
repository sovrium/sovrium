/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Multi-Step Form Flow Helpers
 *
 * Pure functions that drive the multi-step form server endpoints:
 *   - `isStepVisible` — evaluate `step.visibleWhen` against accumulated
 *     submission values. Skipped steps render nothing, validate nothing,
 *     and contribute no values to the final submission (APP-FORMS-042).
 *   - `getVisibleSteps` — filter `form.steps[]` by `visibleWhen`.
 *   - `findStep` / `findStepIndex` — look up by id.
 *   - `resolveNextStepId` — APP-FORMS-043: evaluate `goToWhen` rules in
 *     order; first match wins; otherwise fall through to the next visible
 *     step in declaration order.
 *   - `collectFieldsInSkippedSteps` — list every field identifier that
 *     belongs to a step whose `visibleWhen` evaluates false. The final
 *     `POST /submissions` handler uses this to drop their values from the
 *     persisted record (APP-FORMS-042).
 *
 * All helpers expect the `Form` shape with `steps[]` already cross-validated
 * (see `domain/models/shared/forms-validation.ts`). Reuses the field-value
 * predicate evaluator from F-12 (`evaluateVisibleWhen`) so step visibility
 * speaks the same operator catalog as field visibility.
 */

import { evaluateVisibleWhen, type FieldValue } from './visible-when-evaluator'
import type { VisibleWhenCondition } from './visible-when'

/**
 * Structural form-shape this module needs. Defined locally rather than
 * imported from `app/forms` to keep `domain-model-shared` free of
 * `domain-model-feature` imports (boundaries.config.ts enforces the
 * separation). Mirrors the same pattern used by `forms-validation.ts`.
 */
export interface FormStepShape {
  readonly id: string
  readonly fields: ReadonlyArray<string>
  readonly visibleWhen?: VisibleWhenCondition
  readonly goToWhen?: ReadonlyArray<{
    readonly when: VisibleWhenCondition
    readonly goTo: string
  }>
}

export interface FormShape {
  readonly steps?: ReadonlyArray<FormStepShape>
}

/**
 * `Form['steps']` is `optional` on the schema; this helper coerces the
 * type so callers can iterate without null-checks. Returns the empty
 * array when steps are not configured.
 */
export const getDeclaredSteps = (form: Readonly<FormShape>): ReadonlyArray<FormStepShape> =>
  form.steps ?? []

/**
 * Evaluate a step's `visibleWhen` against the supplied value record. A
 * step with no `visibleWhen` is always visible. Mirrors the per-field
 * `isFieldVisible` helper inside `submit-form.ts`.
 */
export const isStepVisible = (
  step: Readonly<FormStepShape>,
  values: Readonly<Record<string, FieldValue>>
): boolean => {
  if (step.visibleWhen === undefined) return true
  return evaluateVisibleWhen(step.visibleWhen, values)
}

/**
 * Filter `form.steps[]` to the steps actually rendered for the given
 * value record. Used by the renderer to compute the progress indicator
 * ("step X of N visible steps") and by the advance endpoint to walk to
 * the next visible step in declaration order.
 */
export const getVisibleSteps = (
  form: Readonly<FormShape>,
  values: Readonly<Record<string, FieldValue>>
): ReadonlyArray<FormStepShape> =>
  getDeclaredSteps(form).filter((step) => isStepVisible(step, values))

/**
 * Locate a step by id within `form.steps[]`. Returns `undefined` when
 * the id is not registered (the cross-validator catches this at app load
 * for `goToWhen.goTo`, but submitter-supplied stepIds in the URL still
 * need a guard at the route boundary).
 */
export const findStep = (form: Readonly<FormShape>, stepId: string): FormStepShape | undefined =>
  getDeclaredSteps(form).find((step) => step.id === stepId)

/**
 * APP-FORMS-043: resolve the next step id after the supplied step.
 *
 *   1. Walk `step.goToWhen[]` in order. The first rule whose `when`
 *      evaluates true wins; its `goTo` is the next step.
 *   2. If no rule matches (or `goToWhen` is absent), fall through to the
 *      next *visible* step in `form.steps[]` declaration order.
 *   3. Returns `undefined` when the supplied step is already the last
 *      visible step (the renderer interprets `undefined` as "show submit
 *      button instead of Next").
 */
export const resolveNextStepId = (
  form: Readonly<FormShape>,
  fromStepId: string,
  values: Readonly<Record<string, FieldValue>>
): string | undefined => {
  const fromStep = findStep(form, fromStepId)
  if (fromStep === undefined) return undefined
  const goToWhen = fromStep.goToWhen ?? []
  const matched = goToWhen.find((rule) => evaluateVisibleWhen(rule.when, values))
  if (matched !== undefined) return matched.goTo

  // Linear fallthrough: walk forward in declaration order, skipping
  // `visibleWhen=false` steps.
  const declared = getDeclaredSteps(form)
  const fromIndex = declared.findIndex((step) => step.id === fromStepId)
  if (fromIndex < 0) return undefined
  const subsequent = declared.slice(fromIndex + 1)
  const next = subsequent.find((step) => isStepVisible(step, values))
  return next?.id
}

/**
 * APP-FORMS-042: collect every field identifier that belongs to a step
 * whose `visibleWhen` evaluates false. The final `POST /submissions`
 * handler uses this to drop those values from the persisted record so a
 * skipped step contributes nothing to the bound table OR to the
 * submission ledger.
 */
export const collectFieldsInSkippedSteps = (
  form: Readonly<FormShape>,
  values: Readonly<Record<string, FieldValue>>
): ReadonlySet<string> => {
  const skipped = getDeclaredSteps(form).filter((step) => !isStepVisible(step, values))
  return new Set<string>(skipped.flatMap((step) => Array.from(step.fields)))
}
