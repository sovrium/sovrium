/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeFormFieldErrorClasses } from '@/presentation/design/form-layout-classes'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import type { FormFieldConfig } from '@/domain/models/app/pages/components/component-types/data/form'

/** Whether a field states a rule of its own (`required`, `minLength`, `maxLength`). */
export function hasRules(field: FormFieldConfig): boolean {
  return field.required === true || field.minLength !== undefined || field.maxLength !== undefined
}

/**
 * A field's own rules as the control's native attributes. The browser caps
 * typing at `maxlength` by itself; `required` and `minlength` are checked by
 * the endpoint runtime before it sends, which draws the reason under the field
 * (`islands/runtime/endpoint-form-validation.ts`).
 */
export function ruleProps(field: FormFieldConfig): Record<string, number | boolean> {
  return {
    ...(field.required === true && { required: true }),
    ...(field.minLength !== undefined && { minLength: field.minLength }),
    ...(field.maxLength !== undefined && { maxLength: field.maxLength }),
  }
}

/**
 * The form-level half of the rules: a form with a ruled field is `novalidate`,
 * so the endpoint runtime's own check (and its reason under the field) runs
 * instead of the browser's bubble, and carries the `error` part's classes for
 * the reasons that check draws. A form with no rule keeps its bytes.
 */
export function formRuleProps(
  fields: readonly FormFieldConfig[],
  errorPart: string | undefined
): Record<string, string | boolean> {
  if (!fields.some(hasRules)) return {}
  return {
    noValidate: true,
    'data-error-class': resolveClasses(computeFormFieldErrorClasses(), errorPart),
  }
}
