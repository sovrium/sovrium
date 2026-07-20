/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { findUserEmailById } from '@/application/use-cases/auth/find-user-email'
import { revalidateInlinePrefillParent } from '@/application/use-cases/forms/inline-prefill-revalidation'
import {
  findFormByName,
  submitFormProgram,
  FormClosedError,
  FormFieldForeignKeyError,
  FormFieldFormatError,
  FormFieldRequiredError,
  FormHoneypotTrippedError,
  FormNotFoundError,
  FormNotYetOpenError,
  FormRateLimitedError,
  FormSubmissionLimitError,
} from '@/application/use-cases/forms/submit-form'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import {
  evaluateFormAccess,
  type FormAccessDecision,
} from '@/domain/models/shared/form-access-flow'
import { evaluateAvailabilityWindow } from '@/domain/models/shared/form-availability-flow'
import { hashIp, readIpHashSalt } from '@/infrastructure/forms/ip-hash'
import { FieldValidationError } from '@/presentation/api/middleware/validation'
import { provideFormsLive } from '@/presentation/api/routes/forms/effect-runner'
import {
  FormUploadError,
  transformMultipartFiles,
} from '@/presentation/api/routes/forms/file-upload-handler'
import {
  handleGetStepFragment,
  handlePostStepAdvance,
} from '@/presentation/api/routes/forms/step-handlers'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'
import type { Context, Hono } from 'hono'

export interface FormPrefillContext {
  readonly query: Readonly<Record<string, string>>
  readonly user?: Readonly<Record<string, unknown>>
}

export interface FormRenderers {
  readonly renderForm: (
    app: Readonly<App>,
    form: Readonly<Form>,
    activeLang?: string,
    prefillCtx?: FormPrefillContext
  ) => string
  readonly renderEmbed: (
    app: Readonly<App>,
    form: Readonly<Form>,
    activeLang?: string,
    prefillCtx?: FormPrefillContext
  ) => string
  readonly renderStepFragment: (
    app: Readonly<App>,
    form: Readonly<Form>,
    stepId: string,
    draftValues: Readonly<Record<string, unknown>>
  ) => string
  readonly renderClosedForm: (
    app: Readonly<App>,
    form: Readonly<Form>,
    reason: 'not-yet-open' | 'closed',
    opensAt?: string
  ) => string
}

function extractClientIp(c: Context): string | undefined {
  const forwarded = c.req.header('x-forwarded-for')
  if (typeof forwarded === 'string' && forwarded !== '') {
    return forwarded.split(',')[0]?.trim() ?? undefined
  }
  return c.req.header('x-real-ip') ?? undefined
}

function renderFormUnauthorizedHtml(formName: string, require: string): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>401 — authentication required</title></head><body><main class="form-access-denied" data-status="401"><p>Form "${formName}" requires ${require} access.</p></main></body></html>`
}

async function handleGetForm(c: Context, app: App, renderers: FormRenderers): Promise<Response> {
  const name = c.req.param('name')
  if (!name) return c.notFound()
  const form = findFormByName(app, name)
  if (!form) return c.notFound()
  const { decision } = await evaluateFormAccessForRequest(c, form)
  if (decision.kind === 'unauthorized') {
    return c.html(renderFormUnauthorizedHtml(form.name, decision.require), 401)
  }
  if (decision.kind === 'not-found') return c.notFound()
  const activeLang = c.req.query('lang')
  const windowState = evaluateAvailabilityWindow(form.availability, Date.now())
  if (windowState.kind === 'not-yet-open') {
    return c.html(renderers.renderClosedForm(app, form, 'not-yet-open', windowState.opensAt))
  }
  if (windowState.kind === 'closed') {
    return c.html(renderers.renderClosedForm(app, form, 'closed'))
  }
  return c.html(renderers.renderForm(app, form, activeLang, await buildPrefillContext(c)))
}

async function buildPrefillContext(c: Context): Promise<FormPrefillContext> {
  const query = c.req.query() as Record<string, string>
  const session = getSessionContext(c)
  if (!session) return { query }
  const email = await findUserEmailById(session.userId)
  const user: Record<string, unknown> =
    email !== undefined ? { id: session.userId, email } : { id: session.userId }
  return { query, user }
}

async function resolveFormSession(
  c: Context
): Promise<{ readonly userId: string; readonly role: string } | undefined> {
  const session = getSessionContext(c)
  if (!session) return undefined
  const role = await getUserRole(session.userId)
  return { userId: session.userId, role }
}

async function evaluateFormAccessForRequest(
  c: Context,
  form: Readonly<Form>
): Promise<{
  readonly decision: FormAccessDecision
  readonly session: { readonly userId: string; readonly role: string } | undefined
}> {
  const session = await resolveFormSession(c)
  const decision = evaluateFormAccess(form.access?.require, session)
  return { decision, session }
}


async function readSubmissionBody(c: Context): Promise<Record<string, unknown>> {
  const contentType = c.req.header('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const json = await c.req.json().catch(() => undefined)
    return ((json as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>
  }
  const parsed = await c.req.parseBody({ all: true }).catch(() => undefined)
  const raw = ((parsed as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>
  return Object.fromEntries(
    Object.entries(raw)
      .map(([key, value]): readonly [string, unknown] => {
        if (Array.isArray(value)) {
          const filtered = value.filter((entry) => entry !== '')
          return [key, filtered]
        }
        return [key, value]
      })
      .filter(([, value]) => {
        if (value === '') return false
        if (Array.isArray(value) && value.length === 0) return false
        return true
      })
  )
}

function renderSubmissionErrorHtml(message: string, statusLabel: string): string {
  const safe = message.replace(/[&<>"']/g, (ch) => {
    if (ch === '&') return '&amp;'
    if (ch === '<') return '&lt;'
    if (ch === '>') return '&gt;'
    if (ch === '"') return '&quot;'
    return '&#39;'
  })
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${statusLabel}</title></head><body><main class="form-error" data-status="${statusLabel}"><p>${safe}</p></main></body></html>`
}

