/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  FormFieldFormatError,
  validateFieldFormats,
} from '@/application/use-cases/forms/submit-form-format-validation'
import { evaluateAvailabilityWindow } from '@/domain/models/app/forms/form-availability-flow'
import { recomputeSubmittedCalculations } from '@/domain/models/app/forms/form-calculation-service'
import {
  buildConditionValueMap,
  fieldSubmitIdentifier,
  isAbsentValue,
  isFieldRequired,
  isFieldVisible,
} from '@/domain/models/app/forms/form-field-helpers'
import { FormClosedError, FormFieldRequiredError, FormNotYetOpenError } from './submit-form-errors'
import {
  applyFieldDefaults,
  applyMapping,
  filterDeclaredFields,
  hiddenGroupFieldSet,
  stripHiddenFields,
  stripHiddenGroupFields,
  stripSkippedStepFields,
} from './submit-form-field-shaping'
import type { FormSubmitterMeta } from '@/application/use-cases/automations/trigger-form-submission'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'

/**
 * The submission body as the form accepts it: required fields checked, the
 * availability window enforced, linked records coerced, and the submitter
 * recorded beside the values.
 */

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
    // A required field inside a hidden fieldGroup is skipped.
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

export interface SubmitFormConfig {
  readonly app: Readonly<App>
  readonly formName: string
  readonly body: Readonly<Record<string, unknown>>
  /**
   * SHA-256(salt + raw IP) computed at the route boundary, over a salt derived
   * from the install's root secret and stable across restarts.
   * The application + persistence layers NEVER see the raw IP: S5 GDPR
   * erasure requires hash-on-write. The hash also keys the
   * in-process rate-limiter's per-IP bucket.
   */
  readonly submitterIpHash?: string
  /**
   * SHA-256(salt + rate-limit key): the same digest over the address as every
   * per-address limit counts it — an IPv6 client by its /64. Keys the
   * in-process rate-limiter's per-address bucket; never stored. Falls back to
   * `submitterIpHash` when absent.
   */
  readonly rateLimitKeyHash?: string
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
  /**
   * The signed-in submitter as the form's choices see them (`id`, `email`,
   * `role`), so a `$currentUser` option filter selects at submission exactly
   * the rows it offered on the page. Absent for anyone else.
   */
  readonly visitor?: Readonly<Record<string, unknown>>
  /** Digest of the edit-link token this submission is given (`editAfterSubmit`). */
  readonly editTokenHash?: string
  /** Digest of the resume-link token it was sent from; the draft is consumed. */
  readonly resumeTokenHash?: string
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
export const buildSubmitterMeta = (config: Readonly<SubmitFormConfig>): FormSubmitterMeta => ({
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
export const coerceLinkedRecordId = (
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
 * Build the `linkedRecord` envelope shape consumed by the form trigger.
 * Returns null when no `submitTo.table` is configured (so action templates
 * can null-check against `{{trigger.data.linkedRecord}}`).
 */
export const buildLinkedRecord = (
  form: Readonly<Form>,
  linkedRecordPresent: boolean,
  linkedRecordId: string | undefined
): { readonly table: string; readonly id: string } | null => {
  if (!linkedRecordPresent || form.submitTo.table === undefined) {
    return null
  }
  return { table: form.submitTo.table, id: linkedRecordId ?? '' }
}

/**
 * Enforce the opensAt / closesAt window. Fails with
 * the matching availability error when the form is outside its window;
 * succeeds (void) when the form is open or has no window configured. Runs
 * BEFORE any write so a rejected submission leaves the ledger untouched.
 */
export const checkAvailabilityWindow = (
  form: Readonly<Form>
): Effect.Effect<void, FormNotYetOpenError | FormClosedError, never> =>
  Effect.suspend((): Effect.Effect<void, FormNotYetOpenError | FormClosedError> => {
    const windowState = evaluateAvailabilityWindow(form.availability, Date.now())
    if (windowState.kind === 'not-yet-open') {
      return Effect.fail(new FormNotYetOpenError({ opensAt: windowState.opensAt }))
    }
    if (windowState.kind === 'closed') {
      return Effect.fail(new FormClosedError({ closedAt: windowState.closedAt }))
    }
    return Effect.void
  }).pipe(Effect.withSpan('forms.check-availability-window', { attributes: { form: form.name } }))

/**
 * Run the body-processing pipeline: overlay defaults, drop hidden /
 * step-skipped / hidden-group field values, enforce form-level required
 * fields, then apply the `submitTo.mapping` rename. Returns the column-keyed
 * `mapped` payload ready for the bound-table write and ledger.
 *
 * Extracted from `submitFormProgram` so that orchestrator stays under the
 * per-function complexity / line caps. The ordering of the filters is
 * load-bearing — see the inline comments.
 */
export const processSubmissionBody = (
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
    // Drop values for fields hidden by `visibleWhen`.
    const fieldVisibilityFiltered = stripHiddenFields(form, withDefaults)
    // Drop values for steps skipped by `visibleWhen`.
    const stepFiltered = stripSkippedStepFields(form, fieldVisibilityFiltered)
    // Drop values for hidden single-page fieldGroups.
    const hiddenGroupFields = hiddenGroupFieldSet(form, stepFiltered)
    const visibilityFiltered = stripHiddenGroupFields(stepFiltered, hiddenGroupFields)
    // Enforce form-level required fields before any write so a missing field surfaces a focused 400.
    yield* checkFormRequiredFields(form, visibilityFiltered, hiddenGroupFields)
    // Server-side format validation (email, etc.) before any DB write so garbage never lands in the bound table.
    yield* validateFieldFormats(app, form, visibilityFiltered)
    // Calculations are recomputed from the inputs in dependency order: an
    // omitted value is filled, a disagreeing one refused against its field.
    const calculated = recomputeSubmittedCalculations(form.fields, visibilityFiltered)
    if ('mismatch' in calculated) {
      return yield* new FormFieldFormatError({
        fieldName: calculated.mismatch,
        message: `${calculated.mismatch} does not agree with the value computed from the other answers`,
      })
    }
    return {
      ...applyMapping(filterDeclaredFields(visibilityFiltered, form), form.submitTo.mapping),
      ...calculated.values,
    }
  }).pipe(Effect.withSpan('forms.process-submission-body', { attributes: { form: form.name } }))
