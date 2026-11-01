/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { identifyRequester } from '@/application/use-cases/automations/requester-identity'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { holdsRequiredRole } from '@/domain/models/app/automations/manual-trigger-role-service'
import { presentsApiKeyOnly } from '@/presentation/api/middleware/request-credential'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import type { Trigger } from './webhook-methods'
import type { TriggerRequester } from '@/application/use-cases/automations/resolve-trigger-data'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

type WebhookTrigger = Extract<Trigger, { type: 'webhook' }>

/**
 * Who called a webhook, read from the request's credential (the session the
 * extract-only auth middleware resolved from a session cookie or a user's
 * `x-api-key`), never from the body, with the email and the name its account
 * holds. `undefined` for an anonymous call, which includes a key nobody minted.
 *
 * Only a `session` webhook takes its caller from a session cookie. Any other
 * webhook is meant to be called by another system, and a browser sends the
 * cookie with every request it makes to the app, a link another site opened
 * included: read there, the cookie would make whoever followed the link the
 * author of the run, with her connections and her permissions. On those
 * webhooks only a request presenting a key and no cookie names its caller.
 */
export const resolveWebhookCaller = (c: Context, app: App, trigger: WebhookTrigger) =>
  Effect.gen(function* () {
    if (trigger.auth?.type !== 'session' && !presentsApiKeyOnly(c)) return undefined
    const session = getSessionContext(c)
    if (session === undefined) return undefined
    const role = yield* getUserRole(session.userId, app)
    return yield* identifyRequester({ id: session.userId, role })
  })

/**
 * Whether a `session` webhook refuses this caller: nobody signed in, or a
 * caller without the declared `requiredRole` (judged as a manual trigger's).
 * Every other auth type is judged by `runWebhookAuth`, so this admits it.
 * The refusal is answered 404 before any run row exists (anti-enumeration).
 */
export const sessionWebhookRefuses = (
  trigger: WebhookTrigger,
  app: App,
  caller: TriggerRequester | undefined
): boolean => {
  const { auth } = trigger
  if (auth?.type !== 'session') return false
  if (caller === undefined) return true
  return auth.requiredRole !== undefined && !holdsRequiredRole(auth.requiredRole, app, caller.role)
}
