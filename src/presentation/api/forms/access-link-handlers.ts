/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  editFormSubmissionProgram,
  FormEditLinkNotFoundError,
} from '@/application/use-cases/forms/edit-form-submission'
import {
  openEditableSubmissionProgram,
  openResumeDraftProgram,
} from '@/application/use-cases/forms/open-form-access-link'
import { saveFormDraftProgram } from '@/application/use-cases/forms/save-form-draft'
import { findFormByName, FormNotFoundError } from '@/application/use-cases/forms/submit-form'
import { answersFromLedgerData } from '@/domain/models/app/forms/form-access-link-service'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { hashAccessToken, issueAccessToken } from '@/infrastructure/forms/access-token'
import { hashIp, resolveIpHashSalt } from '@/infrastructure/forms/ip-hash'
import { provideDomain, runRequestEffect } from '@/infrastructure/logging/request-effect'
import { evictTransformCacheForKey } from '@/infrastructure/storage/transform-cache'
import { triggerTableWebhooks } from '@/infrastructure/webhooks/table-webhook-dispatch'
import { denyFormAccess, evaluateFormAccessForRequest } from '@/presentation/api/forms/access-gate'
import { transformMultipartFiles } from '@/presentation/api/forms/file-upload-handler'
import { getRequestClientIp, getRequestRateLimitKey } from '@/presentation/api/middleware/client-ip'
import { formNotFound } from './submission-refusals'
import {
  detectJsonClient,
  resolveSubmitRedirectTarget,
  respondSubmissionFailure,
} from './submission-responses'
import type { UpdateWebhookPayload } from '@/application/use-cases/tables/record-update-orchestration'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'
import type { Context } from 'hono'

/** Reads a submission body as the submission endpoint does (JSON or a native form post). */
export type SubmissionBodyReader = (c: Context) => Promise<Record<string, unknown>>

/**
 * What a resume or edit link brings to the form page: the answers to restore,
 * whether a resume link found nothing, and where the page posts instead.
 * Structurally the renderer's `FormLinkState`.
 */
export interface FormLinkState {
  readonly answers?: Readonly<Record<string, unknown>>
  readonly unavailable?: boolean
  readonly action?: string
  readonly editing?: boolean
}

/** The `?resume=` token of a request, when it carries one. */
export const resumeTokenOf = (c: Context): string | undefined => {
  const token = c.req.query('resume')
  return token === undefined || token === '' ? undefined : token
}

/** The address a submission with an edit link is reopened at. */
export const editPathOf = (formName: string, token: string): string =>
  `/forms/${encodeURIComponent(formName)}/edit/${token}`

/**
 * `GET /forms/:name?resume=<token>`: the saved answers and a form that posts
 * back with the token (so the submit consumes the draft) — or, for an
 * expired, used or unknown token, the same notice and an empty form.
 */
export async function resolveResumeLink(
  c: Context,
  form: Readonly<Form>
): Promise<FormLinkState | undefined> {
  const token = resumeTokenOf(c)
  if (token === undefined || form.saveAndResume?.enabled !== true) return undefined
  const answers = await runRequestEffect(
    c,
    provideDomain(c, openResumeDraftProgram({ form, tokenHash: hashAccessToken(token) }))
  )
  if (answers === undefined) return { unavailable: true }
  return {
    answers,
    action: `/api/forms/${encodeURIComponent(form.name)}/submissions?resume=${encodeURIComponent(token)}`,
  }
}

/**
 * `GET /forms/:name/edit/:token` — the form reopened with the submitted
 * answers, posting to the edit endpoint. Past the window, and for a token
 * never issued, the plain 404 page: a guessed link learns nothing.
 */
export async function handleGetEditPage(
  c: Context,
  app: App,
  respond: (form: Readonly<Form>, link: FormLinkState) => Promise<Response>
): Promise<Response> {
  const form = findFormByName(app, c.req.param('name') ?? '')
  const token = c.req.param('token') ?? ''
  if (form?.editAfterSubmit === undefined) return c.notFound()
  const { decision } = await evaluateFormAccessForRequest(c, form)
  const denied = denyFormAccess(c, form.name, decision, 'html')
  if (denied !== undefined) return denied
  const row = await runRequestEffect(
    c,
    provideDomain(c, openEditableSubmissionProgram({ form, tokenHash: hashAccessToken(token) }))
  )
  if (row === undefined) return c.notFound()
  return respond(form, {
    answers: answersFromLedgerData(form, row.data),
    action: `/api/forms/${encodeURIComponent(form.name)}/submissions/edit/${token}`,
    editing: true,
  })
}

