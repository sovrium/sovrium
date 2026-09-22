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
import { flattenDesignTokens } from '@/application/use-cases/admin/design-system-schema'
import { resolveActor } from '@/application/use-cases/admin/resolve-actor'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import {
  designSystemDocumentSchema,
  specimenRowsQuerySchema,
} from '@/domain/models/api/admin/design-system'
import { flatTokensResponseSchema } from '@/domain/models/api/admin/design-system/component-types'
import { type SafeDecodeResult, decodeSafe } from '@/domain/models/api/combinators/decode'
import { windowSpecimenRows } from '@/domain/models/app/design/specimen-fixture'
import { runDomainPromise } from '@/infrastructure/logging/request-effect'
import { effectValidator } from '@/presentation/api/runtime/effect-validator'
import {
  parseOptionalCap,
  parseOptionalPositive,
} from '@/presentation/api/runtime/query-cap-parsers'
import type { SpecimenRowsQuery } from '@/domain/models/api/admin/design-system'
import type { App } from '@/domain/models/app'
import type { ContextWithSession } from '@/presentation/api/middleware/auth'
import type { Context, Hono } from 'hono'

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
  const actor = await runDomainPromise(c, resolveActor(session.userId))
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
function buildValidatedDocument(
  app: App
): SafeDecodeResult<typeof designSystemDocumentSchema.Type> {
  return decodeSafe(designSystemDocumentSchema)(buildDesignSystem(app))
}

/**
 * The one query value that changes this endpoint's shape.
 *
 * Opt-in BY NAME rather than by "any query string present": a link carrying a
 * campaign parameter, a cache-buster or a trailing `?` must serve the document
 * unchanged, because a conformant DTCG consumer has no way to know it was
 * handed a table instead.
 */
const FLAT_PROJECTION_FLAG = 'flat'

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

  // `?flat=1` — the SAME tokens as rows, for the console table that cannot
  // render a tree. A PROJECTION and never a replacement: without the flag the
  // document below is byte-identical to what it has always been, because the
  // published standard format must not be reshaped by a console convenience.
  if (c.req.query(FLAT_PROJECTION_FLAG) !== undefined) {
    const items = flattenDesignTokens(parsed.data as Readonly<Record<string, unknown>>, app)
    const rows = decodeSafe(flatTokensResponseSchema)({ items, total: items.length })
    if (!rows.success) {
      return c.json(
        {
          success: false,
          message: 'Failed to flatten design system tokens',
          code: 'INTERNAL_ERROR',
        },
        500
      )
    }
    c.header('Cache-Control', 'no-store')
    return c.json(rows.data, 200)
  }

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
 * `GET /api/admin/design-system/specimen-rows` — the catalog's fixture rows.
 *
 * No audit emit, deliberately, unlike the two exports beside it: those project
 * the operator's whole configuration and "who exported it" has to be
 * answerable afterwards. This returns a compile-time constant that is identical
 * on every instance, so an audit row for it would record nothing about the
 * operator and would only dilute the log the exports write.
 *
 * `total` describes the CAPPED fixture rather than the page taken out of it.
 * Those were the same number while the fixture was one page and are not any
 * more: a pager needs both halves to say `1-10 of 30`, and a `total` that
 * collapsed to the page length would have it announce one page and draw three.
 * `?rows=0` still answers no rows above a total of zero — a count of thirty
 * above an empty table is a page contradicting itself, which is the reading
 * this endpoint has always refused.
 *
 * Read-only and same-origin, so [internal ref] A3 clause 3 ("the frame issues no
 * non-`GET` request at all, and no cross-origin request at all") holds by
 * construction rather than by assertion.
 *
 * No audit emit, deliberately, unlike the two exports beside it: those project
 * the operator's whole configuration and "who exported it" has to be
 * answerable afterwards. This returns a platform constant identical on every
 * instance, so an audit row for it would record nothing about the operator and
 * would only dilute the log the exports write. Anchoring the fixture's dates on
 * the current month costs nothing there — the clock is not operator data.
 */
export function handleGetDesignSystemSpecimenRows(c: Context): Response {
  // `c.req.valid` is typed off the fluent chain, and this handler takes a bare
  // `Context` so it stays callable from a test and from the chain alike — the
  // same shape every sibling admin handler has. The cast names exactly what
  // `effectValidator('query', specimenRowsQuerySchema)` put there.
  const { rows, page, limit } = (
    c.req as unknown as { readonly valid: (target: 'query') => SpecimenRowsQuery }
  ).valid('query')
  c.header('Cache-Control', 'no-store')
  // `?rows=0` is the EMPTY state a kit page draws, not "unset" — see
  // `parseOptionalCap`, which honours zero and reads an empty param as absent.
  // `page` and `limit` go through the sibling that floors at one, because zero
  // is a page nobody asked for rather than a state anybody draws.
  return c.json(
    windowSpecimenRows(
      {
        cap: parseOptionalCap(rows),
        page: parseOptionalPositive(page),
        limit: parseOptionalPositive(limit),
      },
      new Date()
    ),
    200
  )
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
    .get(
      '/api/admin/design-system/specimen-rows',
      effectValidator('query', specimenRowsQuerySchema),
      (c) => handleGetDesignSystemSpecimenRows(c)
    ) as T
}
