/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { collectFieldsInHiddenGroups } from '@/domain/models/app/forms/field-groups-flow'
import {
  buildConditionValueMap,
  fieldSubmitIdentifier,
  isFieldVisible,
} from '@/domain/models/app/forms/form-field-helpers'
import { collectFieldsInSkippedSteps } from '@/domain/models/app/forms/multi-step-flow'
import type { Form } from '@/domain/models/app/forms'

/**
 * [internal ref]: drop body entries whose owning field is
 * hidden by `visibleWhen`. Runs against the submitter-supplied body so a
 * hidden field never leaks into the bound-table write OR into the
 * submission ledger, regardless of whether the submitter intentionally
 * supplied a value or whether a `defaultValue` would otherwise overlay one.
 */
export const stripHiddenFields = (
  form: Readonly<Form>,
  body: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> => {
  const values = buildConditionValueMap(form, body)
  const hiddenIdentifiers = new Set<string>(
    form.fields
      .filter((field) => !isFieldVisible(field, values))
      .map((field) => fieldSubmitIdentifier(field))
      .filter((id): id is string => id !== undefined)
  )
  if (hiddenIdentifiers.size === 0) return { ...body }
  return Object.fromEntries(Object.entries(body).filter(([key]) => !hiddenIdentifiers.has(key)))
}

/**
 * [internal ref]: drop body entries belonging to a step whose
 * `visibleWhen` evaluates false. The whole step is treated as if it did
 * not exist — its fields are not validated AND their values do not land
 * in the bound table or the submission ledger, even if the submitter
 * (or a stale draft) supplied them.
 *
 * No-op when the form has no `steps[]` configured.
 */
export const stripSkippedStepFields = (
  form: Readonly<Form>,
  body: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> => {
  if (form.steps === undefined || form.steps.length === 0) return { ...body }
  const values = buildConditionValueMap(form, body)
  const skipped = collectFieldsInSkippedSteps(form, values)
  if (skipped.size === 0) return { ...body }
  return Object.fromEntries(Object.entries(body).filter(([key]) => !skipped.has(key)))
}

/**
 * [internal ref]: identify the field identifiers belonging to a single-page
 * `fieldGroups[]` group whose `visibleWhen` evaluates false. The whole group
 * is treated as hidden — its fields are dropped from the persisted record and
 * excluded from required-field validation.
 *
 * Returns an empty set when the form declares no `fieldGroups[]`.
 */
export const hiddenGroupFieldSet = (
  form: Readonly<Form>,
  body: Readonly<Record<string, unknown>>
): ReadonlySet<string> => {
  if (form.fieldGroups === undefined || form.fieldGroups.length === 0) return new Set<string>()
  const values = buildConditionValueMap(form, body)
  return collectFieldsInHiddenGroups(form, values)
}

export const stripHiddenGroupFields = (
  body: Readonly<Record<string, unknown>>,
  hidden: ReadonlySet<string>
): Readonly<Record<string, unknown>> => {
  if (hidden.size === 0) return { ...body }
  return Object.fromEntries(Object.entries(body).filter(([key]) => !hidden.has(key)))
}

/**
 * Apply `submitTo.mapping` (form-field -> column rename) to the data payload.
 * When no mapping is configured, returns the payload unchanged (identity).
 */
export const applyMapping = (
  data: Readonly<Record<string, unknown>>,
  mapping: Readonly<Record<string, string>> | undefined
): Readonly<Record<string, unknown>> => {
  if (!mapping) return { ...data }
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [mapping[key] ?? key, value])
  )
}

/**
 * Resolve a form-field `defaultValue` against a request context. Supports:
 * - `$query.{name}` — URL search-string parameter (string-typed)
 * - `$now` — ISO-8601 timestamp captured at submit time
 * - any other literal value — passed through as-is
 *
 * Returns `undefined` when the reference cannot be resolved (e.g. the query
 * parameter was not supplied), so the caller can decide between "skip" and
 * "fall back to a literal default".
 *
 * TODO(phase-e): Phase E specs (`conditional-logic.spec.ts`,
 * `multi-step.spec.ts`) will need to evaluate `$query.X`, `$user.X`,
 * `$parent.X`, and `$now` references in *visibility* / *required* /
 * *goToWhen* expressions, not just defaults. When the second caller lands,
 * promote this helper to a sibling file (e.g. `resolve-form-references.ts`)
 * and broaden the input/output types beyond `string | number | boolean`.
 * Currently `$user.*` and `$parent.*` references fall through unresolved
 * because the submit context does not yet surface them.
 */
