/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The two config-INTROSPECTION endpoints authorised by [internal ref] amendment A1
 * (2026-08-14):
 *
 *  - `GET /api/admin/config/schema` — the live `App` object, secrets redacted.
 *  - `GET /api/admin/env`           — the declared `app.env[]` variables and
 *                                     whether this instance resolved each one.
 *
 * A1's invariant: *reading the running configuration is observability; mutating
 * it is authoring.* It authorises exactly these two surfaces and bounds them
 * exhaustively — no edit affordance, no write endpoint, no draft, no version
 * ledger, no history, no diff, no preview. That bound is why this module has two
 * GET handlers and no request schemas: there is nothing a caller can send.
 *
 * Redaction is a CONDITION of the authorisation, not a quality concern: A1 rules
 * that "a config-reflection endpoint that leaks a secret is not a defective
 * implementation of an authorised surface, it is an unauthorised surface". It
 * therefore happens SERVER-SIDE, before serialisation — masking in the UI would
 * not do, because the payload is the boundary an operator's browser, any
 * intermediary proxy, and the error tracker all see.
 *
 * Anti-enumeration 404 (S1) is wired upstream by `requireAdminTier()` in
 * `infrastructure/server/route-setup/api-routes.ts`, which 404s both
 * missing-session and wrong-role callers — a 401/403 would confirm that this
 * instance will hand a whole config to whoever gets a session.
 */

import { emitAuditEvent } from '@/application/use-cases/admin/audit-log/emit'
import { buildEnvVarStatuses } from '@/application/use-cases/admin/config/env-status'
import { redactAppConfigForReflection } from '@/application/use-cases/admin/config/redact-app-config'
import { resolveActor } from '@/application/use-cases/admin/resolve-actor'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import { configSchemaResponseSchema } from '@/domain/models/api/admin/config'
import { envConfigResponseSchema } from '@/domain/models/api/admin/env'
import type { App } from '@/domain/models/app'
import type { ContextWithSession } from '@/presentation/api/middleware/auth'
import type { Context, Hono } from 'hono'

/* eslint-disable functional/no-expression-statements -- request-handler code: the audit emit and the response-header set are intentional side-effects in a Hono handler, matching the sibling admin read handlers. */

/**
 * Emit the read's audit entry.
 *
 * A full config reflection is the broadest read available against this
 * instance, so "who read the whole config, and when" has to be answerable after
 * the fact. Severity stays `info` / result `success` — a READ is not an incident
 * — but the actor is the point, so the emit is never skipped.
 */
async function auditRead(c: Context, action: string): Promise<void> {
  const { session } = (c as ContextWithSession).var
  if (!session) return
  const actor = await resolveActor(session.userId)
  await emitAuditEvent({
    action,
    actor,
    // The running configuration is the single entity both reads target, so the
    // caller's id is what makes the entry filterable per operator.
    resourceId: session.userId,
    severity: 'info',
    result: 'success',
  })
}

/**
 * `GET /api/admin/config/schema` — the live `App` the instance booted from,
 * after server-side redaction.
 *
 * `generatedAt` is per-request (unlike `config/version.startedAt`, which
 * timestamps the process) because it timestamps the READ: an operator comparing
 * two reflections needs to know which is newer.
 */
export async function handleGetConfigSchema(c: Context, app: App): Promise<Response> {
  const body = {
    app: redactAppConfigForReflection(app, process.env),
    generatedAt: new Date().toISOString(),
  }

  const parsed = configSchemaResponseSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      { success: false, message: 'Failed to build config schema response', code: 'INTERNAL_ERROR' },
      500
    )
  }

  await auditRead(c, AUDIT_ACTIONS.CONFIG_SCHEMA_QUERIED)

  // A config reflection is the least appropriate payload in the product for a
  // shared cache to hold: admin-scoped, changing on every deploy, and a stale
  // hit would answer "what is running?" with what USED to run — the exact
  // failure mode the endpoint exists to eliminate.
  c.header('Cache-Control', 'no-store')
  return c.json(parsed.data, 200)
}

/**
 * `GET /api/admin/env` — every variable declared in `app.env[]`, with whether
 * this instance resolved it and from which rung. Values are never returned.
 */
export async function handleGetConfigEnv(c: Context, app: App): Promise<Response> {
  const body = {
    variables: buildEnvVarStatuses(app, process.env),
    generatedAt: new Date().toISOString(),
  }

  const parsed = envConfigResponseSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      { success: false, message: 'Failed to build env config response', code: 'INTERNAL_ERROR' },
      500
    )
  }

  await auditRead(c, AUDIT_ACTIONS.CONFIG_ENV_QUERIED)

  c.header('Cache-Control', 'no-store')
  return c.json(parsed.data, 200)
}

/**
 * Chain both config-introspection reads onto a Hono instance.
 *
 * `resolveApp` is the live-App resolver (not the boot-time `app`) so a config
 * reload is reflected without a restart — the endpoint's whole promise is that
 * it shows what is running NOW.
 */
export function chainAdminConfigIntrospectionRoutes<T extends Hono>(
  honoApp: T,
  resolveApp: () => App
): T {
  return honoApp
    .get('/api/admin/config/schema', (c) => handleGetConfigSchema(c, resolveApp()))
    .get('/api/admin/env', (c) => handleGetConfigEnv(c, resolveApp())) as T
}
