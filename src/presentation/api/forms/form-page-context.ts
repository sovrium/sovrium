/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a standalone form page reads of its request before it renders: the
 * prefill context, and the form as its caller may see it.
 */

import { findUserEmailById } from '@/application/use-cases/auth/find-user-email'
import { runDomainPromise } from '@/infrastructure/logging/request-effect'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import { formForReader } from '@/presentation/render/forms/form-ref-readers'
import type { FormRequestSession } from './access-gate'
import type { ReadTableAsCaller } from '@/application/ports/services/page-renderer'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'
import type { Context } from 'hono'

/**
 * Assemble the render-time prefill context from the request: all URL query
 * params back `$query.<name>`, and the authenticated user (when a session
 * is present) backs `$user.<prop>`. Anonymous requests yield `user:
 * undefined` so `$user.*` references resolve to empty rather than leaking
 * the literal token.
 */
export async function buildPrefillContext(c: Context): Promise<{
  readonly query: Readonly<Record<string, string>>
  readonly user?: Readonly<Record<string, unknown>>
}> {
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

/**
 * The form as this request's caller may see it — narrowed exactly as the same
 * form embedded in a page is (`formForReader`), from the table API's answer for
 * her: a field she may not read is left out, and on a table answering her no
 * permission map, every field she may neither read nor write. The form as
 * declared in an app without auth, on a table it does not declare, or where no
 * reader was injected.
 */
export async function formForCaller(
  c: Context,
  app: App,
  form: Readonly<Form>,
  ctx: {
    readonly session: FormRequestSession | undefined
    readonly read: ((c: Context) => ReadTableAsCaller) | undefined
  }
): Promise<Readonly<Form>> {
  const { table } = form.submitTo
  const { session, read } = ctx
  if (!app.auth || read === undefined || table === undefined) return form
  if (!(app.tables ?? []).some((candidate) => candidate.name === table)) return form
  const caller = session === undefined ? undefined : { userId: session.userId, role: session.role }
  return formForReader(form, app, await read(c)(app, table, caller))
}
