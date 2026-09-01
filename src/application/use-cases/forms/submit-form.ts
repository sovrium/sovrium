/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable max-lines -- submit-form orchestrates the full form-submission pipeline (validate → honeypot → rate-limit → coerce → persist → emit analytics → trigger automations). F-04 added the analytics emit call (+18 lines), pushing past 400. Splitting per-step would force multiple passes over the same form/record state. */

import { Data, Effect } from 'effect'
import { FormSubmissionRepository } from '@/application/ports/repositories/forms/form-submission-repository'
import {
  buildGuestSession,
  buildSyntheticSession,
} from '@/application/use-cases/automations/build-guest-session'
import { triggerFormSubmissionAutomations } from '@/application/use-cases/automations/trigger-form-submission'
import { triggerRecordEventAutomations } from '@/application/use-cases/automations/trigger-record-event'
import { coerceScalarsForArrayColumns } from '@/application/use-cases/forms/coerce-array-columns'
import { coerceEmptySelectToNull } from '@/application/use-cases/forms/coerce-empty-select'
import { emitFormSubmissionAnalyticsEvent } from '@/application/use-cases/forms/emit-form-analytics-event'
import {
  FormFieldFormatError,
  validateFieldFormats,
} from '@/application/use-cases/forms/submit-form-format-validation'
import { checkHoneypot } from '@/application/use-cases/forms/submit-form-honeypot'
import { checkRateLimit } from '@/application/use-cases/forms/submit-form-rate-limit'
import { createRecordProgram } from '@/application/use-cases/tables/programs'
import { collectFieldsInHiddenGroups } from '@/domain/models/shared/field-groups-flow'
import { evaluateAvailabilityWindow } from '@/domain/models/shared/form-availability-flow'
import {
  buildConditionValueMap,
  fieldSubmitIdentifier,
  isAbsentValue,
  isFieldRequired,
  isFieldVisible,
} from '@/domain/models/shared/form-field-helpers'
import { collectFieldsInSkippedSteps } from '@/domain/models/shared/multi-step-flow'
import { buildCreateAuthorshipOverrides } from '@/domain/services/authorship-fields'
import type { FormSubmitterMeta } from '@/application/use-cases/automations/trigger-form-submission'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'

/**
 * Statuses that count toward `availability.maxSubmissions`. Spam-flagged
 * (`spam`) and failed (`failed`) submissions never consume a cap slot — only
 * "real" submissions in the `received → processing → done` lifecycle do.
 */
const CAP_COUNTED_STATUSES = ['received', 'processing', 'done'] as const

// Re-export so the route layer keeps a single import surface for all
// submit-form failure types (honeypot + rate-limit rejections live in their
// own modules to keep this file under the max-lines cap).
export { FormHoneypotTrippedError } from '@/application/use-cases/forms/submit-form-honeypot'
export { FormRateLimitedError } from '@/application/use-cases/forms/submit-form-rate-limit'

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

// FormFieldFormatError + validateFieldFormats moved to submit-form-format-validation.ts
// (Bug 5 / [internal ref]). Re-exported so existing callers
// (presentation/api/routes/forms.ts) keep their import surface stable.
export { FormFieldFormatError }

/**
 * Form field write violated a foreign-key constraint (typically a `user`-typed
 * column that auto-FKs to `auth_user.id` receiving a string that is not a real
 * user id). Surfaces as 400 with `fieldErrors` so the form-renderer can show
 * an inline error against the offending field instead of the previous opaque
 * 422 `{error:'submission_invalid', message:'Failed to create record in X'}`.
 *
 * Bug 3 (sovrium-partner repro / [internal ref]).
 */
export class FormFieldForeignKeyError extends Data.TaggedError('FormFieldForeignKeyError')<{
  readonly fieldName: string
  readonly message: string
}> {}

/**
 * Submission rejected because the form is not yet open (`availability.opensAt`
 * is in the future). Surfaces as 403 `{ error: 'form not yet open', opensAt }`.
 */
export class FormNotYetOpenError extends Data.TaggedError('FormNotYetOpenError')<{
  readonly opensAt: string
}> {}

/**
 * Submission rejected because the form has closed (`availability.closesAt` is
 * in the past). Surfaces as 403 `{ error: 'form closed', closedAt }`.
 */
