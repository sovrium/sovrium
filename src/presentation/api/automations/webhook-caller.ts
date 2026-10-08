/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { getUserRole } from '@/application/use-cases/tables/user-role'
import { holdsRequiredRole } from '@/domain/models/app/automations/manual-trigger-role-service'
import { runDomainPromise } from '@/infrastructure/logging/request-effect'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import type { Trigger } from './webhook-methods'
import type { TriggerRequester } from '@/application/use-cases/automations/resolve-trigger-data'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

type WebhookTrigger = Extract<Trigger, { type: 'webhook' }>

/**
 * Who called a webhook, read from the request's credential — the session the
 * extract-only auth middleware resolved from a session cookie or a user's
 * `x-api-key` — never from the body. `undefined` for an anonymous call, which
 * includes a key nobody minted.
 */
export const resolveWebhookCaller = async (
  c: Context,
  app: App
): Promise<TriggerRequester | undefined> => {
  const session = getSessionContext(c)
  if (session === undefined) return undefined
  const role = await runDomainPromise(c, getUserRole(session.userId, app))
  return { id: session.userId, role }
}

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
