/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { findUserEmailById } from '@/application/use-cases/auth/find-user-email'
import { revalidateInlinePrefillParent } from '@/application/use-cases/forms/inline-prefill-revalidation'
import { resolveFormOptionSources } from '@/application/use-cases/forms/resolve-form-option-sources'
import { findFormByName, submitFormProgram } from '@/application/use-cases/forms/submit-form'
import { evaluateAvailabilityWindow } from '@/domain/models/app/forms/form-availability-flow'
import { hashAccessToken, issueAccessToken } from '@/infrastructure/forms/access-token'
import { hashIp, resolveIpHashSalt } from '@/infrastructure/forms/ip-hash'
import {
  provideDomain,
  runDomainPromise,
  runRequestEffect,
} from '@/infrastructure/logging/request-effect'
import {
  denyFormAccess,
  evaluateFormAccessForRequest,
  resolveFormOptionVisitor,
} from '@/presentation/api/forms/access-gate'
import {
  editPathOf,
  handleEditSubmission,
  handleGetEditPage,
  handlePostDraft,
  resolveResumeLink,
  resumeTokenOf,
  type FormLinkState,
} from '@/presentation/api/forms/access-link-handlers'
import { checkSubmissionAttachmentReferences } from '@/presentation/api/forms/attachment-reference-guard'
import {
  multipartFileFieldNames,
  transformMultipartFiles,
} from '@/presentation/api/forms/file-upload-handler'
import {
  handleGetStepFragment,
  handlePostDraftReset,
  handlePostStepAdvance,
  mergeStepDraftIntoBody,
  type StepFragmentRenderer,
} from '@/presentation/api/forms/step-handlers'
import { getRequestClientIp, getRequestRateLimitKey } from '@/presentation/api/middleware/client-ip'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import { microphonePolicyHeaders } from '@/presentation/api/runtime/microphone-permission'
import { formRecordsAudio } from '@/presentation/render/page/page-microphone-detection'
import { formNameRequired, formNotFound } from './submission-refusals'
import {
  detectJsonClient,
  respondParentMissing,
  respondSubmissionFailure,
  respondSubmissionSuccess,
} from './submission-responses'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'
import type { FormOptionSets } from '@/domain/models/app/forms/form-option-source-service'
import type { Context, Hono } from 'hono'

/**
 * Renderer callbacks injected by the server-startup wiring. Routes
 * cannot import from `presentation-rendering` directly under the
 * layer-boundary rules, so the infrastructure layer composes the route
 * registration with the rendering functions it imports legally.
 */
/**
 * Render-time prefill inputs passed to the form renderer so `forms[].prefill`
 * `$query.<name>` / `$user.<prop>` references resolve against the request's
 * URL query and (optional) authenticated user context. Structurally matches
 * `FormPrefillContext` in presentation-rendering; redeclared here so the
 * route layer does not import a rendering module directly.
 */
export interface FormPrefillContext {
  readonly query: Readonly<Record<string, string>>
  readonly user?: Readonly<Record<string, unknown>>
  /** The choices read from tables for this request, keyed by field submit identifier. */
  readonly optionSets?: FormOptionSets
  /** A private link the page was opened from: a resumed draft, or an edit. */
  readonly link?: FormLinkState
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
  /**
   * Multi-step fragment renderer. Returns the HTML for a single step's
   * `<div class="form-step">` block with prefilled values from the
   * per-session draft. Backs the `GET /api/forms/:name/steps/:stepId`
   * endpoint and (later) the advance endpoint when it streams the next
   * step's HTML alongside `{ nextStepId }`.
   */
  readonly renderStepFragment: StepFragmentRenderer['renderStepFragment']
  /**
   * Render the closed-form HTML for a form whose `availability` window has
   * not yet opened (`reason: 'not-yet-open'`) or has already closed
   * (`reason: 'closed'`). Backs the GET `/forms/:name` response so visiting
   * a closed form shows a friendly page instead of a submittable form.
   */
  readonly renderClosedForm: (
    app: Readonly<App>,
    form: Readonly<Form>,
    reason: 'not-yet-open' | 'closed',
    request?: { readonly activeLang?: string; readonly opensAt?: string }
  ) => string
}

