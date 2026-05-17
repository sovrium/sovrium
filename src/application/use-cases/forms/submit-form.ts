/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { FormSubmissionRepository } from '@/application/ports/repositories/form-submission-repository'
import { buildGuestSession } from '@/application/use-cases/automations/build-guest-session'
import { triggerFormSubmissionAutomations } from '@/application/use-cases/automations/trigger-form-submission'
import { createRecordProgram } from '@/application/use-cases/tables/programs'
import {
  buildConditionValueMap,
  fieldSubmitIdentifier,
  isAbsentValue,
  isFieldRequired,
  isFieldVisible,
} from '@/domain/models/shared/form-field-helpers'
import { collectFieldsInSkippedSteps } from '@/domain/models/shared/multi-step-flow'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'

/**
 * Form not found in the running app's `forms[]` array.
 */
export class FormNotFoundError extends Data.TaggedError('FormNotFoundError')<{
  readonly formName: string
}> {}

/**
 * Form-level required-field check failed (`fields[].required: true` set
 * by the form author, independent of whether the bound table column is
 * required). Surfaces as 400 in the route layer with the same
 * `fieldErrors` envelope used for column-level rejections so client UIs
 * can show a single inline error per field.
 */
export class FormFieldRequiredError extends Data.TaggedError('FormFieldRequiredError')<{
  readonly fieldName: string
  readonly message: string
}> {}

/**
 * Result returned to the API layer after a successful submission.
 *
 * `submissionId` is `null` when the form opts out of the ledger via
 * `submitTo.storeSubmission: false` — matches the trigger envelope shape
 * exposed to action handlers (`{{trigger.data.submissionId}}` resolves to
 * the same null when the ledger is disabled).
 */
export interface SubmitFormResult {
  readonly submissionId: string | null
  readonly linkedRecordId: string | null
}

/**
 * Locate a form definition in the validated `app.forms[]` array by name.
 */
export const findFormByName = (app: Readonly<App>, name: string): Form | undefined =>
  app.forms?.find((form) => form.name === name)

/**
 * Form-level required-field validation. Walks `form.fields[]` and rejects
 * the submission when any field flagged `required: true` (or activated by
 * `requiredWhen`) is missing, empty-string, an empty array, or `null`.
 *
 * Hidden-by-condition fields are excluded from the check (APP-FORMS-031):
 * a `required: true` field that is hidden by `visibleWhen` does not block
 * submission because the submitter can't fill it in.
 *
 * Runs BEFORE the bound-table write so attachment-required forms surface
 * a single 400 instead of a confusing column-level error chain.
 */
const checkFormRequiredFields = (
  form: Readonly<Form>,
  body: Readonly<Record<string, unknown>>
): Effect.Effect<void, FormFieldRequiredError, never> => {
  const values = buildConditionValueMap(form, body)
  const offending = form.fields.find((field) => {
    const identifier = fieldSubmitIdentifier(field)
    if (identifier === undefined) return false
    if (!isFieldVisible(field, values)) return false
    if (!isFieldRequired(field, values)) return false
    if (!(identifier in body)) return true
    return isAbsentValue(body[identifier])
  })
  if (offending === undefined) return Effect.void
  const fieldName = fieldSubmitIdentifier(offending) ?? 'field'
  return Effect.fail(
    new FormFieldRequiredError({
      fieldName,
      message: `${fieldName} is required`,
    })
  )
}

/**
 * APP-FORMS-026 / APP-FORMS-035: drop body entries whose owning field is
 * hidden by `visibleWhen`. Runs against the submitter-supplied body so a
 * hidden field never leaks into the bound-table write OR into the
 * submission ledger, regardless of whether the submitter intentionally
 * supplied a value or whether a `defaultValue` would otherwise overlay one.
 */
