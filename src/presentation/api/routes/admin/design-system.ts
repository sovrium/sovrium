/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The two design-system export surfaces authorised by [internal ref] amendment A2:
 *
 *  - `GET /api/admin/design-system.json` — a W3C DTCG 2025.10 token document.
 *  - `GET /api/admin/design-system.md`   — the same system as an agent brief.
 *
 * Both are PROJECTIONS of one generator, `buildDesignSystem(app)`. Neither
 * handler decides anything about what the design system is; they choose a
 * serialization and nothing else, which is what keeps the two answers from ever
 * describing different systems.
 *
 * ─── READ ONLY, AND STRUCTURALLY SO ─────────────────────────────────────────
 *
 * A2's invariant is A1's: reading the running configuration is observability,
 * mutating it is authoring. It additionally forbids an export-then-reimport
 * round trip outright — accepting this document back would make the console a
 * config editor, which is the line [internal ref] draws. This module therefore has two
 * GET handlers, no request schema, and no write path: there is nothing a caller
 * can send.
 *
 * ─── THE CONFIDENTIALITY BOUND IS UPSTREAM, NOT HERE ────────────────────────
 *
 * Neither handler redacts, because there is nothing to redact:
 * `buildDesignSystem` reads `design.*` and `theme.*` and never resolves an
 * `app.env[]` value or touches table data. Redacting at this layer would imply
 * the payload could contain a secret; the bound is that it cannot.
 *
 * Anti-enumeration 404 (S1) is wired upstream by `requireAdminTier()` in
 * `infrastructure/server/route-setup/api-routes.ts`, which 404s both
 * missing-session and wrong-role callers.
 */

import { emitAuditEvent } from '@/application/use-cases/admin/audit-log/emit'
import { buildDesignSystem } from '@/application/use-cases/admin/design-system'
import { renderDesignSystemMarkdown } from '@/application/use-cases/admin/design-system-markdown'
import { resolveActor } from '@/application/use-cases/admin/resolve-actor'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import { designSystemDocumentSchema } from '@/domain/models/api/admin/design-system'
import type { App } from '@/domain/models/app'
import type { ContextWithSession } from '@/presentation/api/middleware/auth'
import type { Context, Hono } from 'hono'

/* eslint-disable functional/no-expression-statements -- request-handler code: the audit emit and the response-header set are intentional side-effects in a Hono handler, matching the sibling admin read handlers. */

/**
 * Emit the export's audit entry.
 *
 * A design-system export is a whole-config projection an operator is likely to
 * paste into a shared context window, so "who exported it, and when" has to be
 * answerable after the fact. Severity stays `info` / result `success` — a READ
 * is not an incident — but the actor is the point, so the emit is never skipped.
 */
async function auditExport(c: Context): Promise<void> {
  const { session } = (c as ContextWithSession).var
  if (!session) return
  const actor = await resolveActor(session.userId)
  await emitAuditEvent({
    action: AUDIT_ACTIONS.CONFIG_DESIGN_QUERIED,
    actor,
    // The running configuration is the single entity both projections target,
    // so the caller's id is what makes the entry filterable per operator.
    resourceId: session.userId,
    severity: 'info',
    result: 'success',
  })
}

/**
 * Build and validate the document, or fail loudly.
 *
 * The contract is `.strict()` throughout, and validating BEFORE serialising is
 * what makes that strictness do any work: a field smuggled into the payload is
 * refused here rather than published to a consumer that then depends on it.
 */
function buildValidatedDocument(app: App): ReturnType<typeof designSystemDocumentSchema.safeParse> {
  return designSystemDocumentSchema.safeParse(buildDesignSystem(app))
}

/** `GET /api/admin/design-system.json` — the DTCG 2025.10 token document. */
export async function handleGetDesignSystemJson(c: Context, app: App): Promise<Response> {
  const parsed = buildValidatedDocument(app)
  if (!parsed.success) {
    return c.json(
      { success: false, message: 'Failed to build design system document', code: 'INTERNAL_ERROR' },
      500
    )
  }

  await auditExport(c)

  // A design system changes on every deploy and is admin-scoped, so a shared
  // cache holding it would answer "what does this app look like?" with what it
  // USED to look like — the exact failure the export exists to eliminate.
  c.header('Cache-Control', 'no-store')
  return c.json(parsed.data, 200)
}

/** `GET /api/admin/design-system.md` — the same system, written for an agent. */
export async function handleGetDesignSystemMarkdown(c: Context, app: App): Promise<Response> {
  const parsed = buildValidatedDocument(app)
  if (!parsed.success) {
    return c.text('Failed to build design system document\n', 500, {
      'Content-Type': 'text/markdown; charset=utf-8',
    })
  }

  await auditExport(c)

  c.header('Cache-Control', 'no-store')
  return c.text(renderDesignSystemMarkdown(parsed.data, app.name), 200, {
    'Content-Type': 'text/markdown; charset=utf-8',
  })
}

/**
 * The rows the `data` catalog's `data-table` specimen draws.
 *
 * ─── PLATFORM FIXTURE CONTENT, AND THAT IS THE WHOLE POINT ─────────────────
 *
 * A `data-table` over no rows is an empty state, and an empty state documents
 * nothing — so the specimen has to show real rows. It must NOT show the
 * operator's: [internal ref] A2 bounds a preview frame to "fixture text the platform
 * ships, not the operator's rows", and the leak would be in the WIRING as much
 * as in the bytes — a specimen bound to an operator table would fetch their
 * records on the next hydration even if this render happened to be empty.
 *
 * Hence a constant, served from the platform. It names no table, reads no
 * database, and cannot be made to: there is no parameter to point it anywhere.
 *
 * Read-only and same-origin, so [internal ref] A3 clause 3 ("the frame issues no
 * non-`GET` request at all, and no cross-origin request at all") holds by
 * construction rather than by assertion.
 */
const SPECIMEN_ROWS = [
  { id: 'specimen-1', name: 'Ada Lovelace', role: 'Analyst', status: 'Active' },
  { id: 'specimen-2', name: 'Grace Hopper', role: 'Engineer', status: 'Active' },
  { id: 'specimen-3', name: 'Alan Turing', role: 'Researcher', status: 'Paused' },
] as const

/**
 * `GET /api/admin/design-system/specimen-rows` — the catalog's fixture rows.
 *
 * No audit emit, deliberately, unlike the two exports beside it: those project
 * the operator's whole configuration and "who exported it" has to be
 * answerable afterwards. This returns a compile-time constant that is identical
 * on every instance, so an audit row for it would record nothing about the
 * operator and would only dilute the log the exports write.
 */
export function handleGetDesignSystemSpecimenRows(c: Context): Response {
  c.header('Cache-Control', 'no-store')
  return c.json({ items: SPECIMEN_ROWS, total: SPECIMEN_ROWS.length }, 200)
}

/**
 * Chain both design-system exports onto a Hono instance.
 *
 * `resolveApp` is the live-App resolver (not the boot-time `app`) so a config
 * reload is reflected without a restart — an export describing the previous
 * deploy's palette is worse than no export.
 */
export function chainAdminDesignSystemRoutes<T extends Hono>(honoApp: T, resolveApp: () => App): T {
  return honoApp
    .get('/api/admin/design-system.json', (c) => handleGetDesignSystemJson(c, resolveApp()))
    .get('/api/admin/design-system.md', (c) => handleGetDesignSystemMarkdown(c, resolveApp()))
    .get('/api/admin/design-system/specimen-rows', (c) => handleGetDesignSystemSpecimenRows(c)) as T
}

/* eslint-enable functional/no-expression-statements */
