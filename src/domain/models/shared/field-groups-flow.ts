/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
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

export const getDeclaredGroups = (form: Readonly<FormGroupsShape>): ReadonlyArray<FormGroupShape> =>
  form.fieldGroups ?? []

export const isGroupVisible = (
  group: Readonly<FormGroupShape>,
  values: Readonly<Record<string, FieldValue>>
): boolean => {
  if (group.visibleWhen === undefined) return true
  return evaluateVisibleWhen(group.visibleWhen, values)
}

export const collectFieldsInHiddenGroups = (
  form: Readonly<FormGroupsShape>,
  values: Readonly<Record<string, FieldValue>>
): ReadonlySet<string> => {
  const hidden = getDeclaredGroups(form).filter((group) => !isGroupVisible(group, values))
  return new Set<string>(hidden.flatMap((group) => Array.from(group.fields)))
}
