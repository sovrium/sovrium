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
import { constraintRefusalForField } from '@/application/use-cases/forms/submit-form-constraint-errors'
import { FormFieldFormatError } from '@/application/use-cases/forms/submit-form-format-validation'
import { withoutUnrenderedHiddenValues } from '@/application/use-cases/forms/submit-form-hidden-defaults'
import { findUnpinnedHiddenField } from '@/application/use-cases/forms/submit-form-hidden-pins'
import { checkHoneypot } from '@/application/use-cases/forms/submit-form-honeypot'
import { withHiddenLookupDefaults } from '@/application/use-cases/forms/submit-form-lookup-defaults'
import { findUnofferedLinkField } from '@/application/use-cases/forms/submit-form-offered-links'
import { checkRateLimit } from '@/application/use-cases/forms/submit-form-rate-limit'
import { takenValueRefusal } from '@/application/use-cases/forms/submit-form-taken-value'
import { splitSubmissionSurface } from '@/domain/models/app/forms/submission-ledger-service'
import { requestedRecordLanguage } from '@/domain/models/app/languages/localized-value-service'
import {
  buildLinkedRecord,
  buildSubmitterMeta,
  checkAvailabilityWindow,
  processSubmissionBody,
} from './submit-form-body'
import { FormNotFoundError, missingRowError, refuseAsMissingRow } from './submit-form-errors'
import { filterTableBoundFields, withoutWithheldAnswers } from './submit-form-field-shaping'
import { persistSubmission } from './submit-form-persist'
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

/**
 * The form as its submitter was offered it (`config.form`, the declared form
 * when absent) and her answers less every value for a field she was not
 * offered, which goes no further than one for a field the form does not declare.
 */
const offeredSubmission = (config: Readonly<SubmitFormConfig>) =>
  Effect.suspend(() => {
    const declared = findFormByName(config.app, config.formName)
    if (declared === undefined)
      return Effect.fail(new FormNotFoundError({ formName: config.formName }))
    const form = config.form ?? declared
    return Effect.succeed({ form, body: withoutWithheldAnswers(config.body, declared, form) })
  })

/** The language a translatable answer is filed under: the route's, else `?lang=` on the submission. */
const writeLanguageOf = (config: Readonly<SubmitFormConfig>): string | undefined =>
  config.writeLanguage ??
  requestedRecordLanguage(config.app.languages, config.query?.['lang'], undefined)

/**
 * The gates a submission meets before any of its answers is read: the form's
 * availability window, the honeypot, then the rate limit.
 */
const screenSubmission = (
  config: Readonly<SubmitFormConfig>,
  form: Form,
  body: SubmitFormConfig['body']
) =>
  Effect.gen(function* () {
    const { app, submitterIpHash, userAgent } = config

    // Availability window gate — see checkAvailabilityWindow. The cap is
    // enforced atomically inside persistSubmission (see reserveLedgerSlot).
    yield* checkAvailabilityWindow(form)

    // Honeypot anti-spam gate — runs against the raw body BEFORE field
    // filtering (the `_hp` trap field is never declared on the form). A
    // tripped honeypot records a `spam` ledger row and rejects with 400 so
    // spam never reaches the bound-table write or the cap counter.
    yield* checkHoneypot({ form, tables: app.tables, body, submitterIpHash, userAgent })

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
      tables: app.tables,
      body,
      submitterIpHash: submitterIpHash ?? '',
      rateLimitKeyHash: config.rateLimitKeyHash,
      userAgent,
    })
  })

/**
 * The submitter's answers as the bound row will store them: hidden fields
 * filled and pinned to what the server could have rendered, every value
 * coerced, and every link checked against the rows the form offers.
 */
const prepareAnswers = (
  config: Readonly<SubmitFormConfig>,
  form: Form,
  body: SubmitFormConfig['body']
) =>
  Effect.gen(function* () {
    const { app, submitterUserId, visitor } = config
    // An embedded form marks its surface on the query; the rest is the form's.
    const { surface, query: formQuery } = splitSubmissionSurface(config.query ?? {})
    // A hidden field's lookup default is the row it finds now, for this submitter.
    const filled = yield* withHiddenLookupDefaults(app, form, visitor)
    // A hidden field keeps only what the server could have rendered into it; a
    // value it could not falls back to the field's default.
    const rendered = yield* withoutUnrenderedHiddenValues({
      app,
      form: filled,
      body,
      visitor,
      submitterUserId,
    })
    const mapped = yield* processSubmissionBody(app, filled, rendered, {
      query: formQuery,
      hiddenOverlay: 'when-absent',
    })

    // A link must name a row the form offers, and a hidden link or account only
    // what the server would have put in it for this submitter — both answered
    // like a missing row.
    const links = { app, form: filled, mapped, visitor, submitterUserId }
    yield* findUnofferedLinkField(links).pipe(Effect.flatMap(refuseAsMissingRow))
    yield* findUnpinnedHiddenField(links).pipe(Effect.flatMap(refuseAsMissingRow))
    return { surface, mapped }
  })

