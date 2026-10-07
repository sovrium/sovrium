/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  FormClosedError,
  FormFieldConstraintError,
  FormFieldForeignKeyError,
  FormFieldFormatError,
  FormFieldRequiredError,
  FormHoneypotTrippedError,
  FormNotFoundError,
  FormNotYetOpenError,
  FormRateLimitedError,
  FormSubmissionLimitError,
} from '@/application/use-cases/forms/submit-form'
import { toSafeRedirectPath } from '@/domain/kernel/url/redirect-safety'
import { logError } from '@/infrastructure/logging/logger'
import {
  FormUploadError,
  FormUploadRefusedError,
} from '@/presentation/api/forms/file-upload-admission'
import { FieldValidationError } from '@/presentation/api/middleware/validation'
import {
  formClosed,
  formHoneypotTripped,
  formNotFound,
  formNotYetOpen,
  formRateLimited,
  formSubmissionLimitReached,
} from './submission-refusals'
import type { Context } from 'hono'

/*
 * The responses a form submission is answered with, shared by the submission
 * endpoint and the edit endpoint so a refused edit is answered exactly as a
 * refused first submission. (The body itself is read in `routes.ts`.)
 */

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
 * Resolve the redirect target for a native browser form submission: the
 * Referer's path and query, kept only when they are a same-origin path. Falls
 * back to `'/'` when no Referer was sent (some browsers strip it for
 * cross-origin posts) or when its path would leave the site — a Referer of
 * `https://host//evil.example/x` has the protocol-relative path
 * `//evil.example/x`. JSON clients never reach this branch — they get a 201 /
 * 422 JSON body.
 */
