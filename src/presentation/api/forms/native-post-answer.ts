/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The answer to a submission, once the program has run: the JSON answer, or —
 * for a form posted without JavaScript, where the browser navigated to the
 * submission endpoint — the page it shows next.
 *
 * A refusal that names fields is answered `400` with the page the form was
 * posted from, drawn again for the same visitor, with the refused fields marked
 * and her answers back in their fields (`form-refused-markup.ts`). The page is
 * drawn by the app's own routes (`Hono.request`), so it is the page a GET
 * would serve her: the access gate, the language and the cache rules are the
 * ones every page passes through. A post over the form's rate limit is answered
 * `429` with the same page, the limit's notice above the form in the page's
 * language, and its `Retry-After`. Anything else keeps its existing answer.
 */

import {
  FormFieldConstraintError,
  FormFieldForeignKeyError,
  FormFieldFormatError,
  FormFieldRequiredError,
  FormRateLimitedError,
} from '@/application/use-cases/forms/submit-form'
import { isBusinessRuleViolationError } from '@/domain/errors/business-rule-violation-error'
import { FORM_ANSWERED_PARAM } from '@/domain/models/app/forms/submission-ledger-service'
import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'
import { FieldValidationError } from '@/presentation/api/middleware/validation'
import { markRefusedFields, withFormNotice } from '@/presentation/render/forms/form-refused-markup'
import {
  answeredFormOf,
  resolveSubmitRedirectTarget,
  respondSubmissionFailure,
  respondSubmissionSuccess,
} from './submission-responses'
import type { SubmitFormResult } from '@/application/use-cases/forms/submit-form'
import type { Result } from 'effect'
import type { Context, Hono } from 'hono'

/** The app a submission's request is served by, to draw its page again. */
const PAGE_APPS = new WeakMap<Request, Hono>()

/** Note the app serving `c`, so a refused native post can draw its page again. */
export const rememberPageApp = (c: Context, honoApp: Hono): Context => {
  PAGE_APPS.set(c.req.raw, honoApp)
  return c
}

/**
 * The fields a refusal names, with their reasons — what the JSON answer lists
 * as `fieldErrors` — or none for a refusal no field explains.
 */
function fieldErrorsOf(
  failure: unknown
): readonly { readonly name: string; readonly message: string }[] {
  if (
    failure instanceof FormFieldRequiredError ||
    failure instanceof FormFieldFormatError ||
    failure instanceof FormFieldForeignKeyError ||
    failure instanceof FormFieldConstraintError
  ) {
    return failure.fieldName ? [{ name: failure.fieldName, message: failure.message }] : []
  }
  if (failure instanceof FieldValidationError && failure.field !== undefined) {
    return [{ name: failure.field, message: failure.message }]
  }
  if (isBusinessRuleViolationError(failure)) {
    return failure.violations.flatMap((violation) =>
      violation.field === undefined ? [] : [{ name: violation.field, message: violation.message }]
    )
  }
  return []
}

/** The request headers a page drawn again for this visitor keeps: her session and language. */
const VISITOR_HEADERS = ['cookie', 'accept-language', 'user-agent'] as const

/** A page address without the answered marker: a refused post draws the form, never its success page. */
const withoutAnsweredMarker = (target: string): string => {
  const url = new URL(target, 'http://page.invalid')
  url.searchParams.delete(FORM_ANSWERED_PARAM)
  return `${url.pathname}${url.search}`
}

/**
 * The page a native post came from, drawn again for this visitor — or
 * `undefined` when there is none to draw (no same-origin referring page, an
 * API address, a page that does not answer with HTML).
 */