function resolveSubmitRedirectTarget(c: Context): string {
  const referer = c.req.header('referer')
  if (typeof referer !== 'string' || referer === '') return '/'
  try {
    const url = new URL(referer)
    return `${url.pathname}${url.search}`
  } catch {
    return '/'
  }
}

function respondParentMissing(c: Context, isJsonClient: boolean): Response {
  const message =
    'Parent record does not exist. The host record may have been deleted between page load and form submission.'
  if (isJsonClient) return c.json({ error: 'parent_missing', message }, 422)
  return c.html(renderSubmissionErrorHtml(message, '422 — parent does not exist'), 422)
}

function respondValidation400(
  c: Context,
  isJsonClient: boolean,
  fieldName: string,
  message: string
): Response {
  const fullMessage = fieldName ? `${fieldName} ${message}`.trim() : message
  const fieldErrors = fieldName ? [{ name: fieldName, message }] : []
  if (isJsonClient) {
    return c.json({ error: 'validation_failed', message: fullMessage, fieldErrors }, 400)
  }
  return c.html(renderSubmissionErrorHtml(message, '400 — validation failed'), 400)
}

function respondAvailability403(c: Context, failure: unknown): Response | undefined {
  if (failure instanceof FormHoneypotTrippedError) {
    return c.json({ error: 'invalid request' }, 400)
  }
  if (failure instanceof FormNotYetOpenError) {
    return c.json({ error: 'form not yet open', opensAt: failure.opensAt }, 403)
  }
  if (failure instanceof FormClosedError) {
    return c.json({ error: 'form closed', closedAt: failure.closedAt }, 403)
  }
  if (failure instanceof FormSubmissionLimitError) {
    return c.json(
      {
        error: 'submission limit reached',
        maxSubmissions: failure.maxSubmissions,
        currentCount: failure.currentCount,
      },
      403
    )
  }
  return undefined
}

function respondFieldValidation400(
  c: Context,
  isJsonClient: boolean,
  failure: unknown
): Response | undefined {
  if (failure instanceof FormFieldRequiredError) {
    return respondValidation400(c, isJsonClient, failure.fieldName, failure.message)
  }
  if (failure instanceof FormFieldFormatError) {
    return respondValidation400(c, isJsonClient, failure.fieldName, failure.message)
  }
  if (failure instanceof FormFieldForeignKeyError) {
    return respondValidation400(c, isJsonClient, failure.fieldName, failure.message)
  }
  if (failure instanceof FieldValidationError) {
    return respondValidation400(c, isJsonClient, failure.field ?? '', failure.message)
  }
  return undefined
}

function respondSubmissionFailure(c: Context, isJsonClient: boolean, failure: unknown): Response {
  if (failure instanceof FormNotFoundError) {
    return c.json({ error: 'form_not_found' }, 404)
  }
  if (failure instanceof FormRateLimitedError) {
    return c.json({ error: 'rate limit exceeded' }, 429, {
      'Retry-After': String(failure.retryAfterSec),
    })
  }
  const structured = respondAvailability403(c, failure)
  if (structured !== undefined) return structured
  const fieldError = respondFieldValidation400(c, isJsonClient, failure)
  if (fieldError !== undefined) return fieldError
  if (failure instanceof FormUploadError) {
    if (isJsonClient) return c.json({ error: 'upload_failed', message: failure.message }, 400)
    return c.html(renderSubmissionErrorHtml(failure.message, '400 — upload failed'), 400)
  }
  const message = failure instanceof Error ? failure.message : String(failure)
  console.error('[forms] submission rejected:', message, failure)
  if (isJsonClient) return c.json({ error: 'submission_invalid', message }, 422)
  return c.html(renderSubmissionErrorHtml(message, '422 — submission rejected'), 422)
}