/**
 * The GET-a-form decision chain, entered once the form has already been
 * resolved: access gate → availability window → render.
 *
 * Both doorways that serve a form's HTML run this — the canonical
 * `GET /forms/:name` and the custom `path` alias — so a form cannot be
 * reachable through one URL under rules only the other enforces.
 *
 * The seam is at the form-RESOLVED boundary rather than at the name
 * boundary on purpose: `c.req.param('name')` does not exist on a custom
 * path (the alias is registered as a literal route, not `/:name`), so the
 * alias cannot simply delegate to `handleGetForm`.
 *
 * `authenticated` denials get a 401
 * page referencing the form name + access level; role denials get a 404
 * (S1 anti-enumeration), never a 403.
 */
async function respondWithForm(
  c: Context,
  app: App,
  form: Readonly<Form>,
  view: { readonly renderers: FormRenderers; readonly editLink?: FormLinkState }
): Promise<Response> {
  const { renderers, editLink } = view
  const { decision, session } = await evaluateFormAccessForRequest(c, form)
  const denied = denyFormAccess(c, form.name, decision, 'html')
  if (denied !== undefined) return denied
  const activeLang = c.req.query('lang')
  // Render the closed-form UI (no submit button)
  // when the availability window has not yet opened or has already closed.
  // A closed form is a page the visitor is meant to read, so this is a 200 —
  // only the submission endpoint answers 403.
  const windowState = evaluateAvailabilityWindow(form.availability, Date.now())
  if (windowState.kind === 'not-yet-open') {
    return c.html(
      renderers.renderClosedForm(app, form, 'not-yet-open', {
        activeLang,
        opensAt: windowState.opensAt,
      })
    )
  }
  if (windowState.kind === 'closed') {
    return c.html(renderers.renderClosedForm(app, form, 'closed', { activeLang }))
  }
  const prefillCtx = await buildPrefillContext(c)
  // Choices read from tables with the FORM's authority, on every serve — so a
  // public form lists rows its visitor could never read through the records
  // API, and a row added since the last load is offered on this one.
  const optionSets = await runRequestEffect(
    c,
    provideDomain(
      c,
      resolveFormOptionSources({
        app,
        form,
        visitor: await resolveFormOptionVisitor(c, session),
      })
    )
  )
  // A private link's page: an edit, or a draft reopened from its resume link.
  const link = editLink ?? (await resolveResumeLink(c, form))
  const html = renderers.renderForm(app, form, activeLang, {
    ...prefillCtx,
    optionSets,
    ...(link === undefined ? {} : { link }),
  })
  return c.html(html, 200, microphonePolicyHeaders(formRecordsAudio(form)))
}

/**
 * `GET /forms/:name` — render the form HTML at the canonical route.
 * Returns 404 when the form name is not registered in `app.forms[]`.
 */
async function handleGetForm(c: Context, app: App, renderers: FormRenderers): Promise<Response> {
  const name = c.req.param('name')
  if (!name) return c.notFound()
  const form = findFormByName(app, name)
  if (!form) return c.notFound()
  return respondWithForm(c, app, form, { renderers })
}

/**
 * Assemble the render-time prefill context from the request: all URL query
 * params back `$query.<name>`, and the authenticated user (when a session
 * is present) backs `$user.<prop>`. Anonymous requests yield `user:
 * undefined` so `$user.*` references resolve to empty rather than leaking
 * the literal token.
 */
async function buildPrefillContext(c: Context): Promise<FormPrefillContext> {
  const query = c.req.query() as Record<string, string>
  const session = getSessionContext(c)
  if (!session) return { query }
  // Hydrate the user record with the email address so `$user.email` prefills
  // resolve to the session user's email at render time.
  // A missing email (auth lookup failure) leaves the entry to render empty
  // rather than leaking the literal `$user.email` token (S1).
  const email = await runDomainPromise(c, findUserEmailById(session.userId))
  const user: Record<string, unknown> =
    email !== undefined ? { id: session.userId, email } : { id: session.userId }
  return { query, user }
}

// (handleGetFormEmbed + buildFrameAncestorsCsp removed: `forms.share` schema
// field was cut with the share-links runtime in Task #18. Iframe embedding
// is post-MVP and out of scope until form-level sharing returns.)

