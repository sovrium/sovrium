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
import { generateDraftSessionId, mergeDraft, readDraft } from './step-draft-store'
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
 */
export async function handlePostStepAdvance(c: Context, app: App): Promise<Response> {
  const name = c.req.param('name')
  const stepId = c.req.param('stepId')
  if (!name || !stepId) return c.notFound()
  const form = findFormByName(app, name)
  if (!form) return c.notFound()
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

  const valueMap = buildConditionValueMap(form, merged)
  // Skipped-step guard: do not advance into a step whose visibleWhen
  // evaluates false. The resolver already takes care of linear fall-
  // through, so this is just a defensive null-check on top of that.
  const nextStepId = resolveNextStepId(form, stepId, valueMap)
  const nextStepResolved =
    nextStepId !== undefined &&
    (() => {
      const target = findStep(form, nextStepId)
      return target !== undefined && isStepVisible(target, valueMap)
    })()

  return c.json({
    // eslint-disable-next-line unicorn/no-null -- public contract: null when the supplied step is the last visible step
    nextStepId: nextStepResolved ? nextStepId : null,
  })
}
