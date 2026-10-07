/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The admin half of the design-system share link ([internal ref] amendment A3 Part 2).
 *
 *   - POST   /api/admin/design-system/shares      — mint; returns the plaintext ONCE
 *   - DELETE /api/admin/design-system/shares/:id  — revoke
 *
 * The list (`GET /api/admin/design-system/shares`, metadata only) is an admin
 * read-registry entry in `design-system-specimen-share-read-operations.ts`,
 * mounted with its MCP tool from one description.
 *
 * The fourth surface, `GET /s/design-system/{token}`, is the ANONYMOUS reader
 * and lives in `infrastructure/server/route-setup/design-system-share-routes.ts`.
 * These are admin-guarded like every other A1/A2 surface.
 *
 * ─── THE GUARD IS NOT INHERITED, AND THAT IS THE TRAP ───────────────────────
 *
 * `/api/admin/design-system.json`, `.md` and `/specimen-rows` are listed in
 * `admin-route-guards.ts` as EXACT paths with no wildcard, and `/_admin` pages
 * gate themselves through `resolveCallerHasAccess` rather than the middleware.
 * So `/api/admin/design-system/shares` inherits nothing from its neighbours: it
 * carries its own explicit entry in BOTH guard mirrors (auth-enabled and
 * no-auth), on the bare path AND the `/*` wildcard the `:id` revoke route
 * needs. An admin design system spec is what notices if that is ever undone.
 *
 * ─── THE PLAINTEXT IS EMITTED EXACTLY ONCE ──────────────────────────────────
 *
 * `POST` is the only response that ever carries it. The list endpoint is the
 * natural place for a "copy the link again" affordance and must not become one:
 * a re-servable token is not revocable in any meaningful sense, because an
 * operator who can re-read it never learns it was compromised. Nor is the
 * DIGEST served — publishing SHA-256(token) hands an offline verifier to
 * anyone who reaches this API, which is the one thing digest-at-rest exists to
 * prevent. The port's `DesignSystemShareRecord` carries neither field, so this
 * module could not leak them if it tried.
 */

import { Effect, Layer } from 'effect'
import {
  designSystemShareUrl,
  mintDesignSystemShare,
  revokeDesignSystemShare,
} from '@/application/use-cases/admin/design-system-share'
import { resolveActor } from '@/application/use-cases/admin/resolve-actor'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import { DatabaseLive } from '@/infrastructure/database/drizzle/layer'
import { DesignSystemShareRepositoryLive } from '@/infrastructure/database/repositories/design-system/design-system-share-repository-live'
import { runDomainPromise } from '@/infrastructure/logging/request-effect'
import { emitAuditEvent } from '@/presentation/api/admin/audit-events'
import { internalError, notFound } from '@/presentation/api/runtime/auth-helpers'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import type { DesignSystemShareRepository } from '@/application/ports/repositories/design-system/design-system-share-repository'
import type { Severity } from '@/domain/models/api/admin/envelope/severity'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

/** Composition root: the share repository needs `Database`. */
const SharesRuntimeLayer = Layer.provide(DesignSystemShareRepositoryLive, DatabaseLive)

/** Run a share program to a `Result`, never throwing into the Hono handler. */
const runShares = <A, E>(program: Effect.Effect<A, E, DesignSystemShareRepository>) =>
  Effect.runPromise(Effect.result(Effect.provide(program, SharesRuntimeLayer)))

/**
 * Record a mint or a revoke.
 *
 * `emitAuditEvent` DROPS an action missing from `ACTION_CATALOG` with a warning
 * rather than throwing, so an unregistered action succeeds silently and leaves
 * no trace — which is why `design.share.created` / `design.share.revoked` are
 * registered there and asserted by an admin design system spec.
 *
 * The share ID is the resource id; the TOKEN is never passed. An audit log is
 * precisely the artifact an operator exports and forwards, so a token recorded
 * here would be a token published a second time.
 */
const auditShareMutation = async (
  c: Context,
  action: string,
  shareId: string,
  severity: Severity
): Promise<void> => {
  const userId = getSessionContext(c)?.userId
  if (userId === undefined) return
  const actor = await runDomainPromise(c, resolveActor(userId))
  return emitAuditEvent({ action, actor, resourceId: shareId, severity, result: 'success' })
}

/**
 * `POST /api/admin/design-system/shares` — mint.
 *
 * `warning` severity, unlike the `info` the design-system EXPORTS carry: an
 * export hands the projection to the authenticated operator who asked for it,
 * while this hands it to the anonymous internet. That is the entry an operator
 * scans for when reconstructing "when did this become public?".
 */
export async function handlePostDesignSystemShare(c: Context, app: App): Promise<Response> {
  const createdBy = getSessionContext(c)?.userId
  const result = await runShares(
    mintDesignSystemShare({ appName: app.name, ...(createdBy === undefined ? {} : { createdBy }) })
  )
  if (result._tag === 'Failure') return internalError(c)

  const { share, token } = result.success
  await auditShareMutation(c, AUDIT_ACTIONS.DESIGN_SHARE_CREATED, share.id, 'warning')

  c.header('Cache-Control', 'no-store')
  return c.json(
    {
      id: share.id,
      createdAt: share.createdAt.toISOString(),
      // The one and only emission of the plaintext, in the one response the
      // operator asked for by taking an action.
      token,
      url: designSystemShareUrl(token),
    },
    201
  )
}

/**
 * `DELETE /api/admin/design-system/shares/:id` — revoke.
 *
 * 404 on an unknown or already-revoked id, never 403 and never a silent 200:
 * an operator who is told "revoked" about a share that was already dead learns
 * nothing, and one told 200 about an id that never existed stops trusting the
 * answer.
 */
export async function handleDeleteDesignSystemShare(c: Context, app: App): Promise<Response> {
  const id = c.req.param('id')
  if (id === undefined || id.length === 0) return notFound(c, 'Not found')

  const result = await runShares(revokeDesignSystemShare(app.name, id))
  if (result._tag === 'Failure') return internalError(c)
  if (!result.success) return notFound(c, 'Not found')

  await auditShareMutation(c, AUDIT_ACTIONS.DESIGN_SHARE_REVOKED, id, 'info')

  c.header('Cache-Control', 'no-store')
  return c.json({ success: true, id, revoked: true }, 200)
}

/**
 * Chain the two admin share actions onto a Hono instance.
 *
 * `resolveApp` is the live-App resolver (not the boot-time `app`), matching the
 * two design-system exports beside it: the share is scoped by `app.name`, so a
 * reload that renames the app must be reflected without a restart.
 */

export function chainAdminDesignSystemShareRoutes<T extends Hono>(
  honoApp: T,
  resolveApp: () => App
): T {
  return honoApp
    .post('/api/admin/design-system/shares', (c) => handlePostDesignSystemShare(c, resolveApp()))
    .delete('/api/admin/design-system/shares/:id', (c) =>
      handleDeleteDesignSystemShare(c, resolveApp())
    ) as T
}