export function resolveSubmitRedirectTarget(c: Context): string {
  const referer = c.req.header('referer')
  if (typeof referer !== 'string' || referer === '') return '/'
  // Strip the origin so the redirect stays same-origin even if the reverse
  // proxy rewrote the Host header, then let the one redirect check decide.
  try {
    const url = new URL(referer)
    return toSafeRedirectPath(`${url.pathname}${url.search}`) ?? '/'
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
 * intended UX (the host record went away between page load and submit).
 */
export function respondParentMissing(c: Context, isJsonClient: boolean): Response {
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
    return formHoneypotTripped(c)
  }
  if (failure instanceof FormNotYetOpenError) {
    return formNotYetOpen(c, failure.opensAt)
  }
  if (failure instanceof FormClosedError) {
    return formClosed(c, failure.closedAt)
  }
  if (failure instanceof FormSubmissionLimitError) {
    return formSubmissionLimitReached(c, failure.maxSubmissions, failure.currentCount)
  }
  return undefined
}

/**
 * Map a field-level validation failure (required / format / FK / generic
 * `FieldValidationError`) to its 400 `respondValidation400` response. Returns
 * `undefined` when `failure` is not one of these so the caller falls through
 * to the upload / 422 branches. Extracted to keep `respondSubmissionFailure`
 * under the complexity cap as the field-error family grew.
 */
function respondFieldValidation400(
  c: Context,
  isJsonClient: boolean,
  failure: unknown
): Response | undefined {
  // Required-field semantics: a field-level validation failure
  // (form `required: true`, column `required: true`, or any other
  // field-rule rejection) is a 400 with a `fieldErrors` envelope. The
  // catch-all 422 branch is kept for genuine server-side rejections
  // (table-validation crashes, permissions, etc.).
  if (failure instanceof FormFieldRequiredError) {
    return respondValidation400(c, isJsonClient, failure.fieldName, failure.message)
  }
  // Server-side format validation (email).
  if (failure instanceof FormFieldFormatError) {
    return respondValidation400(c, isJsonClient, failure.fieldName, failure.message)
  }
  // FK violation on user-typed (or any FK) column.
  if (failure instanceof FormFieldForeignKeyError) {
    return respondValidation400(c, isJsonClient, failure.fieldName, failure.message)
  }
  // A unique / CHECK / NOT NULL refusal attributed to one submitted field.
  if (failure instanceof FormFieldConstraintError) {
    return respondValidation400(c, isJsonClient, failure.fieldName, failure.message)
  }
  if (failure instanceof FieldValidationError) {
    return respondValidation400(c, isJsonClient, failure.field ?? '', failure.message)
  }
  return undefined
}

/**
 * Map a file the server would not store, or could not store, to its response.
 * Returns `undefined` for any other failure.
 *
 * - A refused type (or a bucket rule other than size) is a 400 validation
 *   answer naming the field; a refused size is a 413 naming the field.
 * - A storage failure is the server's fault: 500 with a generic message. Its
 *   cause was logged where it happened, and never reaches the visitor.
 */
function respondUploadFailure(
  c: Context,
  isJsonClient: boolean,
  failure: unknown
): Response | undefined {
  if (failure instanceof FormUploadRefusedError) {
    if (failure.reason === 'type') {
      return respondValidation400(c, isJsonClient, failure.fieldName, failure.message)
    }
    const message = `${failure.fieldName} ${failure.message}`
    if (!isJsonClient)
      return c.html(renderSubmissionErrorHtml(message, '413 — file too large'), 413)
    const fieldErrors = [{ name: failure.fieldName, message: failure.message }]
    return c.json({ error: 'file_too_large', message, fieldErrors }, 413)
  }
  if (failure instanceof FormUploadError) {
    if (isJsonClient) return c.json({ error: 'upload_failed', message: failure.message }, 500)
    return c.html(renderSubmissionErrorHtml(failure.message, '500 — upload failed'), 500)
  }
  return undefined
}

export function respondSubmissionFailure(
  c: Context,
  isJsonClient: boolean,
  failure: unknown
): Response {
  if (failure instanceof FormNotFoundError) {
    return formNotFound(c)
  }
  // Rate-limit rejections
  // surface a HTTP 429 with a `Retry-After: <seconds>` header. The body
  // intentionally does NOT include the trip reason — leaking
  // `rate_limit_per_ip` vs `rate_limit_per_form` to the client tells an
  // attacker which knob to circumvent. The ledger row records the reason
  // for admin visibility.
  if (failure instanceof FormRateLimitedError) {
    return formRateLimited(c, failure.retryAfterSec)
  }
  // Availability + anti-spam
  // rejections produce structured 400/403 bodies callers key on.
  const structured = respondAvailability403(c, failure)
  if (structured !== undefined) return structured
  const fieldError = respondFieldValidation400(c, isJsonClient, failure)
  if (fieldError !== undefined) return fieldError
  const uploadFailure = respondUploadFailure(c, isJsonClient, failure)
  if (uploadFailure !== undefined) return uploadFailure
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
export function respondSubmissionSuccess(
  c: Context,
  isJsonClient: boolean,
  result: {
    readonly submissionId: string | null
    readonly linkedRecordId: string | null
    readonly record: Readonly<Record<string, unknown>>
    /** The private edit link, for a form that declares . */
    readonly editUrl?: string
  }
): Response {
  if (isJsonClient) {
    return c.json(
      {
        submissionId: result.submissionId,
        linkedRecordId: result.linkedRecordId,
        record: result.record,
        ...(result.editUrl === undefined ? {} : { editUrl: result.editUrl }),
      },
      201
    )
  }
  return c.redirect(resolveSubmitRedirectTarget(c), 303)
}

/**
 * Multipart submissions from the inline form runtime AND from
 * programmatic clients (test fixtures, third-party API consumers) want a
 * JSON response. Detect them alongside the application/json branch so
 * the Referer-based redirect is reserved for `<form action>` posts that
 * never set Accept and therefore truly want HTML navigation back to the
 * host page.
 */
export function detectJsonClient(c: Context): boolean {
  const contentType = c.req.header('content-type') ?? ''
  const acceptHeader = c.req.header('accept') ?? ''
  return (
    contentType.includes('application/json') ||
    contentType.includes('multipart/form-data') ||
    acceptHeader.includes('application/json')
  )
}
