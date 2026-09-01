/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Multi-step form route handlers.
 *
 * Endpoints (registered in `presentation/api/routes/forms.ts`):
 *
 *   GET  /api/forms/:name/steps/:stepId
 *     Returns the step's HTML fragment with prefilled values from the
 *     per-session draft store. Backs the Previous button and any deep
 *     link to a non-first step.
 *
 *   POST /api/forms/:name/draft/reset
 *     Replaces the per-session draft with the posted values, discarding
 *     everything else the submitter had entered. Backs `onSuccess: reset`
 *     on a multi-step form: the flow restarts at step 1, and only the
 *     `preserveFields` values keep prefilling later steps.
 *
 *   POST /api/forms/:name/steps/:stepId/advance
 *     Validates the current step's required + visible fields, merges the
 *     submitted values into the per-session draft, evaluates `goToWhen`
 *     rules to decide the next step, and returns `{ nextStepId }` JSON.
 *     `nextStepId` is `null` when the supplied step is already the last
 *     visible step (the runtime then shows the Submit button).
 *
 * The draft store lives in `./step-draft-store.ts` and is keyed by a
 * `sovrium_form_draft` cookie set on first advance. The session id is
 * generated per-form-flow; the cookie is HttpOnly + SameSite=Lax + a
 * 30-minute max-age so a user does not strand someone else's draft on
 * a shared workstation.
 */

import { getCookie, setCookie } from 'hono/cookie'
import { findFormByName } from '@/application/use-cases/forms/submit-form'
import {
  buildConditionValueMap,
  fieldSubmitIdentifier,
  isAbsentValue,
  isFieldRequired,
  isFieldVisible,
} from '@/domain/models/shared/form-field-helpers'
import { findStep, resolveNextStepId, isStepVisible } from '@/domain/models/shared/multi-step-flow'
import { denyFormAccess, evaluateFormAccessForRequest } from './access-gate'
import { generateDraftSessionId, mergeDraft, readDraft, replaceDraft } from './step-draft-store'
import type { App } from '@/domain/models/app'
import type { Form, FormField } from '@/domain/models/app/forms'
import type { Context } from 'hono'

const DRAFT_COOKIE_NAME = 'sovrium_form_draft'
const DRAFT_COOKIE_MAX_AGE_SECONDS = 30 * 60 // 30 minutes

/**
 * Renderer callback injected by the server-startup wiring. The route
 * cannot import directly from `presentation-rendering` under the layer
 * boundaries, so the infrastructure layer composes the route registration
 * with the rendering function it imports legally.
 */
export interface StepFragmentRenderer {
  readonly renderStepFragment: (
    app: Readonly<App>,
    form: Readonly<Form>,
    stepId: string,
    draftValues: Readonly<Record<string, unknown>>
  ) => string
}

/**
 * Read or create the per-submitter draft session id. The cookie is set
 * lazily so a GET that lands on the form before any advance does not
 * create an empty draft.
 */
function ensureDraftSession(c: Context): string {
  const existing = getCookie(c, DRAFT_COOKIE_NAME)
  if (typeof existing === 'string' && existing.length > 0) return existing
  const fresh = generateDraftSessionId()
  setCookie(c, DRAFT_COOKIE_NAME, fresh, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: DRAFT_COOKIE_MAX_AGE_SECONDS,
  })
  return fresh
}

/**
 * Validate required + visible fields belonging to the supplied step.
 * Returns the first offending field's identifier, or undefined when all
 * fields pass. Mirrors `checkFormRequiredFields` in `submit-form.ts` but
 * scoped to a single step's `step.fields[]` registry.
 */
function findFirstStepValidationError(
  form: Readonly<Form>,
  stepFields: ReadonlyArray<string>,
  body: Readonly<Record<string, unknown>>
): string | undefined {
  const values = buildConditionValueMap(form, body)
  const declared = new Map(
    form.fields
      .map((f) => [fieldSubmitIdentifier(f), f] as const)
      .filter(([id]) => id !== undefined) as ReadonlyArray<readonly [string, FormField]>
  )
  return stepFields.reduce<string | undefined>((acc, fieldName) => {
    if (acc !== undefined) return acc
    const field = declared.get(fieldName)
    if (field === undefined) return undefined
    if (!isFieldVisible(field, values)) return undefined
    if (!isFieldRequired(field, values)) return undefined
    if (!(fieldName in body) || isAbsentValue(body[fieldName])) return fieldName
    return undefined
  }, undefined)
}

/**
 * Read the JSON body posted by the runtime's advance fetch. Falls back
 * to an empty object when the body is missing or malformed.
 */