const stripHiddenFields = (
  form: Readonly<Form>,
  body: Readonly<Record<string, unknown>>
): Record<string, unknown> => {
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
 * APP-FORMS-042: drop body entries belonging to a step whose
 * `visibleWhen` evaluates false. The whole step is treated as if it did
 * not exist — its fields are not validated AND their values do not land
 * in the bound table or the submission ledger, even if the submitter
 * (or a stale draft) supplied them.
 *
 * No-op when the form has no `steps[]` configured.
 */
const stripSkippedStepFields = (
  form: Readonly<Form>,
  body: Readonly<Record<string, unknown>>
): Record<string, unknown> => {
  if (form.steps === undefined || form.steps.length === 0) return { ...body }
  const values = buildConditionValueMap(form, body)
  const skipped = collectFieldsInSkippedSteps(form, values)
  if (skipped.size === 0) return { ...body }
  return Object.fromEntries(Object.entries(body).filter(([key]) => !skipped.has(key)))
}

/**
 * Apply `submitTo.mapping` (form-field -> column rename) to the data payload.
 * When no mapping is configured, returns the payload unchanged (identity).
 */
const applyMapping = (
  data: Readonly<Record<string, unknown>>,
  mapping: Readonly<Record<string, string>> | undefined
): Record<string, unknown> => {
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
 * APP-FORMS-035: fields that are hidden by `visibleWhen` (evaluated against
 * the incoming body, NOT against accumulated defaults) are skipped entirely
 * — the field's `defaultValue` MUST NOT leak into the persisted record when
 * the submitter's branch keeps the field hidden. `visibleWhen` wins over
 * `defaultValue`.
 */
const applyFieldDefaults = (
  data: Readonly<Record<string, unknown>>,
  form: Readonly<Form>,
  query: Readonly<Record<string, string>>
): Record<string, unknown> => {
  const visibilityValues = buildConditionValueMap(form, data)
  return form.fields.reduce<Record<string, unknown>>(
    (acc, field) => {
      const identifier = fieldSubmitIdentifier(field)
      if (identifier === undefined) return acc
      if (!('defaultValue' in field) || field.defaultValue === undefined) return acc
      // APP-FORMS-035: visibleWhen short-circuits the overlay.
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
const filterDeclaredFields = (
  data: Readonly<Record<string, unknown>>,
  form: Readonly<Form>
): Record<string, unknown> => {
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
const filterTableBoundFields = (
  data: Readonly<Record<string, unknown>>,
  form: Readonly<Form>
): Record<string, unknown> => {
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

interface SubmitFormConfig {
  readonly app: Readonly<App>
  readonly formName: string
  readonly body: Readonly<Record<string, unknown>>
  readonly ipAddress?: string
  readonly userAgent?: string
  /**
   * Query-string parameters captured at the route boundary. Used to resolve
   * `$query.{name}` references in form-field `defaultValue` declarations
   * (e.g. `defaultValue: '$query.utm_source'` captures the UTM tag at
   * submission time).
   */
  readonly query?: Readonly<Record<string, string>>
  /**
   * Process env captured at the route boundary. Threaded through to the
   * form-trigger dispatcher so action handlers can resolve `$env.VAR_NAME`
   * references and so secrets get redacted from run-history. Mirrors the
   * pattern used by record-event / webhook / cron triggers.
   */
  readonly processEnv?: Readonly<Record<string, string | undefined>>
}

/**
 * Coerce the freshly-created table record's `id` (which the create
 * program returns as either a number or a string) into a string suitable
 * for storing in the ledger's `linked_record_id` text column.
 */
const coerceLinkedRecordId = (
  linkedRecord: { readonly id: unknown } | undefined
): string | undefined => {
  if (!linkedRecord) return undefined
  const { id } = linkedRecord
  if (typeof id === 'number') return String(id)
  if (typeof id === 'string') return id
  return undefined
}

/**
 * Submit-form orchestration program.
 *
 * Flow:
 *   1. Resolve the form from `app.forms[]` (404 when missing).
 *   2. Apply `submitTo.mapping` and field-declaration filter to the body.
 *   3. When `submitTo.table` is configured, write the row via the
 *      table-create program (validation + permissions + persistence).
 *   4. Unless `submitTo.storeSubmission: false`, write the ledger row in
 *      `system.form_submissions` so the submission appears in the admin
 *      Responses view.
 *   5. Return `{ submissionId, linkedRecordId }` to the API layer.
 *
 * When `storeSubmission` is disabled and the form has no table, the
 * submission is still treated as accepted but `submissionId` is empty
 * — the caller decides how to communicate that to the client.
 */
/**
 * Optionally write the audit ledger row in `system.form_submissions`.
 * Returns the submission id when written, undefined when the form opts
 * out via `storeSubmission: false`.
 */
const writeLedgerRow = (input: {
  readonly form: Readonly<Form>
  readonly mapped: Readonly<Record<string, unknown>>
  readonly linkedRecordId: string | undefined
  readonly ipAddress: string | undefined
  readonly userAgent: string | undefined
}) =>
  Effect.gen(function* () {
    const { form, mapped, linkedRecordId, ipAddress, userAgent } = input
    if (form.submitTo.storeSubmission === false) return undefined
    const repo = yield* FormSubmissionRepository
    const ledger = yield* repo.createTopLevel({
      formName: form.name,
      formId: form.id,
      status: 'received',
      data: mapped,
      ...(form.submitTo.table !== undefined ? { linkedRecordTable: form.submitTo.table } : {}),
      ...(linkedRecordId !== undefined ? { linkedRecordId } : {}),
      ...(ipAddress !== undefined ? { ipAddress } : {}),
      ...(userAgent !== undefined ? { userAgent } : {}),
    })
    return ledger.id
  })

/**
 * Build the `linkedRecord` envelope shape consumed by the form trigger.
 * Returns null when no `submitTo.table` is configured (so action templates
 * can null-check against `{{trigger.data.linkedRecord}}`).
 */
const buildLinkedRecord = (
  form: Readonly<Form>,
  linkedRecordPresent: boolean,
  linkedRecordId: string | undefined
): { readonly table: string; readonly id: string } | null => {
  if (!linkedRecordPresent || form.submitTo.table === undefined) {
    // eslint-disable-next-line unicorn/no-null -- public template contract
    return null
  }
  return { table: form.submitTo.table, id: linkedRecordId ?? '' }
}

export const submitFormProgram = (config: Readonly<SubmitFormConfig>) =>
  Effect.gen(function* () {
    const { app, formName, body, ipAddress, userAgent, processEnv, query } = config
    const form = findFormByName(app, formName)
    if (form === undefined) {
      return yield* new FormNotFoundError({ formName })
    }

    // Overlay field defaults (literals + `$query.X` / `$now` references)
    // BEFORE filterDeclaredFields so identifiers introduced solely by
    // defaultValue (hidden fields the submitter never sees) survive the
    // declared-fields filter. The mapping rename is then applied last so
    // form-field name → table-column rename still works.
    const withDefaults = applyFieldDefaults(body, form, query ?? {})

    // APP-FORMS-026 / -028 / -035: drop any value belonging to a field
    // whose `visibleWhen` evaluates false. Runs AFTER defaults so a
    // submitter-supplied value AND a literal default both vanish when the
    // submitter's branch keeps the field hidden.
    const fieldVisibilityFiltered = stripHiddenFields(form, withDefaults)

    // APP-FORMS-042: drop values belonging to multi-step steps whose
    // `visibleWhen` evaluates false. Runs alongside the per-field
    // visibility filter so a step-skipped field does not leak through the
    // submission pipeline even when the field itself has no per-field
    // `visibleWhen` rule.
    const visibilityFiltered = stripSkippedStepFields(form, fieldVisibilityFiltered)

    // F-11 / required-attachment semantics + APP-FORMS-029 / -031: enforce
    // form-level `required: true` (and `requiredWhen`-active rules) BEFORE
    // handing off to the bound-table write so missing attachments and
    // missing conditional-required fields surface a focused 400 rather
    // than a generic column-level rejection. Hidden-by-condition fields
    // are skipped (APP-FORMS-031). The check runs against the
    // visibility-filtered body so the same rule applies to required
    // checks and to default-overlay logic.
    yield* checkFormRequiredFields(form, visibilityFiltered)

    const mapped = applyMapping(
      filterDeclaredFields(visibilityFiltered, form),
      form.submitTo.mapping
    )

    // Step 1: write to bound table when configured. Strip standalone /
    // signature fields that have no `mapping` target — those live only in
    // the submission ledger and would cause the table insert to fail.
    const linkedRecord =
      form.submitTo.table !== undefined
        ? yield* createRecordProgram({
            session: buildGuestSession(),
            tableName: form.submitTo.table,
            fields: filterTableBoundFields(mapped, form),
          })
        : undefined

    const linkedRecordId = coerceLinkedRecordId(linkedRecord)

    // Step 2: write the ledger row unless explicitly disabled.
    const submissionId = yield* writeLedgerRow({
      form,
      mapped,
      linkedRecordId,
      ipAddress,
      userAgent,
    })

    // Step 3: fire form-triggered automations. The trigger fires AFTER the
    // bound `submitTo.table` row commits AND AFTER the ledger row commits
    // so action templates that reference `{{trigger.data.linkedRecord.id}}`
    // see a committed row. Errors are absorbed inside the use case so a
    // failing automation never rolls back the submission writes.
    yield* triggerFormSubmissionAutomations({
      app,
      formName: form.name,
      submissionData: mapped,
      // eslint-disable-next-line unicorn/no-null -- public template contract: submissionId is null when storeSubmission is false
      submissionId: submissionId ?? null,
      formId: form.id,
      linkedRecord: buildLinkedRecord(form, linkedRecord !== undefined, linkedRecordId),
      processEnv: processEnv ?? {},
    })

    return {
      // eslint-disable-next-line unicorn/no-null -- public contract: null when `storeSubmission: false`
      submissionId: submissionId ?? null,
      // eslint-disable-next-line unicorn/no-null -- public contract: nullable
      linkedRecordId: linkedRecordId ?? null,
    } satisfies SubmitFormResult
  })
