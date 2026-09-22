/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Pure helpers for single-page `fieldGroups[]` section dividers.
 *
 * A field group renders a labeled section header above its listed fields.
 * When a group declares a `visibleWhen` rule that evaluates false, the
 * entire group (label + every field listed under it) is hidden at render
 * time AND its fields are excluded from required-field validation on submit
 *.
 *
 * Local `FormGroupShape` is declared here (rather than importing
 * `FormFieldGroup` from `app/forms`) to keep `domain-model-shared` free of
 * `domain-model-feature` imports — the same boundary discipline used by
 * `multi-step-flow.ts`.
 */

import { evaluateVisibleWhen, type FieldValue } from './visible-when-evaluator'
import type { VisibleWhenCondition } from './visible-when'

export interface FormGroupShape {
  readonly label: string
  readonly fields: ReadonlyArray<string>
  readonly visibleWhen?: VisibleWhenCondition
}

export interface FormGroupsShape {
  readonly fieldGroups?: ReadonlyArray<FormGroupShape>
}

/**
 * `Form['fieldGroups']` is `optional`; this helper coerces to an array so
 * callers can iterate without a null-check. Returns the empty array when no
 * groups are configured.
 */
export const getDeclaredGroups = (form: Readonly<FormGroupsShape>): ReadonlyArray<FormGroupShape> =>
  form.fieldGroups ?? []

/**
 * Evaluate a group's `visibleWhen` against the supplied value record. A
 * group with no `visibleWhen` is always visible.
 */
export const isGroupVisible = (
  group: Readonly<FormGroupShape>,
  values: Readonly<Record<string, FieldValue>>
): boolean => {
  if (group.visibleWhen === undefined) return true
  return evaluateVisibleWhen(group.visibleWhen, values)
}

/**
 * Collect every field identifier that belongs to a group whose `visibleWhen`
 * evaluates false. The submit handler uses this to drop those values from
 * the persisted record and skip their required-field validation.
 */
export const collectFieldsInHiddenGroups = (
  form: Readonly<FormGroupsShape>,
  values: Readonly<Record<string, FieldValue>>
): ReadonlySet<string> => {
  const hidden = getDeclaredGroups(form).filter((group) => !isGroupVisible(group, values))
  return new Set<string>(hidden.flatMap((group) => Array.from(group.fields)))
}
