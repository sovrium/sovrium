/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { getUserRole } from '@/application/use-cases/tables/user-role'
import {
  evaluateFormAccess,
  type FormAccessDecision,
} from '@/domain/models/shared/form-access-flow'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import type { Form } from '@/domain/models/app/forms'
import type { Context } from 'hono'

export interface FormRequestSession {
  readonly userId: string
  readonly role: string
}

export async function resolveFormSession(c: Context): Promise<FormRequestSession | undefined> {
  const session = getSessionContext(c)
  if (!session) return undefined
  const role = await getUserRole(session.userId)
  return { userId: session.userId, role }
}

export async function evaluateFormAccessForRequest(
  c: Context,
  form: Readonly<Form>
): Promise<{
  readonly decision: FormAccessDecision
  readonly session: FormRequestSession | undefined
}> {
  const session = await resolveFormSession(c)
  const decision = evaluateFormAccess(form.access?.require, session)
  return { decision, session }
}

export function renderFormUnauthorizedHtml(formName: string, require: string): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>401 — authentication required</title></head><body><main class="form-access-denied" data-status="401"><p>Form "${formName}" requires ${require} access.</p></main></body></html>`
}

export type FormDenialMode = 'html' | 'json'

export function denyFormAccess(
  c: Context,
  formName: string,
  decision: FormAccessDecision,
  mode: FormDenialMode
): Response | Promise<Response> | undefined {
  if (decision.kind === 'allow') return undefined
  if (decision.kind === 'not-found') {
    return mode === 'json' ? c.json({ error: 'form_not_found' }, 404) : c.notFound()
  }
  return mode === 'json'
    ? c.json({ error: 'authentication required', form: formName, require: decision.require }, 401)
    : c.html(renderFormUnauthorizedHtml(formName, decision.require), 401)
}