function respondSubmissionSuccess(
  c: Context,
  isJsonClient: boolean,
  result: {
    readonly submissionId: string | null
    readonly linkedRecordId: string | null
    readonly record: Readonly<Record<string, unknown>>
  }
): Response {
  if (isJsonClient) {
    return c.json(
      {
        submissionId: result.submissionId,
        linkedRecordId: result.linkedRecordId,
        record: result.record,
      },
      201
    )
  }
  return c.redirect(resolveSubmitRedirectTarget(c), 303)
}

function detectJsonClient(c: Context): boolean {
  const contentType = c.req.header('content-type') ?? ''
  const acceptHeader = c.req.header('accept') ?? ''
  return (
    contentType.includes('application/json') ||
    contentType.includes('multipart/form-data') ||
    acceptHeader.includes('application/json')
  )
}

async function handlePostSubmission(c: Context, app: App): Promise<Response> {
  const name = c.req.param('name')
  const isJsonClient = detectJsonClient(c)
  if (!name) return c.json({ error: 'form_name_required' }, 400)
  const form = findFormByName(app, name)
  if (!form) return c.json({ error: 'form_not_found' }, 404)

  const { decision, session } = await evaluateFormAccessForRequest(c, form)
  if (decision.kind === 'unauthorized') {
    return c.json(
      { error: 'authentication required', form: form.name, require: decision.require },
      401
    )
  }
  if (decision.kind === 'not-found') return c.json({ error: 'form_not_found' }, 404)

  const rawBody = await readSubmissionBody(c)
  const uploadResult = await Effect.runPromise(
    provideFormsLive(transformMultipartFiles(app, form, rawBody)).pipe(Effect.either)
  )
  if (uploadResult._tag === 'Left') {
    return respondSubmissionFailure(c, isJsonClient, uploadResult.left)
  }

  const referer = c.req.header('referer')
  const revalidation = await Effect.runPromise(
    provideFormsLive(
      revalidateInlinePrefillParent({
        app,
        formName: name,
        ...(referer !== undefined ? { referer } : {}),
      })
    )
  )
  if (revalidation.kind === 'parent-missing') {
    return respondParentMissing(c, isJsonClient)
  }

  return runSubmitProgram({
    c,
    app,
    formName: name,
    body: uploadResult.right,
    isJsonClient,
    ...(session !== undefined ? { submitterUserId: session.userId } : {}),
  })
}

interface RunSubmitProgramConfig {
  readonly c: Context
  readonly app: App
  readonly formName: string
  readonly body: Record<string, unknown>
  readonly isJsonClient: boolean
  readonly submitterUserId?: string
}

async function runSubmitProgram(config: Readonly<RunSubmitProgramConfig>): Promise<Response> {
  const { c, app, formName, body, isJsonClient, submitterUserId } = config
  const ipAddress = extractClientIp(c)
  const userAgent = c.req.header('user-agent')
  const query = c.req.query() as Record<string, string>
  const submitterIpHash = hashIp(readIpHashSalt(), ipAddress ?? '')
  const program = submitFormProgram({
    app,
    formName,
    body,
    query,
    processEnv: process.env,
    submitterIpHash,
    ...(userAgent !== undefined ? { userAgent } : {}),
    ...(submitterUserId !== undefined ? { submitterUserId } : {}),
  })
  const result = await Effect.runPromise(provideFormsLive(program).pipe(Effect.either))
  if (result._tag === 'Left') {
    return respondSubmissionFailure(c, isJsonClient, result.left)
  }
  return respondSubmissionSuccess(c, isJsonClient, result.right)
}

export function chainFormRoutes<T extends Hono>(
  honoApp: T,
  app: App,
  renderers: Readonly<FormRenderers>
): T {
  const forms = app.forms ?? []
  const withCanonical = honoApp
    .get('/forms/:name', (c) => handleGetForm(c, app, renderers))
    .post('/api/forms/:name/submissions', (c) => handlePostSubmission(c, app))
    .post('/api/forms/:name/steps/:stepId/advance', (c) => handlePostStepAdvance(c, app))
    .get('/api/forms/:name/steps/:stepId', (c) =>
      handleGetStepFragment(c, app, {
        renderStepFragment: renderers.renderStepFragment,
      })
    )

  return forms.reduce<T>((acc, form) => {
    if (typeof form.path !== 'string') return acc
    return acc.get(form.path, async (c) => {
      const resolved = findFormByName(app, form.name)
      if (!resolved) return c.notFound()
      const activeLang = c.req.query('lang')
      return c.html(renderers.renderForm(app, resolved, activeLang, await buildPrefillContext(c)))
    }) as T
  }, withCanonical as T)
}
