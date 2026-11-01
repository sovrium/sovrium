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
import {
  formDraftSavedResponseSchema,
  submissionEditResponseSchema,
} from '@/domain/models/api/forms/submissions'
import { answersFromLedgerData } from '@/domain/models/app/forms/form-access-link-service'
import { hashAccessToken, issueAccessToken } from '@/infrastructure/forms/access-token'
import { hashIp, resolveIpHashSalt } from '@/infrastructure/forms/ip-hash'
import { evictTransformCacheForKey } from '@/infrastructure/storage/transform-cache'
import { denyFormAccess, evaluateFormAccessForRequest } from '@/presentation/api/forms/access-gate'
import { transformMultipartFiles } from '@/presentation/api/forms/file-upload-handler'
import { getRequestClientIp, getRequestRateLimitKey } from '@/presentation/api/middleware/client-ip'
import { answerNotFound, shapedJson } from '@/presentation/api/runtime/run-effect'
import { formForCaller } from './form-page-context'
import { awaitForm, runFormProgram } from './form-program'
import { formNotFound } from './submission-refusals'
import {
  detectJsonClient,
  resolveSubmitRedirectTarget,
  respondSubmissionFailure,
} from './submission-responses'
import type { ReadTableAsCaller } from '@/application/ports/services/page-renderer'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'
import type { DomainServices } from '@/infrastructure/logging/request-effect'
import type { Context } from 'hono'

/**
 * What a draft or an edit reads of its request as the submission endpoint
 * does: the body (JSON or a native form post), and the table API's answer to
 * what the caller may see of the form's table, so the form is offered — and
 * kept — exactly as on a first submission.
 */
export interface SubmissionRequestReaders {
  readonly read: (c: Context) => Promise<Record<string, unknown>>
  readonly readTableAsCaller: ((c: Context) => ReadTableAsCaller) | undefined
}

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
export const resolveResumeLink = (c: Context, form: Readonly<Form>) =>
  Effect.gen(function* () {
    const token = resumeTokenOf(c)
    if (token === undefined || form.saveAndResume?.enabled !== true) return undefined
    const answers = yield* openResumeDraftProgram({ form, tokenHash: hashAccessToken(token) })
    if (answers === undefined) return { unavailable: true } satisfies FormLinkState
    return {
      answers,
      action: `/api/forms/${encodeURIComponent(form.name)}/submissions?resume=${encodeURIComponent(token)}`,
    } satisfies FormLinkState
  })

/**
 * `GET /forms/:name/edit/:token` — the form reopened with the submitted
 * answers, posting to the edit endpoint. Past the window, and for a token
 * never issued, the plain 404 page: a guessed link learns nothing.
 */
export const handleGetEditPage = <E>(
  c: Context,
  app: App,
  respond: (form: Readonly<Form>, link: FormLinkState) => Effect.Effect<Response, E, DomainServices>
): Promise<Response> =>
  runFormProgram(
    c,
    Effect.gen(function* () {
      const form = findFormByName(app, c.req.param('name') ?? '')
      const token = c.req.param('token') ?? ''
      if (form?.editAfterSubmit === undefined) return yield* answerNotFound(c)
      const { decision } = yield* evaluateFormAccessForRequest(c, form)
      const denied = denyFormAccess(c, form.name, decision, 'html')
      if (denied !== undefined) return yield* awaitForm(() => denied)
      const row = yield* openEditableSubmissionProgram({
        form,
        tokenHash: hashAccessToken(token),
      })
      if (row === undefined) return yield* answerNotFound(c)
      return yield* respond(form, {
        answers: answersFromLedgerData(form, row.data),
        action: `/api/forms/${encodeURIComponent(form.name)}/submissions/edit/${token}`,
        editing: true,
      })
    })
  )

/**
 * `PUT /api/forms/:name/submissions/edit/:token` (and `POST`, which a native
 * form can send) — save an edit. Refused like a first submission; an unknown
 * or expired link, or a form without `editAfterSubmit`, answers the one 404.
 */
export const handleEditSubmission = (
  c: Context,
  app: App,
  readers: SubmissionRequestReaders
): Promise<Response> =>
  runFormProgram(
    c,
    Effect.gen(function* () {
      const form = findFormByName(app, c.req.param('name') ?? '')
      if (form?.editAfterSubmit === undefined) return formNotFound(c)
      const { decision, session } = yield* evaluateFormAccessForRequest(c, form)
      const denied = denyFormAccess(c, form.name, decision, 'json')
      if (denied !== undefined) return yield* awaitForm(() => denied)
      const isJsonClient = detectJsonClient(c)
      const offered = yield* formForCaller(c, app, form, {
        session,
        read: readers.readTableAsCaller,
      })
      // A file picked on the edit page is uploaded as on a first submission.
      const body = yield* awaitForm(() => readers.read(c))
      const uploaded = yield* Effect.result(transformMultipartFiles(app, offered, body, session))
      if (uploaded._tag === 'Failure') return respondSubmissionFailure(c, true, uploaded.failure)
      const result = yield* Effect.result(
        editFormSubmissionProgram({
          app,
          formName: form.name,
          form: offered,
          tokenHash: hashAccessToken(c.req.param('token') ?? ''),
          body: uploaded.success,
          forgetDerivedVariants: evictTransformCacheForKey,
        })
      )
      if (result._tag === 'Failure') {
        if (result.failure instanceof FormEditLinkNotFoundError) return formNotFound(c)
        return respondSubmissionFailure(c, isJsonClient, result.failure)
      }
      if (!isJsonClient) return c.redirect(resolveSubmitRedirectTarget(c), 303)
      return shapedJson(
        c,
        { submissionId: result.success.submissionId },
        submissionEditResponseSchema
      )
    })
  )

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
export const handlePostDraft = (
  c: Context,
  app: App,
  readers: SubmissionRequestReaders
): Promise<Response> =>
  runFormProgram(
    c,
    Effect.gen(function* () {
      const form = findFormByName(app, c.req.param('name') ?? '')
      if (form?.saveAndResume?.enabled !== true) return formNotFound(c)
      const { decision, session } = yield* evaluateFormAccessForRequest(c, form)
      const denied = denyFormAccess(c, form.name, decision, 'json')
      if (denied !== undefined) return yield* awaitForm(() => denied)
      const { email, answers } = readDraftRequest(yield* awaitForm(() => readers.read(c)))
      const issued = issueAccessToken()
      const userAgent = c.req.header('user-agent')
      const offered = yield* formForCaller(c, app, form, {
        session,
        read: readers.readTableAsCaller,
      })
      const result = yield* Effect.result(
        saveFormDraftProgram({
          app,
          formName: form.name,
          form: offered,
          email,
          answers,
          token: issued.token,
          tokenHash: issued.hash,
          submitterIpHash: hashIp(resolveIpHashSalt(), getRequestClientIp(c) ?? ''),
          rateLimitKeyHash: hashIp(resolveIpHashSalt(), getRequestRateLimitKey(c)),
          userAgent,
        })
      )
      if (result._tag === 'Failure') {
        if (result.failure instanceof FormNotFoundError) return formNotFound(c)
        return respondSubmissionFailure(c, true, result.failure)
      }
      return shapedJson(c, result.success, formDraftSavedResponseSchema, 201)
    })
  )