/** The answers a {@link prepareAnswers} step settled, and the surface they came from. */
type PreparedAnswers = Effect.Success<ReturnType<typeof prepareAnswers>>

/**
 * Write the ledger row and the bound row, reporting a value a database rule
 * refuses against the field it came from.
 */
const persistAnswers = (
  config: Readonly<SubmitFormConfig>,
  form: Form,
  { surface, mapped }: Readonly<PreparedAnswers>
) => {
  const { app, submitterIpHash, userAgent, submitterUserId } = config
  // [internal ref] / a forms spec: translate FK violations on the bound-table
  // write into a structured FormFieldForeignKeyError so the route layer
  // emits a 400 with `fieldErrors[]` instead of a generic 422. Mirrors the
  // FormFieldFormatError translation in `processSubmissionBody`.
  return persistSubmission({
    app,
    form,
    surface,
    mapped,
    submitterIpHash,
    userAgent,
    submitterUserId,
    // The bound row fires the table's record automations and webhooks as it is written.
    // A translatable field's answer is filed under the language the form was answered in.
    language: writeLanguageOf(config),
  }).pipe(
    Effect.catchTags({
      ForeignKeyViolationError: (fk) => Effect.fail(missingRowError(fk.fieldName)),
      // A value refused by a unique, CHECK or NOT NULL rule is reported
      // against the field it came from, so the page can draw it there.
      UniqueConstraintViolationError: (unique) =>
        Effect.flatMap(
          takenValueRefusal({
            app,
            form,
            mapped,
            unique,
            submitterUserId,
            visitor: config.visitor,
            lang: config.query?.['lang'],
          }),
          Effect.fail
        ),
      DatabaseError: (failure) => Effect.fail(constraintRefusalForField(failure) ?? failure),
    })
  )
}

/** What a committed submission set in motion: its access links, its analytics row, its automations. */
const followUpSubmission = (
  config: Readonly<SubmitFormConfig>,
  form: Form,
  mapped: Readonly<PreparedAnswers['mapped']>,
  persisted: {
    readonly submissionId: string | undefined
    readonly linkedRecordPresent: boolean
    readonly linkedRecordId: string | undefined
  }
) =>
  Effect.gen(function* () {
    const { app, submitterIpHash, submitterUserId } = config
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
    yield* emitFormSubmissionAnalyticsEvent({ app, form, submissionId, submitterIpHash })

    // Start form-triggered automations AFTER the bound-table + ledger rows
    // commit so action templates referencing `{{trigger.data.linkedRecord.id}}`
    // see a committed row. They run in the background: the submission answers
    // without waiting, and a failing automation never rolls back its writes.
    yield* triggerFormSubmissionAutomations({
      app,
      formName: form.name,
      submissionData: mapped,
      submissionId: submissionId ?? null,
      formId: form.id,
      linkedRecord: buildLinkedRecord(form, linkedRecordPresent, linkedRecordId),
      meta: buildSubmitterMeta(config),
      // The submitter is the run's actor: `runAs: 'triggering-user'` actions
      // and per-user OAuth2 token lookups resolve against it. Omitted for
      // anonymous submissions, which keep the system actor.
      ...(submitterUserId !== undefined ? { userId: submitterUserId } : {}),
    })
  })

/**
 * One form submission, gate by gate: the form as offered, the screening gates,
 * the answers settled, the rows written, then what the commit sets in motion.
 * Each step needs the prior step's resolved state.
 */
export const submitFormProgram = (config: Readonly<SubmitFormConfig>) =>
  Effect.gen(function* () {
    const { form, body } = yield* offeredSubmission(config)
    yield* screenSubmission(config, form, body)
    const prepared = yield* prepareAnswers(config, form, body)
    const persisted = yield* persistAnswers(config, form, prepared)
    yield* followUpSubmission(config, form, prepared.mapped, persisted)
    return {
      submissionId: persisted.submissionId ?? null,
      linkedRecordId: persisted.linkedRecordId ?? null,
      // Expose only the submitter-supplied bound-table columns
      // for `$record.<column>` redirect interpolation (see SubmitFormResult).
      record: filterTableBoundFields(prepared.mapped, form),
    } satisfies SubmitFormResult
  }).pipe(Effect.withSpan('forms.submit-form-program', { attributes: { form: config.formName } }))