async function readJsonBody(c: Context): Promise<Record<string, unknown>> {
  const json = await c.req.json().catch(() => undefined)
  return ((json as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>
}

/**
 * `GET /api/forms/:name/steps/:stepId` — render the step's HTML
 * fragment with prefilled values from the per-session draft. Returns
 * 404 when the form or the step is not registered.
 *
 * [internal ref]: this endpoint serves the gated form's own inputs, so it
 * enforces the form's `access.require` exactly as the canonical route
 * does. A status-only gate would not be enough here — the endpoint answers
 * with a bare fragment, so the denial must also carry none of the step.
 */
export async function handleGetStepFragment(
  c: Context,
  app: App,
  renderer: StepFragmentRenderer
): Promise<Response> {
  const name = c.req.param('name')
  const stepId = c.req.param('stepId')
  if (!name || !stepId) return c.notFound()
  const form = findFormByName(app, name)
  if (!form) return c.notFound()
  const { decision } = await evaluateFormAccessForRequest(c, form)
  const denied = denyFormAccess(c, form.name, decision, 'html')
  if (denied !== undefined) return denied
  const step = findStep(form, stepId)
  if (!step) return c.notFound()
  const sessionId = ensureDraftSession(c)
  const draft = readDraft(sessionId, name)
  const html = renderer.renderStepFragment(app, form, stepId, draft)
  return c.html(html)
}

/**
 * `POST /api/forms/:name/steps/:stepId/advance` — validate the current
 * step, merge values into the draft, and resolve the next step id via
 * `goToWhen` rules (or linear fallthrough). Returns:
 *   - 400 `{ error, message, fieldErrors }` when a required+visible
 *     field is empty.
 *   - 200 `{ nextStepId }` on success. `nextStepId` is `null` when the
 *     supplied step was already the last visible step.
 *   - 404 when the form or step is not registered.
 *
 * [internal ref]: gated by the form's `access.require` before anything is
 * read or merged. The response body reveals the flow's step graph, so a
 * denied caller must not reach the resolver.
 */
export async function handlePostStepAdvance(c: Context, app: App): Promise<Response> {
  const name = c.req.param('name')
  const stepId = c.req.param('stepId')
  if (!name || !stepId) return c.notFound()
  const form = findFormByName(app, name)
  if (!form) return c.notFound()
  const { decision } = await evaluateFormAccessForRequest(c, form)
  const denied = denyFormAccess(c, form.name, decision, 'json')
  if (denied !== undefined) return denied
  const step = findStep(form, stepId)
  if (!step) return c.notFound()

  const body = await readJsonBody(c)
  const sessionId = ensureDraftSession(c)
  const draft = readDraft(sessionId, name)
  const merged = { ...draft, ...body }

  const offending = findFirstStepValidationError(form, step.fields, merged)
  if (offending !== undefined) {
    const message = `${offending} is required`
    return c.json(
      {
        error: 'validation_failed',
        message,
        fieldErrors: [{ name: offending, message }],
      },
      400
    )
  }

  mergeDraft(sessionId, name, body)

  return c.json({
    // eslint-disable-next-line unicorn/no-null -- public contract: null when the supplied step is the last visible step
    nextStepId: resolveVisibleNextStepId(form, stepId, merged) ?? null,
  })
}

/**
 * Resolve the id of the next step the submitter should see, or `undefined`
 * when the supplied step was already the last visible one.
 *
 * Applies the skipped-step guard: never advance into a step whose
 * `visibleWhen` evaluates false. The resolver already handles linear
 * fall-through, so this is a defensive check on top of that.
 */
function resolveVisibleNextStepId(
  form: Readonly<Form>,
  stepId: string,
  merged: Readonly<Record<string, unknown>>
): string | undefined {
  const valueMap = buildConditionValueMap(form, merged)
  const nextStepId = resolveNextStepId(form, stepId, valueMap)
  if (nextStepId === undefined) return undefined
  const target = findStep(form, nextStepId)
  if (target === undefined || !isStepVisible(target, valueMap)) return undefined
  return nextStepId
}

/**
 * `POST /api/forms/:name/draft/reset` — replace the per-session draft with
 * the posted values. Returns 204 on success, 404 when the form is not
 * registered.
 *
 * The client posts the values its `onSuccess.preserveFields` names, read off
 * the DOM before the flow is rewound. Everything else is dropped: without
 * this the submitter restarts at step 1 but every later step still prefills
 * from the submission they just completed, so a "reset" form quietly
 * re-proposes the previous answers.
 *
 * Gated by the form's `access.require` exactly as the sibling step endpoints
 * are — it writes state keyed to the caller's own draft cookie, and a denied
 * caller must not reach it.
 */
export async function handlePostDraftReset(c: Context, app: App): Promise<Response> {
  const name = c.req.param('name')
  if (!name) return c.notFound()
  const form = findFormByName(app, name)
  if (!form) return c.notFound()
  const { decision } = await evaluateFormAccessForRequest(c, form)
  const denied = denyFormAccess(c, form.name, decision, 'json')
  if (denied !== undefined) return denied

  const body = await readJsonBody(c)
  replaceDraft(ensureDraftSession(c), name, body)
  // eslint-disable-next-line unicorn/no-null -- Hono's 204 helper requires an explicit null body; `undefined` emits a body on a status that forbids one
  return c.body(null, 204)
}

/**
 * Fold the per-session step draft UNDER a multi-step form's final submission
 * body.
 *
 * A multi-step form renders exactly one step at a time — earlier steps are
 * REPLACED in the DOM, not hidden — so the browser's final submit carries only
 * the last step's inputs. Every answer from every earlier step is simply not in
 * the payload, and the submission is rejected for a required field the
 * submitter did fill. (This never surfaced because the shipped multi-step
 * specs post a complete payload straight to the submissions endpoint, skipping
 * the browser entirely; the browser path had no coverage.)
 *
 * The draft is already the accumulated flow — it is what `goToWhen` branches
 * on and what later steps prefill from — so it is the natural place to recover
 * those values. The posted body wins on every key: the visible step is the
 * submitter's most recent word, and a value they just changed must not be
 * overwritten by the copy the draft recorded on the way through.
 *
 * Scoped to stepped forms and further limited by the cookie: only the step
 * endpoints ever write a draft, and a caller that posts a complete payload
 * without walking the flow has no draft cookie, so this is a no-op for them.
 * The cookie is READ, never created — a submission is not a reason to open a
 * draft session.
 */
export function mergeStepDraftIntoBody(
  c: Context,
  form: Readonly<Form>,
  formName: string,
  body: Record<string, unknown>
): Record<string, unknown> {
  if (form.steps === undefined || form.steps.length === 0) return body
  const sessionId = getCookie(c, DRAFT_COOKIE_NAME)
  if (typeof sessionId !== 'string' || sessionId.length === 0) return body
  return { ...readDraft(sessionId, formName), ...body }
}