/**
 * Parse the submission body in a way that handles both
 * `application/json` (programmatic clients, `request.post(...)` in tests)
 * and `application/x-www-form-urlencoded` (native browser form submits via
 * `<form action="...">`).
 *
 * The two encodings are exclusive at the wire level — Hono's `parseBody`
 * mishandles JSON streams and `req.json()` throws on form-encoded bodies —
 * so we branch on the `Content-Type` header. The native-form branch is
 * what powers the inline-create flow: a host page renders the embedded
 * form, the user clicks Submit, the browser POSTs urlencoded fields, and
 * we redirect back to the host page (or surface a 422 HTML error page).
 *
 * Returning a flat `Record<string, unknown>` keeps the downstream
 * `submitFormProgram` interface stable; the form-program performs its
 * own field-shape validation against `forms[].fields[]`.
 *
 * Empty-string entries from form-encoded bodies are dropped: native HTML
 * forms always send every input (including ones the user never touched)
 * with an empty value, and shoving `""` at PostgreSQL for `TEXT[]` /
 * numeric / date columns triggers a malformed-literal error instead of
 * the desired "treat as undefined" semantics. JSON clients are left
 * untouched because they post explicit values (or omit absent fields).
 */
async function readSubmissionBody(c: Context): Promise<Record<string, unknown>> {
  const contentType = c.req.header('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const json = await c.req.json().catch(() => undefined)
    return ((json as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>
  }
  // `parseBody({ all: true })` collects repeated keys into arrays. The
  // inline-create flow renders multi-value prefills (e.g. `tags` inherited
  // from `$parent.tags`) as several `<input type="hidden" name="tags">`
  // entries; without `all: true` Hono would only surface the first value.
  const parsed = await c.req.parseBody({ all: true }).catch(() => undefined)
  const raw = ((parsed as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>
  return Object.fromEntries(
    Object.entries(raw)
      .map(([key, value]): readonly [string, unknown] => {
        if (Array.isArray(value)) {
          // Drop empty-string entries inside arrays so a stray `name=` from
          // a missing checkbox doesn't poison the resulting Postgres array.
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

/**
 * `POST /api/forms/:name/submissions` — accept a submission, write to
 * the bound table when configured, then write the ledger row.
 *
 * Two response modes:
 * - JSON clients (Content-Type: application/json or Accept:
 *   application/json, plus all `multipart/form-data` posts driven by the
 *   inline runtime) get `{ submissionId, linkedRecordId }` on success /
 *   `{ error, message, fieldErrors? }` on failure.
 * - Native form submits (urlencoded `<form action>`) redirect to the
 *   Referer on success and render a small HTML error page on failure
 *   (so the browser's address bar reflects the host page rather than
 *   the JSON endpoint).
 */
async function handlePostSubmission(c: Context, app: App): Promise<Response> {
  const name = c.req.param('name')
  const isJsonClient = detectJsonClient(c)
  if (!name) return formNameRequired(c)
  const form = findFormByName(app, name)
  if (!form) return formNotFound(c)
  // Enforce the form access gate before reading the
  // body. `authenticated` denial → 401; role denial → 404 (anti-enumeration).
  const { decision, session } = await evaluateFormAccessForRequest(c, form)
  const denied = denyFormAccess(c, form.name, decision, 'json')
  if (denied !== undefined) return denied

  const rawBody = await readSubmissionBody(c)
  // An attachment value that NAMES a stored file must name one in the column's
  // bucket that the submitter can download. Checked on the raw body — before
  // any multipart file is uploaded, so a refusal orphans nothing — with the
  // earlier steps' draft answers merged in, since they reach the table too.
  const referenceError = await checkSubmissionAttachmentReferences({
    c,
    app,
    form,
    body: mergeStepDraftIntoBody(c, form, name, rawBody),
    uploadedFields: multipartFileFieldNames(rawBody),
    session,
  })
  if (referenceError) return respondSubmissionFailure(c, isJsonClient, referenceError)
  // [internal ref] (file-uploads): Multipart bodies may carry `File` instances on
  // attachment fields. Upload each one to the form's resolved bucket and
  // replace the raw File with canonical `{ url, name, size, mimeType }`
  // metadata BEFORE the inline-prefill revalidation pass and the bound-
  // table write. JSON / urlencoded bodies pass through untouched.
  const uploadResult = await runRequestEffect(
    c,
    provideDomain(c, transformMultipartFiles(app, form, rawBody, session)).pipe(Effect.result)
  )
  if (uploadResult._tag === 'Failure') {
    return respondSubmissionFailure(c, isJsonClient, uploadResult.failure)
  }

  // Y-5: Inline-prefill revalidation runs after the upload step so a
  // deleted parent record short-circuits the submission AFTER the file
  // bytes have been persisted (acceptable: the pre-uploaded files become
  // orphaned but the audit ledger row never lands).
  const revalidation = await runRequestEffect(
    c,
    provideDomain(
      c,
      revalidateInlinePrefillParent({
        app,
        formName: name,
        referer: c.req.header('referer'),
        submitterUserId: session?.userId,
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
    // Multi-step: the browser only ever submits the LAST step's inputs, so
    // recover the earlier steps' answers from the accumulated draft. No-op for
    // single-page forms and for any caller that posts a complete payload.
    body: mergeStepDraftIntoBody(c, form, name, uploadResult.success),
    isJsonClient,
    session,
  })
}

interface RunSubmitProgramConfig {
  readonly c: Context
  readonly app: App
  readonly formName: string
  readonly body: Record<string, unknown>
  readonly isJsonClient: boolean
  /**
   * The signed-in submitter, if any: their id is captured on the ledger row
   * and the form's choice filters resolve `$currentUser`
   * for them as the page did.
   */
  readonly session: Parameters<typeof resolveFormOptionVisitor>[1]
}

/**
 * Run the `submitFormProgram` Effect and convert the result to the right
 * HTTP response. Extracted from `handlePostSubmission` to keep both
 * functions under the project's complexity caps.
 */
async function runSubmitProgram(config: Readonly<RunSubmitProgramConfig>): Promise<Response> {
  const { c, app, formName, body, isJsonClient, session } = config
  const submitterUserId = session?.userId
  const visitor = await resolveFormOptionVisitor(c, session)
  const ipAddress = getRequestClientIp(c)
  const userAgent = c.req.header('user-agent')
  // An embedded form posts to `?surface=embed` (`buildFormAttributes`); the
  // program reads that marker off the query (`splitSubmissionSurface`).
  const query = c.req.query() as Record<string, string>
  // A forms spec + S5: hash-on-write at the route boundary so the raw IP
  // is bounded to the rate-limiter's volatile in-memory state and never
  // crosses into the application layer or persistence. When the request
  // arrives without an IP (no X-Forwarded-For / X-Real-IP), hash the empty
  // string against the same salt so the ledger column stays populated
  // (64 hex chars guaranteed) and anonymous traffic shares a stable
  // rate-limit bucket.
  const submitterIpHash = hashIp(resolveIpHashSalt(), ipAddress ?? '')
  const links = submissionLinkTokens(c, app, formName)
  const program = submitFormProgram({
    app,
    formName,
    body,
    query,
    processEnv: process.env,
    submitterIpHash,
    // The anti-spam bucket counts an IPv6 client by its /64; the ledger keeps the full digest.
    rateLimitKeyHash: hashIp(resolveIpHashSalt(), getRequestRateLimitKey(c)),
    ...(userAgent !== undefined ? { userAgent } : {}),
    ...(submitterUserId !== undefined ? { submitterUserId } : {}),
    ...(visitor !== undefined ? { visitor } : {}),
    ...links.hashes,
  })
  const result = await runRequestEffect(c, provideDomain(c, program).pipe(Effect.result))
  if (result._tag === 'Failure') {
    return respondSubmissionFailure(c, isJsonClient, result.failure)
  }
  return respondSubmissionSuccess(c, isJsonClient, {
    ...result.success,
    ...links.editUrlFor(result.success.submissionId),
  })
}

/**
 * The private links a submission touches. A form with `editAfterSubmit` hands
 * each submission an edit link, minted here; a submission sent from a resume
 * link (`?resume=`) consumes that draft. Only digests reach the program; the
 * edit token itself leaves only in the answer, as the link.
 */
function submissionLinkTokens(c: Context, app: App, formName: string) {
  const editToken =
    findFormByName(app, formName)?.editAfterSubmit === undefined ? undefined : issueAccessToken()
  const resumeToken = resumeTokenOf(c)
  return {
    hashes: {
      ...(editToken === undefined ? {} : { editTokenHash: editToken.hash }),
      ...(resumeToken === undefined ? {} : { resumeTokenHash: hashAccessToken(resumeToken) }),
    },
    editUrlFor: (submissionId: string | null): { readonly editUrl?: string } =>
      editToken === undefined || submissionId === null
        ? {}
        : { editUrl: editPathOf(formName, editToken.token) },
  }
}

/**
 * Chain the form routes onto the parent Hono app.
 *
 * Registers:
 *   GET  /forms/:name              → render form HTML
 *   POST /api/forms/:name/submissions → write submission
 *
 * When a form declares a custom `path`, that path is also registered
 * as an alias for the canonical GET.
 *
 * `renderers` are injected by the caller (infrastructure/server) so this
 * file does not import directly from `presentation-rendering`.
 */
export function chainFormRoutes<T extends Hono>(
  honoApp: T,
  app: App,
  renderers: Readonly<FormRenderers>
): T {
  const forms = app.forms ?? []
  const withCanonical = honoApp
    .get('/forms/:name', (c) => handleGetForm(c, app, renderers))
    .post('/api/forms/:name/submissions', (c) => handlePostSubmission(c, app))
    // Save and resume: keep a half-filled answer, mail its resume link.
    .post('/api/forms/:name/drafts', (c) => handlePostDraft(c, app, readSubmissionBody))
    // Edit after submit: the edit page, and the save (PUT, or POST from a native form).
    .get('/forms/:name/edit/:token', (c) =>
      handleGetEditPage(c, app, (form, editLink) =>
        respondWithForm(c, app, form, { renderers, editLink })
      )
    )
    .put('/api/forms/:name/submissions/edit/:token', (c) =>
      handleEditSubmission(c, app, readSubmissionBody)
    )
    .post('/api/forms/:name/submissions/edit/:token', (c) =>
      handleEditSubmission(c, app, readSubmissionBody)
    )
    // Multi-step navigation. Registered alongside the canonical submission
    // endpoint so the cross-validator's step-aware rules and the per-step
    // SSR share the same Hono app instance and access the same `app` payload.
    .post('/api/forms/:name/steps/:stepId/advance', (c) => handlePostStepAdvance(c, app))
    // Draft reset backs `onSuccess: reset` on a multi-step form. Deliberately
    // NOT under `/steps/` — a form is free to declare a step whose id is
    // literally `reset`, and this must not be reachable by naming a step.
    .post('/api/forms/:name/draft/reset', (c) => handlePostDraftReset(c, app))
    .get('/api/forms/:name/steps/:stepId', (c) =>
      handleGetStepFragment(c, app, {
        renderStepFragment: renderers.renderStepFragment,
      })
    )

  // Register custom-path aliases. Each form with a `path` is reachable
  // both at `/forms/{name}` (canonical) and at the configured path.
  //
  // The alias is a second doorway into the same form, so it runs the SAME
  // `respondWithForm` chain — access gate, then availability, then render.
  // It previously rendered unconditionally, which published a gated form's
  // whole body (field names and the anti-spam honeypot's input name
  // included) to anyone who knew the friendly URL.
  //
  // Note this only decides correctly when the request arrives with its
  // session attached: `authMiddleware` is mounted on each declared
  // `form.path` in `infrastructure/server/route-setup/api-routes.ts`.
  // Without that, every caller here looks anonymous and the gate would
  // deny the users it is meant to admit.
  return forms.reduce<T>((acc, form) => {
    if (typeof form.path !== 'string') return acc
    return acc.get(form.path, async (c) => {
      const resolved = findFormByName(app, form.name)
      if (!resolved) return c.notFound()
      return respondWithForm(c, app, resolved, { renderers })
    }) as T
  }, withCanonical as T)
}