/** Deliver the bound table's update webhooks for an edit. Total, like the records API's. */
const editWebhooksFor =
  (app: App, tableName: string | undefined) =>
  (payload: UpdateWebhookPayload): Effect.Effect<void> =>
    // effect-promise: total -- `triggerTableWebhooks` wraps its whole dispatch in a try/catch; a webhook endpoint that is down must never fail the edit that fired it.
    Effect.promise(() =>
      triggerTableWebhooks({
        table: app.tables?.find((t) => t.name === tableName),
        appEnv: app.env,
        event: 'update',
        record: { ...payload.record },
        previousRecord:
          payload.previousRecord === undefined ? undefined : { ...payload.previousRecord },
      })
    )

/**
 * `PUT /api/forms/:name/submissions/edit/:token` (and `POST`, which a native
 * form can send) — save an edit. Refused like a first submission; an unknown
 * or expired link, or a form without `editAfterSubmit`, answers the one 404.
 */
export async function handleEditSubmission(
  c: Context,
  app: App,
  readBody: SubmissionBodyReader
): Promise<Response> {
  const form = findFormByName(app, c.req.param('name') ?? '')
  if (form?.editAfterSubmit === undefined) return formNotFound(c)
  const { decision, session } = await evaluateFormAccessForRequest(c, form)
  const denied = denyFormAccess(c, form.name, decision, 'json')
  if (denied !== undefined) return denied
  const isJsonClient = detectJsonClient(c)
  // A file picked on the edit page is uploaded as on a first submission.
  const uploaded = await runRequestEffect(
    c,
    provideDomain(c, transformMultipartFiles(app, form, await readBody(c), session)).pipe(
      Effect.result
    )
  )
  if (uploaded._tag === 'Failure') return respondSubmissionFailure(c, true, uploaded.failure)
  const program = editFormSubmissionProgram({
    app,
    formName: form.name,
    tokenHash: hashAccessToken(c.req.param('token') ?? ''),
    body: uploaded.success,
    processEnv: process.env,
    isSqlite: isSqliteRuntime(),
    dispatchWebhooks: editWebhooksFor(app, form.submitTo.table),
    forgetDerivedVariants: evictTransformCacheForKey,
  })
  const result = await runRequestEffect(c, provideDomain(c, program).pipe(Effect.result))
  if (result._tag === 'Failure') {
    if (result.failure instanceof FormEditLinkNotFoundError) return formNotFound(c)
    return respondSubmissionFailure(c, isJsonClient, result.failure)
  }
  if (!isJsonClient) return c.redirect(resolveSubmitRedirectTarget(c), 303)
  return c.json({ submissionId: result.success.submissionId }, 200)
}

/** Read a draft request: an address and the answers so far, each of the expected kind. */
const readDraftRequest = (body: Readonly<Record<string, unknown>>) => ({
  email: typeof body['email'] === 'string' ? body['email'] : '',
  answers:
    typeof body['data'] === 'object' && body['data'] !== null && !Array.isArray(body['data'])
      ? (body['data'] as Record<string, unknown>)
      : {},
})

/**
 * `POST /api/forms/:name/drafts` — keep a half-filled answer and mail its
 * resume link. The token travels only in the mail: the answer states when the
 * link expires and nothing else. A form without `saveAndResume` answers 404.
 */
export async function handlePostDraft(
  c: Context,
  app: App,
  readBody: SubmissionBodyReader
): Promise<Response> {
  const form = findFormByName(app, c.req.param('name') ?? '')
  if (form?.saveAndResume?.enabled !== true) return formNotFound(c)
  const { decision } = await evaluateFormAccessForRequest(c, form)
  const denied = denyFormAccess(c, form.name, decision, 'json')
  if (denied !== undefined) return denied
  const { email, answers } = readDraftRequest(await readBody(c))
  const issued = issueAccessToken()
  const userAgent = c.req.header('user-agent')
  const program = saveFormDraftProgram({
    app,
    formName: form.name,
    email,
    answers,
    token: issued.token,
    tokenHash: issued.hash,
    submitterIpHash: hashIp(resolveIpHashSalt(), getRequestClientIp(c) ?? ''),
    rateLimitKeyHash: hashIp(resolveIpHashSalt(), getRequestRateLimitKey(c)),
    userAgent,
  })
  const result = await runRequestEffect(c, provideDomain(c, program).pipe(Effect.result))
  if (result._tag === 'Failure') {
    if (result.failure instanceof FormNotFoundError) return formNotFound(c)
    return respondSubmissionFailure(c, true, result.failure)
  }
  return c.json(result.success, 201)
}
