/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { revalidateInlinePrefillParent } from '@/application/use-cases/forms/inline-prefill-revalidation'
import { resolveFormOptionSources } from '@/application/use-cases/forms/resolve-form-option-sources'
import { findFormByName, submitFormProgram } from '@/application/use-cases/forms/submit-form'
import { trackingDeclinedUnder } from '@/domain/models/app/analytics/privacy-signals-service'
import { evaluateAvailabilityWindow } from '@/domain/models/app/forms/form-availability-flow'
import { hashIp, resolveIpHashSalt } from '@/infrastructure/forms/ip-hash'
import {
  denyFormAccess,
  evaluateFormAccessForRequest,
  resolveFormOptionVisitor,
} from '@/presentation/api/forms/access-gate'
import {
  handleEditSubmission,
  handleGetEditPage,
  handlePostDraft,
  resolveResumeLink,
  type FormLinkState,
} from '@/presentation/api/forms/access-link-handlers'
import { checkSubmissionAttachmentReferences } from '@/presentation/api/forms/attachment-reference-guard'
import { multipartFileFieldNames } from '@/presentation/api/forms/file-upload-handler'
import { signThenUploadAnswers } from '@/presentation/api/forms/signed-answer-uploads'
import {
  handleGetStepFragment,
  handlePostDraftReset,
  handlePostStepAdvance,
  keepStep,
  mergeStepDraftIntoBody,
  type StepFragmentRenderer,
} from '@/presentation/api/forms/step-handlers'
import { getRequestClientIp, getRequestRateLimitKey } from '@/presentation/api/middleware/client-ip'
import { acceptsUploadBody } from '@/presentation/api/middleware/request-body-limit'
import { answerOnce, withoutIdempotencyField } from '@/presentation/api/runtime/idempotency'
import { microphonePolicyHeaders } from '@/presentation/api/runtime/microphone-permission'
import { pageWriteLanguage } from '@/presentation/api/runtime/page-write-language'
import { answerNotFound } from '@/presentation/api/runtime/run-effect'
import { formRecordsAudio } from '@/presentation/render/page/page-microphone-detection'
import { answerFlowBound, isFlowBound } from './flow-signature-submission'
import { buildPrefillContext, formForCaller } from './form-page-context'
import { awaitForm, runFormProgram } from './form-program'
import { answerSubmission, rememberPageApp } from './native-post-answer'
import { submissionLinkTokens } from './submission-link-tokens'
import { formNameRequired, formNotFound } from './submission-refusals'
import {
  detectJsonClient,
  respondParentMissing,
  respondSubmissionFailure,
} from './submission-responses'
import type { ReadTableAsCaller } from '@/application/ports/services/page-renderer'
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
  ) => string | Promise<string>
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
  /** The table API's answer to what this request's caller may see of a form's table. */
  readonly readTableAsCaller?: (c: Context) => ReadTableAsCaller
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
const respondWithForm = (
  c: Context,
  app: App,
  form: Readonly<Form>,
  view: { readonly renderers: FormRenderers; readonly editLink?: FormLinkState }
) =>
  Effect.gen(function* () {
    const { renderers, editLink } = view
    const { decision, session } = yield* evaluateFormAccessForRequest(c, form, app)
    const denied = denyFormAccess(c, form.name, decision, 'html')
    if (denied !== undefined) return yield* awaitForm(() => denied)
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
    const prefillCtx = yield* buildPrefillContext(c)
    const shown = yield* formForCaller(c, app, form, {
      session,
      read: renderers.readTableAsCaller,
    })
    // Choices read from tables with the FORM's authority, on every serve — so a
    // public form lists rows its visitor could never read through the records
    // API, and a row added since the last load is offered on this one.
    const visitor = yield* resolveFormOptionVisitor(session)
    const optionSets = yield* resolveFormOptionSources({ app, form: shown, visitor })
    // A private link's page: an edit, or a draft reopened from its resume link.
    const link = editLink ?? (yield* resolveResumeLink(c, form))
    const html = yield* awaitForm(() =>
      renderers.renderForm(app, shown, activeLang, {
        ...prefillCtx,
        optionSets,
        ...(link === undefined ? {} : { link }),
      })
    )
    return c.html(html, 200, microphonePolicyHeaders(formRecordsAudio(form)))
  })

/**
 * `GET /forms/:name` — render the form HTML at the canonical route.
 * Returns 404 when the form name is not registered in `app.forms[]`.
 */
const handleGetForm = (c: Context, app: App, renderers: FormRenderers): Promise<Response> =>
  runFormProgram(
    c,
    Effect.suspend(() => {
      const name = c.req.param('name')
      const form = name ? findFormByName(app, name) : undefined
      return form ? respondWithForm(c, app, form, { renderers }) : answerNotFound(c)
    })
  )

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
 *
 * The idempotency key field (`_idempotency`) is still in the result: the
 * submission route reads it, and every other reader takes
 * {@link readSubmissionBody}.
 */
