/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The operational writes under `/api/admin/*` that only the `admin-editor` tier
 * may make — ONE declarative list, read by both mirrors of
 * `admin-route-guards.ts`.
 *
 * Every console tier reads `/api/admin/*` (`requireAdminTier`). The writes below
 * change what the running app does — re-fire a run, pause an automation,
 * re-point a public redirect, store or drop an OAuth token, publish the design
 * system to a link holder, purge the image-transform cache — so the read-only `admin-viewer` tier, and the legacy
 * `operator` alias that resolves to it, are refused them with the same 404 a
 * stranger gets (S1: a read-only operator learns no more about a write route
 * than an anonymous caller does).
 *
 * Adding an operational write route means adding ONE line here. What is
 * deliberately NOT listed:
 *
 *   - `POST /api/admin/buckets/:bucketName/files` — the console upload, kept
 *     open to the read-only tier by decision and documented as such;
 *   - `POST /api/admin/forms/:formName/submissions/_bulk` — a bulk READ by ids,
 *     which is why the list is method + path pairs and not "every non-GET";
 *   - the invitation resend / revoke — already admin-equivalent only, in their
 *     own handlers.
 *
 * The OAuth callback is a write on a GET: it persists the exchanged token.
 *
 * Hono's `.use(path, …)` ignores the method, and the reads on the same paths
 * (the links list, the shares list) must keep answering the viewer, so the
 * guard matches method AND path itself. `HEAD` is matched as `GET` because Hono
 * routes a `HEAD` request to the `GET` handler.
 */

import { requireAdminEditor, type ContextWithSession } from '@/presentation/api/middleware/auth'
import type { AdminRoleResolvable } from '@/domain/models/app'
import type { Next } from 'hono'

type EditorOnlyWrite = readonly ['GET' | 'POST' | 'PATCH' | 'DELETE', string]

export const EDITOR_ONLY_WRITES: readonly EditorOnlyWrite[] = [
  ['POST', '/api/admin/automations/runs/:runId/retry'],
  ['POST', '/api/admin/automations/:name/pause'],
  ['POST', '/api/admin/automations/:name/resume'],
  ['POST', '/api/admin/links'],
  ['PATCH', '/api/admin/links/:slug'],
  ['DELETE', '/api/admin/links/:slug'],
  ['POST', '/api/admin/links/:slug/disable'],
  ['POST', '/api/admin/links/:slug/enable'],
  ['POST', '/api/admin/connections/:id/authorize'],
  ['POST', '/api/admin/connections/:id/disconnect'],
  ['GET', '/api/admin/connections/:name/callback'],
  ['POST', '/api/admin/design-system/shares'],
  ['DELETE', '/api/admin/design-system/shares/:id'],
  ['DELETE', '/api/admin/storage/transform-cache'],
]

/** A route pattern as an anchored matcher: each `:param` is exactly one segment. */
const toMatcher = (pattern: string): RegExp =>
  new RegExp(`^${pattern.replace(/:[^/]+/g, '[^/]+')}$`)

const MATCHERS = EDITOR_ONLY_WRITES.map(
  ([method, pattern]) => [method, toMatcher(pattern)] as const
)

/** `true` when `method` + `path` name one of {@link EDITOR_ONLY_WRITES}. */
export const isEditorOnlyWrite = (method: string, path: string): boolean => {
  const routedMethod = method.toUpperCase() === 'HEAD' ? 'GET' : method.toUpperCase()
  return MATCHERS.some(([listed, matcher]) => listed === routedMethod && matcher.test(path))
}

/**
 * The middleware both mirrors mount on `/api/admin/*`, after the tier guard:
 * an editor-only write goes through {@link requireAdminEditor}; anything else
 * passes untouched.
 */
export const requireAdminEditorOnWrites = (resolveApp?: () => AdminRoleResolvable | undefined) => {
  const editorGuard = requireAdminEditor(resolveApp)
  return async (c: ContextWithSession, next: Next) =>
    isEditorOnlyWrite(c.req.method, c.req.path) ? editorGuard(c, next) : next()
}
