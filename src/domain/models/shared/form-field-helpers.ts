/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared form-field helpers consumed by the submit pipeline AND the multi-
 * step advance-endpoint validation pass. Both call sites need:
 *
 *   - `fieldSubmitIdentifier(field)` — column for table-bound, name for
 *     standalone / signature; undefined for sections / calculations.
 *   - `isAbsentValue(value)` — submitter-supplied value counts as missing
 *     for required-field checks (undefined / null / empty string / empty
 *     array).
 *   - `toFieldValue(value)` — coerce a submitter-supplied value into the
 *     loose `FieldValue` shape consumed by `evaluateVisibleWhen` so
 *     condition rules see strings/numbers/booleans/arrays uniformly.
 *   - `buildConditionValueMap(form, body)` — map of submitter-facing
 *     identifier → coerced value for every field in the form. Backs every
 *     `evaluateVisibleWhen` call in the submit pipeline AND the per-step
 *     validation pass.
 *   - `isFieldVisible(field, values)` — apply `field.visibleWhen` against
 *     a value record. Always-visible when no rule.
 *   - `isFieldRequired(field, values)` — apply `field.requiredWhen` (wins
 *     over `required: true`) against a value record. APP-FORMS-029.
 *
 * Lives in `domain-model-shared` so both `application-use-case` (submit
 * orchestration) and `presentation-api-route` (advance handler) can import
 * it without a layer-boundary violation. Defined locally so this module
 * stays free of `domain-model-feature` imports — same pattern used by
 * `multi-step-flow.ts` and `forms-validation.ts`.
 *
 * The structural shapes mirror the schema types in
 * `domain/models/app/forms/fields/`. Callers pass concrete `Form`
 * fields directly; TypeScript's structural typing accepts the wider
 * schema type because every concrete field already carries the
 * structural superset declared here.
 */

import { evaluateVisibleWhen, type FieldValue } from './visible-when-evaluator'
import type { VisibleWhenCondition } from './visible-when'

/**
 * Structural form-field shape. Mirrors the discriminated `FormFieldSchema`
 * union (`table-field` | `standalone` | `signature` | `calculation` |
 * `section`) but kept structural so this module stays in
 * `domain-model-shared`.
 */
export interface FormFieldHelperShape {
  readonly kind: 'table-field' | 'standalone' | 'signature' | 'calculation' | 'section'
  readonly column?: string
  readonly name?: string
  readonly required?: boolean
  readonly visibleWhen?: VisibleWhenCondition
  readonly requiredWhen?: VisibleWhenCondition
}

/**
 * Structural form shape used by `buildConditionValueMap`. Only `fields[]`
 * is read; the wider schema type is accepted via structural compatibility.
 */
export interface FormFieldsShape {
  readonly fields: ReadonlyArray<FormFieldHelperShape>
}

/**
 * Resolve the submitter-facing identifier for a form field. Mirrors the
 * helper used by the submit pipeline (`column` for table-bound, `name`
 * for standalone / signature). Sections have no input. Calculations
 * carry a `name` but their value is computed server-side and is never
 * present on the submitted body, so they too fall through to `undefined`
 * for the submit pipeline (required-checks, default overlays,
 * visibility-rule value lookup, hidden-field stripping).
 *
 * NOTE: this differs from the cross-validation `fieldIdentifier` in
 * `forms-validation.ts`, which DOES treat calculations as having an
 * identifier (for name-uniqueness). The two concerns are deliberately
 * distinct: validation cares about declaration collisions; the submit
 * pipeline cares about submitter-driven values.
 */
export const fieldSubmitIdentifier = (
  field: Readonly<FormFieldHelperShape>
): string | undefined => {
  if (field.kind === 'table-field') return field.column
  if (field.kind === 'standalone' || field.kind === 'signature') return field.name
  return undefined
}

/**
 * True when a body value is "absent enough" to count as missing for
 * required-field checks: undefined, null, empty string, empty array.
 */
export const isAbsentValue = (value: unknown): boolean => {
  if (value === undefined || value === null) return true
  if (typeof value === 'string' && value.trim() === '') return true
  if (Array.isArray(value) && value.length === 0) return true
  return false
}

/**
 * Coerce a body value into the loose `FieldValue` shape consumed by
 * `evaluateVisibleWhen`. Anything outside the supported scalar / array
 * shapes (e.g. multipart `File` instances) collapses to its string form
 * so equality-style operators remain meaningful even for exotic inputs.
 */
export const toFieldValue = (value: unknown): FieldValue => {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'string') return value
  if (typeof value === 'number') return value
  if (typeof value === 'boolean') return value
  if (Array.isArray(value)) {
    return value.map((entry) =>
      typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean'
        ? entry
        : String(entry)
    )
  }
  return String(value)
}

/**
 * Build the value record consumed by `evaluateVisibleWhen`. Keys are
 * submitter-facing identifiers (column for table-bound, name for
 * standalone / signature) so condition rules — which always reference
 * fields by their identifier — line up with the body.
 */
export const buildConditionValueMap = (
  form: Readonly<FormFieldsShape>,
  body: Readonly<Record<string, unknown>>
): Record<string, FieldValue> =>
  form.fields.reduce<Record<string, FieldValue>>((acc, field) => {
    const identifier = fieldSubmitIdentifier(field)
    if (identifier === undefined) return acc
    if (!(identifier in body)) return acc
    return { ...acc, [identifier]: toFieldValue(body[identifier]) }
  }, {})

/**
 * Evaluate a single field's `visibleWhen` rule against the supplied
 * value record. Returns `true` when the field has no rule (always
 * visible) OR when the rule evaluates true. Conditional-logic spec
 * (APP-FORMS-026 / -028 / -031 / -035) keys off this helper.
 */
export const isFieldVisible = (
  field: Readonly<FormFieldHelperShape>,
  values: Readonly<Record<string, FieldValue>>
): boolean => {
  if (field.visibleWhen === undefined) return true
  return evaluateVisibleWhen(field.visibleWhen, values)
}

/**
 * APP-FORMS-029: evaluate whether a field is required for THIS submission:
 *   - `required: true` always counts (legacy unconditional behaviour) UNLESS
 *     `requiredWhen` is also set — the conditional rule always wins.
 *   - `requiredWhen` flips the field into required when its rule evaluates
 *     true; otherwise the field is optional even if `required: true` was
 *     also set, as documented in
 *     `docs/user-stories/as-developer/forms/conditional-logic.md`.
 */
export const isFieldRequired = (
  field: Readonly<FormFieldHelperShape>,
  values: Readonly<Record<string, FieldValue>>
): boolean => {
  if (field.requiredWhen !== undefined) return evaluateVisibleWhen(field.requiredWhen, values)
  return field.required === true
}