async function readSubmissionFields(c: Context): Promise<Record<string, unknown>> {
  const contentType = c.req.header('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const json = await c.req.json().catch(() => undefined)
    return ((json as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>
  }
  // `parseBody({ all: true })` collects repeated keys into arrays: the inline-create
  // flow renders a multi-value prefill (`tags` from `$parent.tags`) as several
  // `<input type="hidden" name="tags">`; without it Hono surfaces the first.
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
        // A form encodes a line break as CRLF (a lone CR from older clients);
        // it is stored as a JSON write would send it.
        return [key, typeof value === 'string' ? value.replace(/\r\n?/g, '\n') : value]
      })
      .filter(([, value]) => {
        if (value === '') return false
        if (Array.isArray(value) && value.length === 0) return false
        return true
      })
  )
}

/** The submitted values without the idempotency key: what a draft or an edit reads. */
const readSubmissionBody = async (c: Context): Promise<Record<string, unknown>> =>
  withoutIdempotencyField(await readSubmissionFields(c))

type TableReader = FormRenderers['readTableAsCaller']

/**
 * `POST /api/forms/:name/submissions` — accept a submission, write to
 * the bound table when configured, then write the ledger row.
 *
 * JSON clients (the inline runtime included) get `{ submissionId, … }` or
 * `{ error, message, fieldErrors? }`. A native `<form action>` post goes back
 * to its page (with its success page in the form's place for a `successPage`
 * form), and a refusal naming fields answers 400 with that page, the fields
 * marked (`native-post-answer.ts`); any other refusal, a small error page.
 */
const handlePostSubmission = (c: Context, app: App, read: TableReader): Promise<Response> =>
  runFormProgram(
    c,
    Effect.gen(function* () {
      const name = c.req.param('name')
      const isJsonClient = detectJsonClient(c)
      if (!name) return formNameRequired(c)
      const form = findFormByName(app, name)
      if (!form) return formNotFound(c)
      // Enforce the form access gate before reading the
      // body. `authenticated` denial → 401; role denial → 404 (anti-enumeration).
      const { decision, session } = yield* evaluateFormAccessForRequest(c, form, app)
      const denied = denyFormAccess(c, form.name, decision, 'json')
      if (denied !== undefined) return yield* awaitForm(() => denied)
      // A duplicate under its idempotency key is answered here, before anything
      // below — anti-spam, availability and the cap included — counts it.
      const body = yield* awaitForm(() => readSubmissionFields(c))
      return yield* answerOnce(
        c,
        { scope: { kind: 'forms', name, userId: session?.userId }, body },
        (rawBody) => acceptSubmission({ c, app, form, session, isJsonClient, read }, rawBody)
      )
    })
  )