async function drawPostedPage(c: Context): Promise<string | undefined> {
  const honoApp = PAGE_APPS.get(c.req.raw)
  const target = resolveSubmitRedirectTarget(c)
  if (honoApp === undefined || target.startsWith('/api/')) return undefined
  const headers = Object.fromEntries(
    VISITOR_HEADERS.flatMap((name) => {
      const value = c.req.header(name)
      return value === undefined ? [] : [[name, value]]
    })
  )
  const page = await honoApp.request(withoutAnsweredMarker(target), { headers })
  if (!page.ok || !(page.headers.get('content-type') ?? '').includes('text/html')) return undefined
  return page.text()
}

/**
 * The page a refused native post came from, drawn again for this visitor with
 * the refused fields marked, as a `400` — or `undefined` when there is none to
 * draw (a JSON client, a refusal naming no field, no page to draw, a page that
 * no longer draws the form), and the caller answers as it always has.
 */
export async function answerRefusedNativePost(
  c: Context,
  formName: string,
  refused: {
    readonly isJsonClient: boolean
    readonly failure: unknown
    readonly answers: Readonly<Record<string, unknown>>
  }
): Promise<Response | undefined> {
  const errors = refused.isJsonClient ? [] : fieldErrorsOf(refused.failure)
  if (errors.length === 0) return undefined
  const page = await drawPostedPage(c)
  if (page === undefined) return undefined
  const html = markRefusedFields(page, formName, { errors, answers: refused.answers })
  return html === undefined ? undefined : c.html(html, 400)
}

/** The language a drawn page is written in, from its `<html lang>`. */
const pageLanguageOf = (html: string): string | undefined =>
  /<html\b[^>]*\slang="([^"]+)"/.exec(html)?.[1]

/**
 * A native post over the form's rate limit: its page drawn again, the answers
 * typed back, and the limit's notice above the form in the page's language,
 * as a `429` carrying `Retry-After` — or `undefined` when it is no such post,
 * or there is no page to draw.
 */
async function answerRateLimitedNativePost(
  c: Context,
  formName: string,
  refused: {
    readonly isJsonClient: boolean
    readonly failure: unknown
    readonly answers: Readonly<Record<string, unknown>>
  }
): Promise<Response | undefined> {
  const { failure } = refused
  if (refused.isJsonClient || !(failure instanceof FormRateLimitedError)) return undefined
  const page = await drawPostedPage(c)
  const answered =
    page === undefined
      ? undefined
      : markRefusedFields(page, formName, { errors: [], answers: refused.answers })
  if (answered === undefined) return undefined
  const message = resolveInterpreterString('forms.rateLimited', pageLanguageOf(answered))
  const html = withFormNotice(answered, formName, message)
  if (html === undefined) return undefined
  return c.html(html, 429, { 'Retry-After': String(failure.retryAfterSec) })
}

/**
 * The response to a submission the program has answered: a refusal (drawn on
 * its page for a native post that names fields), or the success — the JSON
 * answer, or a native post sent back to its page, with the success page in the
 * form's place for a `successPage` form.
 */
export async function answerSubmission(
  c: Context,
  submission: {
    readonly form: Readonly<{
      readonly name: string
      readonly onSuccess?: { readonly type: string }
    }>
    readonly isJsonClient: boolean
    readonly answers: Readonly<Record<string, unknown>>
    readonly result: Result.Result<SubmitFormResult, unknown>
    readonly links: {
      readonly editUrlFor: (submissionId: string | null) => { readonly editUrl?: string }
    }
  }
): Promise<Response> {
  const { form, isJsonClient, answers, result } = submission
  if (result._tag === 'Failure') {
    const refusal = { isJsonClient, failure: result.failure, answers }
    const page =
      (await answerRefusedNativePost(c, form.name, refusal)) ??
      (await answerRateLimitedNativePost(c, form.name, refusal))
    return page ?? respondSubmissionFailure(c, isJsonClient, result.failure)
  }
  return respondSubmissionSuccess(c, isJsonClient, {
    ...result.success,
    ...submission.links.editUrlFor(result.success.submissionId),
    answeredForm: answeredFormOf(form),
  })
}
