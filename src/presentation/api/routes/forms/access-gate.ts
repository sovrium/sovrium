/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The single form access gate, shared by every route that can reach a form.
 *
 * A form is addressable through more than one doorway: the canonical
 * `GET /forms/:name`, the optional custom `path` alias, the submission
 * endpoint, and the two multi-step endpoints. Each is an independent way in,
 * and each has to make the SAME access decision — a gate that lives in only
 * one handler is a gate the other doorways walk around.
 *
 * This module exists so that decision has exactly one implementation. It is
 * deliberately not copied into the step handlers: a copy is how the next
 * doorway ends up ungated.
 */

import { getUserRole } from '@/application/use-cases/tables/user-role'
import {
  evaluateFormAccess,
  type FormAccessDecision,
} from '@/domain/models/shared/form-access-flow'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import type { Form } from '@/domain/models/app/forms'
import type { Context } from 'hono'

/** Session resolved for a form request, with the caller's global role. */
export interface FormRequestSession {
  readonly userId: string
  readonly role: string
}

/**
 * Resolve the request's session with its global role (looked up via
 * `getUserRole`). Returns `undefined` for anonymous requests — and also for
 * any request that never passed through `authMiddleware`, which is why the
 * middleware has to be mounted on every route that reaches a form.
 */
export async function resolveFormSession(c: Context): Promise<FormRequestSession | undefined> {
  const session = getSessionContext(c)
  if (!session) return undefined
  const role = await getUserRole(session.userId)
  return { userId: session.userId, role }
}

/**
 * Evaluate a form's `access.require` for the current request. Returns the
 * resolved session (when present) alongside the access decision so the
 * caller can both gate the request and capture the submitter identity.
 */
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

/**
 * Render a minimal HTML 401 page for an access-gated form. The body
 * references the form name and the required access level so the
 * [internal ref] assertions (`/feedback/` + `/authenticated/`) match.
 */
export function renderFormUnauthorizedHtml(formName: string, require: string): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>401 — authentication required</title></head><body><main class="form-access-denied" data-status="401"><p>Form "${formName}" requires ${require} access.</p></main></body></html>`
}

/** Response shape a denied caller should receive on a given endpoint. */
export type FormDenialMode = 'html' | 'json'

/**
 * Convert a non-allow access decision into its HTTP response, or return
 * `undefined` when the caller is allowed through.
 *
 * One function for every doorway, so the denial semantics cannot drift
 * between them:
 *
 *   - `require: 'authenticated'` denial → **401** (an auth challenge: "log
 *     in to use this")
 *   - role denial, including an anonymous caller hitting a role gate →
 *     **404**, never 403. S1 anti-enumeration: a role-restricted form must
 *     not be discoverable by the very users it excludes, and a 403 would
 *     confirm it exists.
 *
 * `Promise<Response>` rides in the return union because Hono's `c.html`
 * is typed for streaming (async) bodies; every caller is an async handler
 * that awaits it on return.
 */
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
