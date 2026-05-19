/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { evaluateVisibleWhen, type FieldValue } from './visible-when-evaluator'
import type { VisibleWhenCondition } from './visible-when'

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

export const getDeclaredSteps = (form: Readonly<FormShape>): ReadonlyArray<FormStepShape> =>
  form.steps ?? []

export const isStepVisible = (
  step: Readonly<FormStepShape>,
  values: Readonly<Record<string, FieldValue>>
): boolean => {
  if (step.visibleWhen === undefined) return true
  return evaluateVisibleWhen(step.visibleWhen, values)
}

export const getVisibleSteps = (
  form: Readonly<FormShape>,
  values: Readonly<Record<string, FieldValue>>
): ReadonlyArray<FormStepShape> =>
  getDeclaredSteps(form).filter((step) => isStepVisible(step, values))

export const findStep = (form: Readonly<FormShape>, stepId: string): FormStepShape | undefined =>
  getDeclaredSteps(form).find((step) => step.id === stepId)

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

  const declared = getDeclaredSteps(form)
  const fromIndex = declared.findIndex((step) => step.id === fromStepId)
  if (fromIndex < 0) return undefined
  const subsequent = declared.slice(fromIndex + 1)
  const next = subsequent.find((step) => isStepVisible(step, values))
  return next?.id
}

export const collectFieldsInSkippedSteps = (
  form: Readonly<FormShape>,
  values: Readonly<Record<string, FieldValue>>
): ReadonlySet<string> => {
  const skipped = getDeclaredSteps(form).filter((step) => !isStepVisible(step, values))
  return new Set<string>(skipped.flatMap((step) => Array.from(step.fields)))
}
