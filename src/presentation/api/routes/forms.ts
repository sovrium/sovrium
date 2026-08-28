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
import { evaluateAvailabilityWindow } from '@/domain/models/shared/form-availability-flow'
import { hashIp, readIpHashSalt } from '@/infrastructure/forms/ip-hash'
import { logError } from '@/infrastructure/logging/logger'
import { runRequestEffect } from '@/infrastructure/logging/request-effect'
import { getRequestClientIp } from '@/presentation/api/middleware/client-ip'
import { FieldValidationError } from '@/presentation/api/middleware/validation'
import {
  denyFormAccess,
  evaluateFormAccessForRequest,
} from '@/presentation/api/routes/forms/access-gate'
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
  readonly renderStepFragment: (
    app: Readonly<App>,
    form: Readonly<Form>,
    stepId: string,
    draftValues: Readonly<Record<string, unknown>>
  ) => string
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
    opensAt?: string
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
 * [internal ref]: `authenticated` denials get a 401
 * page referencing the form name + access level; role denials get a 404
 * (S1 anti-enumeration), never a 403.
 */
async function respondWithForm(
  c: Context,
  app: App,
  form: Readonly<Form>,
  renderers: FormRenderers
): Promise<Response> {
  const { decision } = await evaluateFormAccessForRequest(c, form)
  const denied = denyFormAccess(c, form.name, decision, 'html')
  if (denied !== undefined) return denied
  const activeLang = c.req.query('lang')
  // [internal ref]: render the closed-form UI (no submit button)
  // when the availability window has not yet opened or has already closed.
  // A closed form is a page the visitor is meant to read, so this is a 200 —
  // only the submission endpoint answers 403.
  const windowState = evaluateAvailabilityWindow(form.availability, Date.now())
  if (windowState.kind === 'not-yet-open') {
    return c.html(renderers.renderClosedForm(app, form, 'not-yet-open', windowState.opensAt))
  }
  if (windowState.kind === 'closed') {
    return c.html(renderers.renderClosedForm(app, form, 'closed'))
  }
  return c.html(renderers.renderForm(app, form, activeLang, await buildPrefillContext(c)))
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
  return respondWithForm(c, app, form, renderers)
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
  const email = await findUserEmailById(session.userId)
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
 * Render a minimal HTML error page when a native browser form submission
 * fails. The user agent navigates to the API endpoint when the form posts
 * via `<form action="/api/forms/.../submissions">`, so a JSON body would
 * surface as raw text in the address bar; an HTML page with a clear error
 * message is far friendlier and lets the test assertions key on visible
 * text (`getByText(/parent.*does not exist|422/i)`).
 *
 * The status code is exposed via `data-status` and the page title; the
 * single visible element is a `<p>` carrying the error message itself.
 * Keeping the visible text to one element avoids strict-mode locator
 * collisions when assertions match multiple substrings (e.g. `/422|parent
 * does not exist/i` would otherwise resolve to both an `<h1>` and a `<p>`).
 *
 * Kept inline (no template engine) because the foundation tier renders
 * simple, untranslated text. A follow-up tier can route this through the
 * theme and i18n systems once an inline-create error UX needs more polish.
 */
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

/**
 * Resolve the redirect target for a native browser form submission. Falls
 * back to `'/'` when no Referer was sent (some browsers strip it for
 * cross-origin posts) so the user lands on a working page rather than
 * the API JSON response. JSON clients never reach this branch — they get
 * a 201 / 422 JSON body.
 */
function resolveSubmitRedirectTarget(c: Context): string {
  const referer = c.req.header('referer')
  if (typeof referer !== 'string' || referer === '') return '/'
  // Strip the origin so the redirect stays same-origin even if the reverse
  // proxy rewrote the Host header. Safe because the `referer` header
  // always carries a fully-qualified URL when present.
  try {
    const url = new URL(referer)
    return `${url.pathname}${url.search}`
  } catch {
    return '/'
  }
}

/**
 * Build a parent-missing 422 response. Branches on the client's
 * `Content-Type` so JSON callers get `{ error, message }` while native
 * browser form submits get the inline-create error HTML page.
 *
 * Defense-in-depth: the response intentionally does NOT echo the submitted
 * `paramValue` back. The submitter already knows the value they sent, so
 * including it carries no UX benefit, and surfacing it in a 422 body would
 * make this endpoint a small enumeration oracle for any future auth-gated
 * inline-create flow ("did the host record exist at submit time?"). The
 * generic "parent record does not exist" message is sufficient for the
 * intended UX (host record was deleted between page load and submit).
 */
function respondParentMissing(c: Context, isJsonClient: boolean): Response {
  const message =
    'Parent record does not exist. The host record may have been deleted between page load and form submission.'
  if (isJsonClient) return c.json({ error: 'parent_missing', message }, 422)
  return c.html(renderSubmissionErrorHtml(message, '422 — parent does not exist'), 422)
}

/**
 * Render a validation 400 (form-level required, column-level required, or
 * other field-rule rejection). All three shapes share the same response
 * envelope so client-side UIs can consume one path.
 */
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

/**
 * Map an availability / anti-spam rejection to its structured response.
 * Returns `undefined` when `failure` is not one of these errors so the caller
 * can fall through to the other failure branches. Extracted from
 * `respondSubmissionFailure` to keep that function under the complexity cap.
 *
 * - honeypot → 400 `{ error: 'invalid request' }`
 * - not-yet-open / closed / cap → 403
 */
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

/**
 * Map a field-level validation failure (required / format / FK / generic
 * `FieldValidationError`) to its 400 `respondValidation400` response. Returns
 * `undefined` when `failure` is not one of these so the caller falls through
 * to the upload / 422 branches. Extracted to keep `respondSubmissionFailure`
 * under the complexity cap as the field-error family grew with Bug 3 + Bug 5.
 */
function respondFieldValidation400(
  c: Context,
  isJsonClient: boolean,
  failure: unknown
): Response | undefined {
  // F-11 / required-field semantics: a field-level validation failure
  // (form `required: true`, column `required: true`, or any other
  // field-rule rejection) is a 400 with a `fieldErrors` envelope. The
  // catch-all 422 branch is kept for genuine server-side rejections
  // (table-validation crashes, permissions, etc.).
  if (failure instanceof FormFieldRequiredError) {
    return respondValidation400(c, isJsonClient, failure.fieldName, failure.message)
  }
  // Bug 5 / [internal ref]: server-side format validation (email).
  if (failure instanceof FormFieldFormatError) {
    return respondValidation400(c, isJsonClient, failure.fieldName, failure.message)
  }
  // Bug 3 / [internal ref]: FK violation on user-typed (or any FK) column.
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
  // [internal ref]: rate-limit rejections
  // surface a HTTP 429 with a `Retry-After: <seconds>` header. The body
  // intentionally does NOT include the trip reason — leaking
  // `rate_limit_per_ip` vs `rate_limit_per_form` to the client tells an
  // attacker which knob to circumvent. The ledger row records the reason
  // for admin visibility.
  if (failure instanceof FormRateLimitedError) {
    return c.json({ error: 'rate limit exceeded' }, 429, {
      'Retry-After': String(failure.retryAfterSec),
    })
  }
  // [internal ref]: availability + anti-spam
  // rejections produce structured 400/403 bodies callers key on.
  const structured = respondAvailability403(c, failure)
  if (structured !== undefined) return structured
  const fieldError = respondFieldValidation400(c, isJsonClient, failure)
  if (fieldError !== undefined) return fieldError
  if (failure instanceof FormUploadError) {
    if (isJsonClient) return c.json({ error: 'upload_failed', message: failure.message }, 400)
    return c.html(renderSubmissionErrorHtml(failure.message, '400 — upload failed'), 400)
  }
  const message = failure instanceof Error ? failure.message : String(failure)
  // Log failures to stderr so DEBUG=sovrium:server runs surface them; the
  // raw `failure` is included so test debugging can see the underlying
  // Effect tagged error chain (FormSubmissionError / TableValidationError).
  logError(`[forms] submission rejected: ${message}`, failure)
  if (isJsonClient) return c.json({ error: 'submission_invalid', message }, 422)
  return c.html(renderSubmissionErrorHtml(message, '422 — submission rejected'), 422)
}

/**
 * Build the success response: JSON `{ submissionId, linkedRecordId, record }`
 * for programmatic callers, 303 redirect to the Referer for native form
 * submits (so the browser navigates back to the host page).
 *
 * `record` carries ONLY the submitter-supplied bound-table columns (see
 * `SubmitFormResult`) so the client runtime can interpolate `$record.<column>`
 * into `onSuccess.redirect.url` without exposing any
 * server-computed / privileged column.
 */
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

/**
 * F-11: multipart submissions from the inline form runtime AND from
 * programmatic clients (test fixtures, third-party API consumers) want a
 * JSON response. Detect them alongside the application/json branch so
 * the Referer-based redirect is reserved for `<form action>` posts that
 * never set Accept and therefore truly want HTML navigation back to the
 * host page.
 */
function detectJsonClient(c: Context): boolean {
  const contentType = c.req.header('content-type') ?? ''
  const acceptHeader = c.req.header('accept') ?? ''
  return (
    contentType.includes('application/json') ||
    contentType.includes('multipart/form-data') ||
    acceptHeader.includes('application/json')
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
  if (!name) return c.json({ error: 'form_name_required' }, 400)
  const form = findFormByName(app, name)
  if (!form) return c.json({ error: 'form_not_found' }, 404)

  // [internal ref]: enforce the form access gate before reading the
  // body. `authenticated` denial → 401; role denial → 404 (anti-enumeration).
  const { decision, session } = await evaluateFormAccessForRequest(c, form)
  const denied = denyFormAccess(c, form.name, decision, 'json')
  if (denied !== undefined) return denied

  const rawBody = await readSubmissionBody(c)
  // F-11 (file-uploads): Multipart bodies may carry `File` instances on
  // attachment fields. Upload each one to the form's resolved bucket and
  // replace the raw File with canonical `{ url, name, size, mimeType }`
  // metadata BEFORE the inline-prefill revalidation pass and the bound-
  // table write. JSON / urlencoded bodies pass through untouched.
  const uploadResult = await runRequestEffect(
    c,
    provideFormsLive(transformMultipartFiles(app, form, rawBody)).pipe(Effect.result)
  )
  if (uploadResult._tag === 'Failure') {
    return respondSubmissionFailure(c, isJsonClient, uploadResult.failure)
  }

  // Y-5: Inline-prefill revalidation runs after the upload step so a
  // deleted parent record short-circuits the submission AFTER the file
  // bytes have been persisted (acceptable: the pre-uploaded files become
  // orphaned but the audit ledger row never lands).
  const referer = c.req.header('referer')
  const revalidation = await runRequestEffect(
    c,
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
    body: uploadResult.success,
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
  /** Authenticated submitter id; captured on the ledger row. */
  readonly submitterUserId?: string
}

/**
 * Run the `submitFormProgram` Effect and convert the result to the right
 * HTTP response. Extracted from `handlePostSubmission` to keep both
 * functions under the project's complexity caps.
 */
async function runSubmitProgram(config: Readonly<RunSubmitProgramConfig>): Promise<Response> {
  const { c, app, formName, body, isJsonClient, submitterUserId } = config
  const ipAddress = getRequestClientIp(c)
  const userAgent = c.req.header('user-agent')
  const query = c.req.query() as Record<string, string>
  // [internal ref] + S5: hash-on-write at the route boundary so the raw IP
  // is bounded to the rate-limiter's volatile in-memory state and never
  // crosses into the application layer or persistence. When the request
  // arrives without an IP (no X-Forwarded-For / X-Real-IP), hash the empty
  // string against the same salt so the ledger column stays populated
  // (64 hex chars guaranteed) and anonymous traffic shares a stable
  // rate-limit bucket.
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
  const result = await runRequestEffect(c, provideFormsLive(program).pipe(Effect.result))
  if (result._tag === 'Failure') {
    return respondSubmissionFailure(c, isJsonClient, result.failure)
  }
  return respondSubmissionSuccess(c, isJsonClient, result.success)
}

/**
 * Chain the form routes onto the parent Hono app.
 *
 * Registers:
 *   GET  /forms/:name              → render form HTML
 *   GET  /forms/:name/embed        → render embed variant
 *   POST /api/forms/:name/submissions → write submission
 *
 * When a form declares a custom `path`, that path is also registered
 * as an alias for the canonical GET. The order matters: more specific
 * paths (`/forms/:name/embed`) are registered before less specific
 * (`/forms/:name`) so Hono resolves them correctly.
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
    // Multi-step navigation. Registered alongside the canonical submission
    // endpoint so the cross-validator's step-aware rules and the per-step
    // SSR share the same Hono app instance and access the same `app` payload.
    .post('/api/forms/:name/steps/:stepId/advance', (c) => handlePostStepAdvance(c, app))
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
      return respondWithForm(c, app, resolved, renderers)
    }) as T
  }, withCanonical as T)
}
