/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { FormSubmissionRepository } from '@/application/ports/repositories/forms/form-submission-repository'
import { EmailSender } from '@/application/ports/services/email-sender'
import { ServerOrigin } from '@/application/ports/services/server-origin'
import { escapeHtml } from '@/domain/kernel/markdown/markdown-renderer'
import { isValidEmail } from '@/domain/kernel/sanitize/email-validation'
import {
  DEFAULT_DRAFT_EXPIRES_IN,
  draftableAnswers,
  formLinkExpiry,
} from '@/domain/models/app/forms/form-access-link-service'
import { FormFieldFormatError, FormNotFoundError, findFormByName } from './submit-form'
import { checkRateLimit } from './submit-form-rate-limit'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'

/** What a saved draft answers its submitter: when the link stops working. */
export interface SavedFormDraft {
  readonly expiresAt: string
}

/** The form's title as plain text, for a mail subject. */
const titleOf = (title: unknown, fallback: string): string =>
  typeof title === 'string' && title.trim() !== '' && !title.startsWith('$t:') ? title : fallback

const resumeMail = (config: {
  readonly title: string
  readonly link: string
  readonly expiresAt: Readonly<Date>
}) => {
  const until = config.expiresAt.toUTCString()
  return {
    subject: `Continue your form: ${config.title}`,
    text: `Your answers to "${config.title}" are saved.\n\nContinue where you left off:\n${config.link}\n\nThis link works once, until ${until}. If you did not ask for it, you can ignore this message.`,
    html: `<p>Your answers to <strong>${escapeHtml(config.title)}</strong> are saved.</p><p><a href="${escapeHtml(config.link)}">Continue where you left off</a></p><p>This link works once, until ${escapeHtml(until)}. If you did not ask for it, you can ignore this message.</p>`,
  }
}

/** Mail the resume link to the address the draft was saved under. */
const mailResumeLink = Effect.fn('forms.mail-resume-link')(function* (input: {
  readonly app: Readonly<App>
  readonly form: Readonly<Form>
  readonly address: string
  readonly token: string
  readonly expiresAt: Readonly<Date>
}) {
  const { app, form, address, token, expiresAt } = input
  const base = yield* (yield* ServerOrigin).current
  const link = `${base}/forms/${encodeURIComponent(form.name)}?resume=${token}`
  const mailer = yield* EmailSender
  yield* mailer.send({
    to: address,
    fromName: app.name,
    ...resumeMail({ title: titleOf(form.title, form.name), link, expiresAt }),
  })
})

/**
 * Keep a half-filled answer to a form that declares `saveAndResume`, and mail
 * the link that reopens it.
 *
 * The answers become one ledger row in status `draft`, keyed by the address
 * the submitter gave and reached only through the token in the mailed link —
 * stored here as its digest. Nothing is validated, and nothing reaches the
 * bound table or an automation: that happens on the final submit. A form
 * without the block answers as an unknown form (404). Saves count against the
 * form's per-address submission limits, since each one sends a mail.
 */
export const saveFormDraftProgram = (config: {
  readonly app: Readonly<App>
  readonly formName: string
  readonly email: string
  readonly answers: Readonly<Record<string, unknown>>
  readonly token: string
  readonly tokenHash: string
  /** The submitter's address digests, as a submission is limited by (see `checkRateLimit`). */
  readonly submitterIpHash: string
  readonly rateLimitKeyHash: string | undefined
  readonly userAgent: string | undefined
}) =>
  Effect.gen(function* () {
    const { app, formName, email, token, tokenHash } = config
    const form = findFormByName(app, formName)
    if (form?.saveAndResume?.enabled !== true) {
      return yield* new FormNotFoundError({ formName })
    }
    // A save mails a link, so it is held to the form's submission limits: the
    // endpoint must not become a way to send mail to any address at will.
    yield* checkRateLimit({
      form,
      body: config.answers,
      submitterIpHash: config.submitterIpHash,
      rateLimitKeyHash: config.rateLimitKeyHash,
      userAgent: config.userAgent,
    })
    const address = email.trim()
    if (!isValidEmail(address)) {
      return yield* new FormFieldFormatError({
        fieldName: 'email',
        message: 'email must be a valid email address',
      })
    }
    const repo = yield* FormSubmissionRepository
    yield* repo.createTopLevel({
      formName: form.name,
      formId: form.id,
      status: 'draft',
      data: { ...draftableAnswers(form, app.tables, config.answers) },
      guestEmail: address,
      accessTokenHash: tokenHash,
    })
    const expiresAt = new Date(
      formLinkExpiry(Date.now(), form.saveAndResume.expiresIn ?? DEFAULT_DRAFT_EXPIRES_IN)
    )
    yield* mailResumeLink({ app, form, address, token, expiresAt })
    return { expiresAt: expiresAt.toISOString() } satisfies SavedFormDraft
  }).pipe(Effect.withSpan('forms.save-form-draft', { attributes: { form: config.formName } }))