/** A submission past the access gate: uploads, the parent check, then the program. */
const acceptSubmission = (
  request: Omit<RunSubmitProgramConfig, 'formName' | 'body'> & { readonly read: TableReader },
  rawBody: Record<string, unknown>
) =>
  Effect.gen(function* () {
    const { c, app, session, isJsonClient } = request
    if (isFlowBound(request, rawBody)) return yield* answerFlowBound(request, rawBody)
    // Checked and kept over the fields the form offers this submitter.
    const form = yield* formForCaller(c, app, request.form, { session, read: request.read })
    const { name } = form
    // An attachment value that NAMES a stored file must name one in the column's
    // bucket that the submitter can download. Checked on the raw body — before
    // any multipart file is uploaded, so a refusal orphans nothing — with the
    // earlier steps' draft answers merged in, since they reach the table too.
    const referenceError = yield* checkSubmissionAttachmentReferences({
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
    const uploadResult = yield* Effect.result(signThenUploadAnswers(app, form, rawBody, session))
    if (uploadResult._tag === 'Failure') {
      return respondSubmissionFailure(c, isJsonClient, uploadResult.failure)
    }

    // Y-5: Inline-prefill revalidation runs after the upload step: a deleted parent
    // stops the submission after its files are stored (orphaned; no ledger row).
    const revalidation = yield* revalidateInlinePrefillParent({
      app,
      formName: name,
      referer: c.req.header('referer'),
      submitterUserId: session?.userId,
    })
    if (revalidation.kind === 'parent-missing') {
      return respondParentMissing(c, isJsonClient)
    }

    return yield* submitAndAnswer({
      c,
      app,
      formName: name,
      form,
      // Multi-step: the browser only ever submits the LAST step's inputs, so
      // recover the earlier steps' answers from the accumulated draft. No-op for
      // single-page forms and for any caller that posts a complete payload.
      body: mergeStepDraftIntoBody(c, form, name, uploadResult.success),
      isJsonClient,
      session,
    })
  })

interface RunSubmitProgramConfig {
  readonly c: Context
  readonly app: App
  readonly formName: string
  /** The form as offered to this submitter (`formForCaller`). */
  readonly form: Readonly<Form>
  readonly body: Record<string, unknown>
  readonly isJsonClient: boolean
  /**
   * The signed-in submitter, if any: their id is captured on the ledger row
   * and the form's choice filters resolve `$currentUser`
   * for them as the page did.
   */
  readonly session: Parameters<typeof resolveFormOptionVisitor>[0]
}

/**
 * Run the `submitFormProgram` Effect and convert the result to the right
 * HTTP response. Extracted from `acceptSubmission` to keep both
 * functions under the project's complexity caps.
 */
const submitAndAnswer = (config: Readonly<RunSubmitProgramConfig>) =>
  Effect.gen(function* () {
    const { c, app, formName, form, body, isJsonClient, session } = config
    const submitterUserId = session?.userId
    const visitor = yield* resolveFormOptionVisitor(session)
    const ipAddress = getRequestClientIp(c)
    const userAgent = c.req.header('user-agent')
    // An embedded form posts to `?surface=embed` (`buildFormAttributes`); the
    // program reads that marker off the query (`splitSubmissionSurface`).
    const query = c.req.query() as Record<string, string>
    // S5: hash-on-write at the route boundary, so the raw IP never crosses
    // into the application layer or persistence. A request without an IP
    // hashes the empty string, so the ledger column stays populated and
    // anonymous traffic shares a stable rate-limit bucket.
    const submitterIpHash = hashIp(resolveIpHashSalt(), ipAddress ?? '')
    const links = submissionLinkTokens(c, app, formName)
    const program = submitFormProgram({
      app,
      formName,
      form,
      body,
      query,
      submitterIpHash,
      // The anti-spam bucket counts an IPv6 client by its /64; the ledger keeps the full digest.
      rateLimitKeyHash: hashIp(resolveIpHashSalt(), getRequestRateLimitKey(c)),
      ...(userAgent !== undefined ? { userAgent } : {}),
      ...(submitterUserId !== undefined ? { submitterUserId } : {}),
      ...(visitor !== undefined ? { visitor } : {}),
      ...links.hashes,
      writeLanguage: pageWriteLanguage(c, app),
      // DNT / Sec-GPC skip the submission's analytics event, as they skip a page view.
      declinesTracking: trackingDeclinedUnder(app.analytics, (name) => c.req.header(name)),
    })
    const result = yield* Effect.result(program)
    return yield* awaitForm(() =>
      answerSubmission(c, { form, isJsonClient, answers: body, result, links })
    )
  })

/** The four form routes that take an answer, files included: each keeps the upload-sized body limit. */
const formUploadHandlers = (honoApp: Hono, app: App, renderers: Readonly<FormRenderers>) => {
  const submissionBody = {
    read: readSubmissionBody,
    readTableAsCaller: renderers.readTableAsCaller,
  }
  return {
    submit: acceptsUploadBody((c: Context) =>
      handlePostSubmission(rememberPageApp(c, honoApp), app, renderers.readTableAsCaller)
    ),
    draft: acceptsUploadBody((c: Context) => handlePostDraft(c, app, submissionBody)),
    edit: acceptsUploadBody((c: Context) => handleEditSubmission(c, app, submissionBody)),
    advance: acceptsUploadBody((c: Context) =>
      handlePostStepAdvance(c, app, renderers.readTableAsCaller)
    ),
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
  const uploads = formUploadHandlers(honoApp, app, renderers)
  const withCanonical = honoApp
    .get('/forms/:name', (c) => handleGetForm(c, app, renderers))
    .post('/api/forms/:name/submissions', uploads.submit)
    // Save and resume: keep a half-filled answer, mail its resume link.
    .post('/api/forms/:name/drafts', uploads.draft)
    // Edit after submit: the edit page, and the save (PUT, or POST from a native form).
    .get('/forms/:name/edit/:token', (c) =>
      handleGetEditPage(c, app, (form, editLink) =>
        respondWithForm(c, app, form, { renderers, editLink })
      )
    )
    .put('/api/forms/:name/submissions/edit/:token', uploads.edit)
    .post('/api/forms/:name/submissions/edit/:token', uploads.edit)
    // Multi-step navigation. Registered alongside the canonical submission
    // endpoint so the cross-validator's step-aware rules and the per-step
    // SSR share the same Hono app instance and access the same `app` payload.
    // Previous keeps the answers of the step it leaves (`keep`), unchecked.
    .post('/api/forms/:name/steps/:stepId/advance', uploads.advance)
    .post('/api/forms/:name/steps/:stepId/keep', keepStep(app, renderers.readTableAsCaller))
    // Draft reset backs `onSuccess: reset` on a multi-step form. Deliberately
    // NOT under `/steps/` — a form is free to declare a step whose id is
    // literally `reset`, and this must not be reachable by naming a step.
    .post('/api/forms/:name/draft/reset', (c) => handlePostDraftReset(c, app))
    .get('/api/forms/:name/steps/:stepId', (c) => handleGetStepFragment(c, app, renderers))

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
  // `form.path` in `presentation/api/middleware/api-auth-guards.ts`.
  // Without that, every caller here looks anonymous and the gate would
  // deny the users it is meant to admit.
  return forms.reduce<T>((acc, form) => {
    if (typeof form.path !== 'string') return acc
    return acc.get(form.path, (c) =>
      runFormProgram(
        c,
        Effect.suspend(() => {
          const resolved = findFormByName(app, form.name)
          return resolved ? respondWithForm(c, app, resolved, { renderers }) : answerNotFound(c)
        })
      )
    ) as T
  }, withCanonical as T)
}
