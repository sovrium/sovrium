/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { triggerFormSubmissionAutomations } from '@/application/use-cases/automations/trigger-form-submission'
import { emitFormSubmissionAnalyticsEvent } from '@/application/use-cases/forms/emit-form-analytics-event'
import { applySubmissionAccessLinks } from '@/application/use-cases/forms/submit-form-access-links'
import {
  constraintRefusalForField,
  uniqueRefusalForField,
} from '@/application/use-cases/forms/submit-form-constraint-errors'
import { FormFieldFormatError } from '@/application/use-cases/forms/submit-form-format-validation'
import { findUnpinnedHiddenField } from '@/application/use-cases/forms/submit-form-hidden-pins'
import { checkHoneypot } from '@/application/use-cases/forms/submit-form-honeypot'
import { findUnofferedLinkField } from '@/application/use-cases/forms/submit-form-offered-links'
import { checkRateLimit } from '@/application/use-cases/forms/submit-form-rate-limit'
import { splitSubmissionSurface } from '@/domain/models/app/forms/submission-ledger-service'
import {
  buildLinkedRecord,
  buildSubmitterMeta,
  checkAvailabilityWindow,
  processSubmissionBody,
} from './submit-form-body'
import { FormNotFoundError, missingRowError, refuseAsMissingRow } from './submit-form-errors'
import { filterTableBoundFields } from './submit-form-field-shaping'
import { fireBoundTableRecordCreateAutomations, persistSubmission } from './submit-form-persist'
import type { SubmitFormConfig } from './submit-form-body'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'

// Re-export so the route layer keeps a single import surface for all
// submit-form failure types (honeypot + rate-limit rejections live in their
// own modules to keep this file under the max-lines cap).
export { FormHoneypotTrippedError } from '@/application/use-cases/forms/submit-form-honeypot'
export { FormRateLimitedError } from '@/application/use-cases/forms/submit-form-rate-limit'
export { FormSubmissionLimitError } from '@/application/use-cases/forms/submit-form-ledger'

// FormFieldFormatError + validateFieldFormats moved to submit-form-format-validation.ts
// ([internal ref] / a forms spec). Re-exported so existing callers
// (presentation/api/routes/forms.ts) keep their import surface stable.
export { FormFieldFormatError }
export { FormFieldConstraintError } from '@/application/use-cases/forms/submit-form-constraint-errors'
// The refusal types live in `submit-form-errors.ts`; re-exported for the same
// single import surface.
export {
  FormClosedError,
  FormFieldForeignKeyError,
  FormFieldRequiredError,
  FormNotFoundError,
  FormNotYetOpenError,
} from './submit-form-errors'

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

// eslint-disable-next-line max-lines-per-function -- single-pass form-submission generator: 8 sequential gates (validate / honeypot / rate-limit / availability / format-validate / coerce / persist / emit + trigger). Each step needs the prior step's resolved state. [internal ref] added the analytics emit call.
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
      rateLimitKeyHash: config.rateLimitKeyHash,
      userAgent,
    })

    // An embedded form marks its surface on the query; the rest is the form's.
    const { surface, query: formQuery } = splitSubmissionSurface(query ?? {})
    const mapped = yield* processSubmissionBody(app, form, body, formQuery)

    // A link must name a row the form offers, and a hidden link or account only
    // what the server would have put in it for this submitter — both answered
    // like a missing row.
    const links = { app, form, mapped, visitor: config.visitor, submitterUserId }
    yield* findUnofferedLinkField(links).pipe(Effect.flatMap(refuseAsMissingRow))
    yield* findUnpinnedHiddenField(links).pipe(Effect.flatMap(refuseAsMissingRow))

    // [internal ref] / a forms spec: translate FK violations on the bound-table
    // write into a structured FormFieldForeignKeyError so the route layer
    // emits a 400 with `fieldErrors[]` instead of a generic 422. Mirrors the
    // FormFieldFormatError translation in `processSubmissionBody`.
    const persisted = yield* persistSubmission({
      app,
      form,
      surface,
      mapped,
      submitterIpHash,
      userAgent,
      submitterUserId,
    }).pipe(
      Effect.catchTags({
        ForeignKeyViolationError: (fk) => Effect.fail(missingRowError(fk.fieldName)),
        // A value refused by a unique, CHECK or NOT NULL rule is reported
        // against the field it came from, so the page can draw it there.
        UniqueConstraintViolationError: (unique) =>
          Effect.fail(uniqueRefusalForField(unique) ?? unique),
        DatabaseError: (failure) => Effect.fail(constraintRefusalForField(failure) ?? failure),
      })
    )
    const { submissionId, linkedRecordPresent, linkedRecordId } = persisted
    yield* applySubmissionAccessLinks({
      form,
      submissionId,
      editTokenHash: config.editTokenHash,
      resumeTokenHash: config.resumeTokenHash,
    })

    // [internal ref]: write the unified analytics_events row for
    // every successful submission. Three-layer gate (env / app / form);
    // emission failures are absorbed so a missing analytics row never
    // rolls back the committed submission.
    yield* emitFormSubmissionAnalyticsEvent({
      app,
      form,
      submissionId,
      submitterIpHash,
    })

    // [internal ref]: fire the bound table's record/create automations for the
    // form-created row (no-op when no bound-table row was written). See
    // fireBoundTableRecordCreateAutomations.
    yield* fireBoundTableRecordCreateAutomations({
      app,
      form,
      mapped,
      outcome: persisted,
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
      submissionId: submissionId ?? null,
      linkedRecordId: linkedRecordId ?? null,
      // Expose only the submitter-supplied bound-table columns
      // for `$record.<column>` redirect interpolation (see SubmitFormResult).
      record: filterTableBoundFields(mapped, form),
    } satisfies SubmitFormResult
  }).pipe(Effect.withSpan('forms.submit-form-program', { attributes: { form: config.formName } }))