const resolveDefaultValue = (
  value: string | number | boolean,
  query: Readonly<Record<string, string>>
): string | number | boolean | undefined => {
  if (typeof value !== 'string') return value
  if (value === '$now') return new Date().toISOString()
  const queryMatch = /^\$query\.([a-zA-Z_][a-zA-Z0-9_]*)$/.exec(value)
  if (queryMatch) {
    const key = queryMatch[1]
    if (key === undefined) return undefined
    return query[key]
  }
  // `$user.*` and `$parent.*` — see TODO(phase-e) above.
  if (value.startsWith('$')) return undefined
  return value
}

/**
 * Compute the default-value overlay applied to the submission payload.
 * Hidden fields with a `defaultValue` are always overlaid (the submitter
 * cannot supply them via the rendered form). Visible fields with a default
 * are only overlaid when the submitter omitted the value entirely.
 *
 * [internal ref]: fields that are hidden by `visibleWhen` (evaluated against
 * the incoming body, NOT against accumulated defaults) are skipped entirely
 * — the field's `defaultValue` MUST NOT leak into the persisted record when
 * the submitter's branch keeps the field hidden. `visibleWhen` wins over
 * `defaultValue`.
 */
export const applyFieldDefaults = (
  data: Readonly<Record<string, unknown>>,
  form: Readonly<Form>,
  query: Readonly<Record<string, string>>
): Readonly<Record<string, unknown>> => {
  const visibilityValues = buildConditionValueMap(form, data)
  return form.fields.reduce<Record<string, unknown>>(
    (acc, field) => {
      const identifier = fieldSubmitIdentifier(field)
      if (identifier === undefined) return acc
      if (!('defaultValue' in field) || field.defaultValue === undefined) return acc
      // [internal ref]: visibleWhen short-circuits the overlay.
      if (!isFieldVisible(field, visibilityValues)) return acc
      const isHidden = (field as { readonly hidden?: boolean }).hidden === true
      const submitterSupplied = Object.hasOwn(acc, identifier) && acc[identifier] !== ''
      if (!isHidden && submitterSupplied) return acc
      const resolved = resolveDefaultValue(field.defaultValue, query)
      if (resolved === undefined) return acc
      return { ...acc, [identifier]: resolved }
    },
    { ...data }
  )
}

/**
 * Filter data to only include fields the form declares (by `column` for
 * table-field kind, by `name` for standalone kind). Hidden fields and
 * defaults are merged in by the caller before this filter is applied.
 *
 * Currently a permissive pass-through: the foundation tests rely on the
 * table layer to validate column constraints. Tightening this filter is
 * a downstream tier.
 */
export const filterDeclaredFields = (
  data: Readonly<Record<string, unknown>>,
  form: Readonly<Form>
): Readonly<Record<string, unknown>> => {
  const declared = new Set<string>(
    form.fields
      .map((field) => {
        if (field.kind === 'table-field') return field.column
        if (field.kind === 'standalone' || field.kind === 'signature') return field.name
        // Calculation/section have no submitter-driven name.
        return undefined
      })
      .filter((name): name is string => name !== undefined)
  )
  if (declared.size === 0) return { ...data }
  return Object.fromEntries(Object.entries(data).filter(([key]) => declared.has(key)))
}

/**
 * Filter data to only include fields that target columns on
 * `submitTo.table`. After `applyMapping`, the keys are column names, so a
 * standalone field renamed via `submitTo.mapping` (e.g. `userEmail →
 * email`) lands in the table just like a table-bound field. Standalone
 * and signature fields without a mapping target stay in the submission
 * ledger only and must be stripped before the table insert.
 *
 * TODO(forms-validation): mapping targets are not currently
 * cross-validated against the bound table's columns. A typo in
 * `submitTo.mapping` (e.g. `{ userEmail: 'emial' }`) flows through this
 * filter and crashes at the SQL layer rather than at app-load time. Add
 * a `validateSubmitToMappingTargets` rule to `forms-validation.ts` so
 * the typo is caught up-front.
 */
export const filterTableBoundFields = (
  data: Readonly<Record<string, unknown>>,
  form: Readonly<Form>
): Readonly<Record<string, unknown>> => {
  const tableColumns = new Set<string>(
    form.fields
      .filter((field) => field.kind === 'table-field')
      .map((field) => (field as { readonly column: string }).column)
  )
  // Mapping targets are also table columns by definition (mapping is
  // form-field-name → table-column rename). Include them so renamed
  // standalone fields participate in the insert.
  const mappingTargets = Object.values(form.submitTo.mapping ?? {})
  const writable = new Set<string>([...tableColumns, ...mappingTargets])
  return Object.fromEntries(Object.entries(data).filter(([key]) => writable.has(key)))
}
