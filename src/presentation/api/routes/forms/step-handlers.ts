/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
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
const DRAFT_COOKIE_MAX_AGE_SECONDS = 30 * 60

export interface StepFragmentRenderer {
  readonly renderStepFragment: (
    app: Readonly<App>,
    form: Readonly<Form>,
    stepId: string,
    draftValues: Readonly<Record<string, unknown>>
  ) => string
}

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

async function readJsonBody(c: Context): Promise<Record<string, unknown>> {
  const json = await c.req.json().catch(() => undefined)
  return ((json as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>
}

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
  const nextStepId = resolveNextStepId(form, stepId, valueMap)
  const nextStepResolved =
    nextStepId !== undefined &&
    (() => {
      const target = findStep(form, nextStepId)
      return target !== undefined && isStepVisible(target, valueMap)
    })()

  return c.json({
    nextStepId: nextStepResolved ? nextStepId : null,
  })
}