export class FormClosedError extends Data.TaggedError('FormClosedError')<{
  readonly closedAt: string
}> {}

/**
 * Submission rejected because the form reached its `availability.maxSubmissions`
 * cap. Surfaces as 403 `{ error: 'submission limit reached', maxSubmissions,
 * currentCount }`.
 */
export class FormSubmissionLimitError extends Data.TaggedError('FormSubmissionLimitError')<{
  readonly maxSubmissions: number
  readonly currentCount: number
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
  /**
   * The submitter-supplied bound-table column values of the created row, keyed
   * by column name. Powers `$record.<column>` interpolation in
   * `onSuccess.redirect.url`.
   *
   * SECURITY: this carries ONLY the columns the submitter actually provided
   * through the form (via {@link filterTableBoundFields} over `mapped`) — never
   * server-computed / privileged columns (authorship, id, timestamps are added
   * downstream in the bound-table write and never appear here), so a redirect
   * URL can never leak a value the submitter didn't already supply. Empty for
   * table-less (`storeSubmission`-only) forms.
   */
  readonly record: Readonly<Record<string, unknown>>
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
 * Hidden-by-condition fields are excluded from the check:
 * a `required: true` field that is hidden by `visibleWhen` does not block
 * submission because the submitter can't fill it in.
 *
 * Runs BEFORE the bound-table write so attachment-required forms surface
 * a single 400 instead of a confusing column-level error chain.
 */
const checkFormRequiredFields = (
  form: Readonly<Form>,
  body: Readonly<Record<string, unknown>>,
  hiddenGroupFields: ReadonlySet<string>
): Effect.Effect<void, FormFieldRequiredError, never> => {
  const values = buildConditionValueMap(form, body)
  const offending = form.fields.find((field) => {
    const identifier = fieldSubmitIdentifier(field)
    if (identifier === undefined) return false
    // [internal ref]: a required field inside a hidden fieldGroup is skipped.
    if (hiddenGroupFields.has(identifier)) return false
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
 * [internal ref]: drop body entries whose owning field is
 * hidden by `visibleWhen`. Runs against the submitter-supplied body so a
 * hidden field never leaks into the bound-table write OR into the
 * submission ledger, regardless of whether the submitter intentionally
 * supplied a value or whether a `defaultValue` would otherwise overlay one.
 */
const stripHiddenFields = (
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
const stripSkippedStepFields = (
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
const hiddenGroupFieldSet = (
  form: Readonly<Form>,
  body: Readonly<Record<string, unknown>>
): ReadonlySet<string> => {
  if (form.fieldGroups === undefined || form.fieldGroups.length === 0) return new Set<string>()
  const values = buildConditionValueMap(form, body)
  return collectFieldsInHiddenGroups(form, values)
}

const stripHiddenGroupFields = (
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
const applyMapping = (
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
const applyFieldDefaults = (
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
const filterDeclaredFields = (
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
const filterTableBoundFields = (
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

interface SubmitFormConfig {
  readonly app: Readonly<App>
  readonly formName: string
  readonly body: Readonly<Record<string, unknown>>
  /**
   * SHA-256(`FORM_IP_HASH_SALT` + raw IP) computed at the route boundary.
   * The application + persistence layers NEVER see the raw IP — [internal ref]
   * + S5 GDPR-erasure require hash-on-write. The hash also keys the
   * in-process rate-limiter's per-IP bucket.
   */
  readonly submitterIpHash?: string
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
  /**
   * Authenticated submitter id, captured by the route from the resolved
   * session. Stored on the ledger row's `submitter_user_id` column
   *. Absent for anonymous submissions.
   */
  readonly submitterUserId?: string
}

/**
 * Assemble the submitter context that form-triggered automations read at
 * `{{trigger.data.meta.<member>}}`. Absent members collapse to the empty
 * string so a template reference never renders an unresolved literal.
 *
 * `submitterIpHash` is passed through as the digest the route boundary
 * computed — the raw address is not available at this layer, and must not be
 * (see `SubmitFormConfig.submitterIpHash`): `trigger.data` is forwarded
 * verbatim by the email / http / code actions and retained in run history.
 */
const buildSubmitterMeta = (config: Readonly<SubmitFormConfig>): FormSubmitterMeta => ({
  submittedAt: new Date().toISOString(),
  submitterUserId: config.submitterUserId ?? '',
  submitterUserAgent: config.userAgent ?? '',
  submitterIpHash: config.submitterIpHash ?? '',
})

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
  readonly submitterIpHash: string | undefined
  readonly userAgent: string | undefined
  readonly submitterUserId: string | undefined
}) =>
  Effect.gen(function* () {
    const { form, mapped, linkedRecordId, submitterIpHash, userAgent, submitterUserId } = input
    if (form.submitTo.storeSubmission === false) return undefined
    const repo = yield* FormSubmissionRepository
    const ledger = yield* repo.createTopLevel({
      formName: form.name,
      formId: form.id,
      status: 'received',
      data: mapped,
      ...(form.submitTo.table !== undefined ? { linkedRecordTable: form.submitTo.table } : {}),
      ...(linkedRecordId !== undefined ? { linkedRecordId } : {}),
      ...(submitterIpHash !== undefined ? { submitterIpHash } : {}),
      ...(userAgent !== undefined ? { userAgent } : {}),
      ...(submitterUserId !== undefined ? { submitterUserId } : {}),
    })
    return ledger.id
  })

/**
 * Atomically reserve a cap slot in the ledger. Returns the ledger row id on
 * success, or fails with {@link FormSubmissionLimitError} when the cap is
 * already reached. Used in place of {@link writeLedgerRow} when the form
 * declares `availability.maxSubmissions`.
 *
 * The bound-table write happens AFTER the slot is reserved so a successful
 * reservation owns exactly one ledger row; a failed reservation never writes
 * the bound table (so `received|processing|done` rows never exceed the cap).
 */
const reserveLedgerSlot = (input: {
  readonly form: Readonly<Form>
  readonly mapped: Readonly<Record<string, unknown>>
  readonly maxSubmissions: number
  readonly submitterIpHash: string | undefined
  readonly userAgent: string | undefined
  readonly submitterUserId: string | undefined
}) =>
  Effect.gen(function* () {
    const { form, mapped, maxSubmissions, submitterIpHash, userAgent, submitterUserId } = input
    const repo = yield* FormSubmissionRepository
    const reserved = yield* repo.reserveTopLevelSlot({
      formName: form.name,
      formId: form.id,
      status: 'received',
      data: mapped,
      maxSubmissions,
      countStatuses: CAP_COUNTED_STATUSES,
      ...(form.submitTo.table !== undefined ? { linkedRecordTable: form.submitTo.table } : {}),
      ...(submitterIpHash !== undefined ? { submitterIpHash } : {}),
      ...(userAgent !== undefined ? { userAgent } : {}),
      ...(submitterUserId !== undefined ? { submitterUserId } : {}),
    })
    if (reserved === undefined) {
      const currentCount = yield* repo.countByFormNameAndStatus({
        formName: form.name,
        statuses: CAP_COUNTED_STATUSES,
      })
      return yield* new FormSubmissionLimitError({ maxSubmissions, currentCount })
    }
    return reserved.id
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

/**
 * [internal ref]: enforce the opensAt / closesAt window. Fails with
 * the matching availability error when the form is outside its window;
 * succeeds (void) when the form is open or has no window configured. Runs
 * BEFORE any write so a rejected submission leaves the ledger untouched.
 */
const checkAvailabilityWindow = (
  form: Readonly<Form>
): Effect.Effect<void, FormNotYetOpenError | FormClosedError, never> => {
  const windowState = evaluateAvailabilityWindow(form.availability, Date.now())
  if (windowState.kind === 'not-yet-open') {
    return Effect.fail(new FormNotYetOpenError({ opensAt: windowState.opensAt }))
  }
  if (windowState.kind === 'closed') {
    return Effect.fail(new FormClosedError({ closedAt: windowState.closedAt }))
  }
  return Effect.void
}

// validateFieldFormats moved to submit-form-format-validation.ts (Bug 5 / [internal ref]).

/**
 * Run the body-processing pipeline: overlay defaults, drop hidden /
 * step-skipped / hidden-group field values, enforce form-level required
 * fields, then apply the `submitTo.mapping` rename. Returns the column-keyed
 * `mapped` payload ready for the bound-table write and ledger.
 *
 * Extracted from `submitFormProgram` so that orchestrator stays under the
 * per-function complexity / line caps. The ordering of the filters is
 * load-bearing — see the inline comments and the [internal ref]
 * / -138 specs.
 */
const processSubmissionBody = (
  app: Readonly<App>,
  form: Readonly<Form>,
  body: Readonly<Record<string, unknown>>,
  query: Readonly<Record<string, string>>
): Effect.Effect<Record<string, unknown>, FormFieldRequiredError | FormFieldFormatError, never> =>
  Effect.gen(function* () {
    // Overlay defaults (literals + `$query.X` / `$now`) BEFORE the
    // declared-fields filter so hidden-only identifiers survive. Mapping is
    // applied last so form-field name → table-column rename still works.
    const withDefaults = applyFieldDefaults(body, form, query)
    // [internal ref]: drop values for fields hidden by `visibleWhen`.
    const fieldVisibilityFiltered = stripHiddenFields(form, withDefaults)
    // [internal ref]: drop values for steps skipped by `visibleWhen`.
    const stepFiltered = stripSkippedStepFields(form, fieldVisibilityFiltered)
    // [internal ref]: drop values for hidden single-page fieldGroups.
    const hiddenGroupFields = hiddenGroupFieldSet(form, stepFiltered)
    const visibilityFiltered = stripHiddenGroupFields(stepFiltered, hiddenGroupFields)
    // [internal ref]: enforce form-level required fields before
    // any write so a missing field surfaces a focused 400.
    yield* checkFormRequiredFields(form, visibilityFiltered, hiddenGroupFields)
    // [internal ref] / Bug 5: server-side format validation (email, etc.)
    // before any DB write so garbage never lands in the bound table.
    yield* validateFieldFormats(app, form, visibilityFiltered)
    return applyMapping(filterDeclaredFields(visibilityFiltered, form), form.submitTo.mapping)
  })

/** Outcome of {@link persistSubmission}: the IDs needed by the trigger + result. */
interface PersistOutcome {
  readonly submissionId: string | undefined
  readonly linkedRecordPresent: boolean
  readonly linkedRecordId: string | undefined
}

/**
 * Persist a processed submission: reserve the cap slot (capped forms), write
 * the bound-table row (when `submitTo.table` is set), then write the ledger
 * row (skipped when the cap path already reserved it). Extracted from
 * `submitFormProgram` to keep the orchestrator under the complexity cap.
 */
/**
 * Write the bound-table row for a submission (when `submitTo.table` is set).
 *
 * Y-5 follow-up: native HTML `<select>` widgets always submit a scalar even
 * for `multi-select` columns (PostgreSQL `text[]`); the scalar values for
 * array-typed columns are coerced into single-element arrays so the SQL insert
 * receives the shape `buildInsertClauses` expects.
 *
 * Authorship: an authenticated submission is authored by the REAL submitter —
 * it writes with the submitter's session AND stamps every `created-by`-typed
 * column (the literal `created_by` AND any custom-named one, e.g. `author`) by
 * name (the infra injection only fills the literal columns). An anonymous
 * submission falls back to the guest session (authorship normalized to NULL).
 */
const writeBoundTableRecord = (input: {
  readonly app: Readonly<App>
  readonly form: Readonly<Form>
  readonly mapped: Readonly<Record<string, unknown>>
  readonly submitterUserId: string | undefined
}) =>
  Effect.gen(function* () {
    const { app, form, mapped, submitterUserId } = input
    if (form.submitTo.table === undefined) return undefined
    const tableName = form.submitTo.table
    return yield* createRecordProgram({
      // [internal ref]: pass `app` so `createRecordProgram` can resolve the bound
      // table's many-to-many fields and split them out of the base insert
      // (writing junction rows against the resolved id) instead of jsonb-encoding
      // them into a phantom base column. Without `app` the split is a no-op and a
      // form filing an m2m field (partner `requests.pains`) fails with
      // `column "pains" ... does not exist`, on plain AND view-backed tables.
      app,
      session:
        submitterUserId !== undefined
          ? buildSyntheticSession(submitterUserId)
          : buildGuestSession(),
      tableName,
      fields: {
        // Order matters: `''` becomes `null` FIRST, so the array coercion
        // below sees an absent value and passes it through rather than
        // wrapping it into `['']` — which the option CHECK constraint would
        // reject just as surely as the bare `''`.
        ...coerceScalarsForArrayColumns(
          coerceEmptySelectToNull(filterTableBoundFields(mapped, form), app, tableName),
          app,
          tableName
        ),
        ...(submitterUserId !== undefined
          ? buildCreateAuthorshipOverrides(app.tables, tableName, submitterUserId)
          : {}),
      },
    })
  })

const persistSubmission = (input: {
  readonly app: Readonly<App>
  readonly form: Readonly<Form>
  readonly mapped: Readonly<Record<string, unknown>>
  readonly submitterIpHash: string | undefined
  readonly userAgent: string | undefined
  readonly submitterUserId: string | undefined
}) =>
  Effect.gen(function* () {
    const { app, form, mapped, submitterIpHash, userAgent, submitterUserId } = input
    // [internal ref]: reserve the cap slot atomically BEFORE the
    // bound-table write so the counted-status ledger rows never exceed the
    // cap, even under concurrency. A failed reservation fails fast and never
    // touches the bound table.
    const cappedSubmissionId =
      form.availability?.maxSubmissions !== undefined
        ? yield* reserveLedgerSlot({
            form,
            mapped,
            maxSubmissions: form.availability.maxSubmissions,
            submitterIpHash,
            userAgent,
            submitterUserId,
          })
        : undefined

    const linkedRecord = yield* writeBoundTableRecord({ app, form, mapped, submitterUserId })
    const linkedRecordId = coerceLinkedRecordId(linkedRecord)

    // Capped forms already reserved their ledger row above; the standard
    // write is skipped to avoid a duplicate row.
    const submissionId =
      cappedSubmissionId ??
      (yield* writeLedgerRow({
        form,
        mapped,
        linkedRecordId,
        submitterIpHash,
        userAgent,
        submitterUserId,
      }))

    return {
      submissionId,
      linkedRecordPresent: linkedRecord !== undefined,
      linkedRecordId,
    } satisfies PersistOutcome
  })

/**
 * GAP-15: fire the bound table's `record`/`create` automations for a
 * form-created row, exactly like the direct records-API create path
 * (`record-write-handlers.ts` taps `triggerRecordEventAutomations`). The form
 * path bypasses that handler by calling `createRecordProgram` directly, so we
 * fire the same trigger here — AFTER the row commits, only when
 * `submitTo.table` produced a row. The created row's column-keyed fields are
 * surfaced under `{{trigger.data.record.X}}`. Errors are absorbed inside the
 * use case so a failing automation never rolls back the submission. No-op when
 * no bound-table row was written.
 */
const fireBoundTableRecordCreateAutomations = (input: {
  readonly app: Readonly<App>
  readonly form: Readonly<Form>
  readonly mapped: Readonly<Record<string, unknown>>
  readonly outcome: PersistOutcome
  readonly processEnv: Readonly<Record<string, string | undefined>>
  readonly submitterUserId: string | undefined
}) => {
  const { app, form, mapped, outcome, processEnv, submitterUserId } = input
  const { linkedRecordPresent, linkedRecordId } = outcome
  if (!linkedRecordPresent || form.submitTo.table === undefined || linkedRecordId === undefined) {
    return Effect.void
  }
  return triggerRecordEventAutomations({
    app,
    tableName: form.submitTo.table,
    event: 'create',
    record: { id: linkedRecordId, ...mapped },
    processEnv,
    ...(submitterUserId !== undefined ? { userId: submitterUserId } : {}),
  })
}

// eslint-disable-next-line max-lines-per-function -- single-pass form-submission generator: 8 sequential gates (validate / honeypot / rate-limit / availability / format-validate / coerce / persist / emit + trigger). Each step needs the prior step's resolved state. F-04 added the analytics emit call.
export const submitFormProgram = (config: Readonly<SubmitFormConfig>) =>
  // eslint-disable-next-line max-lines-per-function -- see comment on submitFormProgram
  Effect.gen(function* () {
    const { app, formName, body, submitterIpHash, userAgent, processEnv, query, submitterUserId } =
      config
    const form = findFormByName(app, formName)
    if (form === undefined) {
      return yield* new FormNotFoundError({ formName })
    }

    // Availability window gate — see checkAvailabilityWindow. The cap is
    // enforced atomically inside persistSubmission (see reserveLedgerSlot).
    yield* checkAvailabilityWindow(form)

    // Honeypot anti-spam gate — runs against the raw body BEFORE field
    // filtering (the `_hp` trap field is never declared on the form). A
    // tripped honeypot records a `spam` ledger row and rejects with 400 so
    // spam never reaches the bound-table write or the cap counter.
    yield* checkHoneypot({ form, body, submitterIpHash, userAgent })

    // Rate-limit gate — runs
    // AFTER the honeypot so a tripped honeypot doesn't also consume a
    // rate-limit slot. Per-IP-hash + per-form sliding windows; a hit writes
    // a spam ledger row tagged with the trip reason and fails with
    // FormRateLimitedError (mapped to HTTP 429 + Retry-After at the route).
    //
    // When the route boundary couldn't extract an IP (no XFF, no real-ip),
    // we fall back to an empty-string IP hashed against the same salt so
    // all "anonymous" traffic shares one bucket — see submit-form-rate-limit.
    yield* checkRateLimit({
      form,
      body,
      submitterIpHash: submitterIpHash ?? '',
      userAgent,
    })

    const mapped = yield* processSubmissionBody(app, form, body, query ?? {})

    // Bug 3 / [internal ref]: translate FK violations on the bound-table
    // write into a structured FormFieldForeignKeyError so the route layer
    // emits a 400 with `fieldErrors[]` instead of a generic 422. Mirrors the
    // FormFieldFormatError translation in `processSubmissionBody`.
    const { submissionId, linkedRecordPresent, linkedRecordId } = yield* persistSubmission({
      app,
      form,
      mapped,
      submitterIpHash,
      userAgent,
      submitterUserId,
    }).pipe(
      Effect.catchTag('ForeignKeyViolationError', (fk) => {
        const fieldName = fk.fieldName ?? ''
        const message = fk.fieldName
          ? `${fk.fieldName} references a record that does not exist`
          : 'references a record that does not exist'
        return Effect.fail(new FormFieldForeignKeyError({ fieldName, message }))
      })
    )

    // F-04: write the unified analytics_events row for
    // every successful submission. Three-layer gate (env / app / form);
    // emission failures are absorbed so a missing analytics row never
    // rolls back the committed submission.
    yield* emitFormSubmissionAnalyticsEvent({
      app,
      form,
      submissionId,
      submitterIpHash,
    })

    // GAP-15: fire the bound table's record/create automations for the
    // form-created row (no-op when no bound-table row was written). See
    // fireBoundTableRecordCreateAutomations.
    yield* fireBoundTableRecordCreateAutomations({
      app,
      form,
      mapped,
      outcome: { submissionId, linkedRecordPresent, linkedRecordId },
      processEnv: processEnv ?? {},
      submitterUserId,
    })

    // Fire form-triggered automations AFTER the bound-table + ledger rows
    // commit so action templates referencing `{{trigger.data.linkedRecord.id}}`
    // see a committed row. Errors are absorbed inside the use case so a
    // failing automation never rolls back the submission writes.
    yield* triggerFormSubmissionAutomations({
      app,
      formName: form.name,
      submissionData: mapped,
      // eslint-disable-next-line unicorn/no-null -- public template contract: submissionId is null when storeSubmission is false
      submissionId: submissionId ?? null,
      formId: form.id,
      linkedRecord: buildLinkedRecord(form, linkedRecordPresent, linkedRecordId),
      meta: buildSubmitterMeta(config),
      processEnv: processEnv ?? {},
      // The submitter is the run's actor: `runAs: 'triggering-user'` actions
      // and per-user OAuth2 token lookups resolve against it. Omitted for
      // anonymous submissions, which keep the system actor.
      ...(submitterUserId !== undefined ? { userId: submitterUserId } : {}),
    })

    return {
      // eslint-disable-next-line unicorn/no-null -- public contract: null when `storeSubmission: false`
      submissionId: submissionId ?? null,
      // eslint-disable-next-line unicorn/no-null -- public contract: nullable
      linkedRecordId: linkedRecordId ?? null,
      // [internal ref]: expose only the submitter-supplied bound-table columns
      // for `$record.<column>` redirect interpolation (see SubmitFormResult).
      record: filterTableBoundFields(mapped, form),
    } satisfies SubmitFormResult
  })
