/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Admin endpoints for the links domain.
 *
 *   - GET    /api/admin/links               — the catalog (config ∪ db)
 *   - GET    /api/admin/links/:slug         — one link's full definition
 *     (both READS are admin read-registry entries — `links-connections-read-
 *     operations.ts` — mounted here through `chainAdminReadRoutes`, so the
 *     route, its OpenAPI operation and its MCP tool are one entry)
 *   - POST   /api/admin/links               — mint a runtime link
 *   - PATCH  /api/admin/links/:slug         — sparse edit (no rename)
 *   - DELETE /api/admin/links/:slug         — soft delete
 *   - POST   /api/admin/links/:slug/disable — operator kill switch
 *   - POST   /api/admin/links/:slug/enable  — lift the console's own overlay
 *
 * ─── WHAT THIS FILE IS, AND IS NOT ──────────────────────────────────────────
 *
 * It parses requests, gates them, calls a use-case, and shapes the answer.
 * Every rule the answers depend on lives in `@/application/use-cases/links`:
 *
 *   - the config ∪ db UNION, its filters and its cursor → `read-link-catalog`
 *   - `active`/`scheduled`/`exhausted`/… derivation      → `link-state`
 *   - mint / re-point / retire                           → `mutate-link`
 *   - the operator kill switch and its asymmetry         → `set-link-overlay`
 *
 * That split is not tidiness. An automation `link` step reaches the same
 * programs with no HTTP anywhere in sight, so a rule re-derived here would be a
 * rule the two callers could disagree about — and the one thing the two callers
 * must never disagree about is which slugs the config file owns.
 *
 * ─── CONFIG-DECLARED SLUGS ARE RESERVED ─────────────────────────────────────
 *
 * Create, update and delete naming a config-declared slug answer **409
 * `LINK_IS_CONFIG_DECLARED`** — never 404, never a silent write. A DB row able
 * to shadow a config link would be config mutation through a data-shaped side
 * door. The caller is an authenticated admin who can SEE the row,
 * so 404 would be a lie and would send them hunting for a link that is right
 * there in the file they need to edit.
 *
 * ─── WHAT IS ABSENT ─────────────────────────────────────────────────────────
 *
 * No `password`, and no hash of one — the port's `LinkRecord` does
 * not carry it, so nothing on this path could leak it if it tried. No click
 * metrics either: those are read from the analytics endpoints with
 * `?event_type=link_click[&event_name={slug}]`, so there is exactly one
 * aggregation path over the click store.
 *
 * Auth gating is wired upstream by `requireAdminTier()`, which answers 404 —
 * never 401/403 — to an anonymous or non-admin caller (standing rule S1). No
 * handler here adds an authorisation path of its own.
 */

import { Effect } from 'effect'
import { LINKS_READ_OPERATIONS } from '@/application/use-cases/admin/admin-read-registry'
import {
  configLinkRefusesOverlay,
  configSlugs,
  createLink,
  deleteLink,
  readLinkEntry,
  setLinkOverlay,
  toAdminLinkDetail,
  updateLink,
  utmPatchFromFlat,
  utmRecordFromFlat,
  type CatalogState,
} from '@/application/use-cases/links'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import {
  adminLinkDetailResponseSchema,
  createLinkRequestSchema,
  linkStateChangeResponseSchema,
  updateLinkRequestSchema,
} from '@/domain/models/api/admin/links'
import { logError } from '@/infrastructure/logging/logger'
import { emitAuditEventAs } from '@/presentation/api/admin/audit-events'
import { conflict } from '@/presentation/api/admin/links-conflict'
import { chainAdminReadRoutes } from '@/presentation/api/admin/read-operation-routes'
import { badRequest, internalError, notFound } from '@/presentation/api/runtime/auth-helpers'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import { decodeJsonBody } from '@/presentation/api/runtime/request-body'
import {
  answerFailures,
  respondWith,
  runHandlerEffect,
} from '@/presentation/api/runtime/run-effect'
import type { Severity } from '@/domain/models/api/admin/envelope/severity'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

/** Answer a refusal decided before any program ran: a config-declared slug's 409. */
const answerConflict = (c: Context, slug: string): Promise<Response> =>
  runHandlerEffect(c, answerFailures(c, conflict(c, 'LINK_IS_CONFIG_DECLARED', slug)))

// ---------------------------------------------------------------------------
// Canonical response envelopes
// ---------------------------------------------------------------------------

/** Build the detail body for a row that was just written. */
const detailResponse = (c: Context, app: App, slug: string, status: 200 | 201) =>
  Effect.gen(function* () {
    const result = yield* Effect.result(readLinkEntry({ app, slug, now: new Date() }))
    if (result._tag === 'Failure') {
      logError('[admin] link read-back failed', result.failure)
      return internalError(c, 'Failed to read the link back')
    }
    if (result.success === undefined) return internalError(c, 'Failed to read the link back')
    return yield* respondWith(
      c,
      Effect.succeed({ link: toAdminLinkDetail(result.success) }),
      adminLinkDetailResponseSchema,
      status
    )
  })

/**
 * Record one mutation in the audit log.
 *
 * `resourceId` is the SLUG, not a row id: a slug survives a delete-and-re-mint
 * and is what an operator actually searches for, whereas the uuid changes under
 * them. It is also the only identifier a config-declared link has at all.
 *
 * `emitAuditEvent` DROPS an action missing from `ACTION_CATALOG` with a warning
 * rather than throwing, so a mutation whose action is unregistered succeeds
 * while leaving no trace and failing nothing — which is why the five `link.*`
 * actions are registered there and covered by a spec.
 */
const auditLinkMutation = (c: Context, action: string, slug: string, severity: Severity) => {
  const userId = getSessionContext(c)?.userId
  // Part of the handler's program, so the entry is written before the answer
  // leaves: a spec reads the audit log the moment the mutation answers.
  return userId === undefined
    ? Effect.void
    : emitAuditEventAs(userId, {
        action,
        resourceId: slug,
        resourceName: slug,
        severity,
        result: 'success',
      })
}

/**
 * Record an overlay flip.
 *
 * `warning` on the way down, `info` on the way back up. The kill switch is the
 * entry an operator scans for when reconstructing an incident; restoring service
 * is routine and should not compete with it for attention.
 */
const auditOverlayChange = (c: Context, slug: string, disabled: boolean) =>
  auditLinkMutation(
    c,
    disabled ? AUDIT_ACTIONS.LINK_DISABLED : AUDIT_ACTIONS.LINK_ENABLED,
    slug,
    disabled ? 'warning' : 'info'
  )

/**
 * The 200 body every state transition answers with — delete included.
 *
 * A delete IS a transition (to `archived`), so it shares this envelope rather
 * than carrying a second, subtly different one: `changed: false` on a repeat
 * call is what lets the console read idempotency as success, and that only
 * works if both endpoints spell it the same way.
 */
const stateChangeResponse = (c: Context, slug: string, state: CatalogState, changed: boolean) =>
  respondWith(c, Effect.succeed({ slug, state, changed }), linkStateChangeResponseSchema)

/** POST /api/admin/links — mint a runtime link. */
async function handleCreateLink(c: Context, app: App): Promise<Response> {
  const { decoded: parsed } = await decodeJsonBody(c, createLinkRequestSchema)
  if (!parsed.success) return badRequest(c, 'Invalid link payload')

  const { slug } = parsed.data
  const body = parsed.data as Record<string, unknown>

  // Both reservation guards, and the slug-taken conflict, are the use-case's:
  // the automation `link` action refuses exactly what this endpoint refuses.
  const program = createLink({
    app,
    slug,
    // Forwarded as the request supplied them: exactly one is present (the
    // schema refuses both and neither), and the repository nulls the other
    // column so a minted link is the same shape as a config-declared one.
    destination: parsed.data.destination,
    targets: parsed.data.targets,
    enabled: parsed.data.enabled,
    title: parsed.data.title,
    tags: parsed.data.tags,
    notes: parsed.data.notes,
    validFrom: parsed.data.validFrom,
    validUntil: parsed.data.validUntil,
    maxClicks: parsed.data.maxClicks,
    expiredTo: parsed.data.expiredTo,
    utm: utmRecordFromFlat(body),
    createdBy: getSessionContext(c)?.userId ?? null,
  })

  return runHandlerEffect(
    c,
    answerFailures(
      c,
      Effect.gen(function* () {
        const result = yield* Effect.result(program)
        if (result._tag === 'Failure') {
          const { failure } = result
          if (failure._tag === 'LinkMutationConflictError') {
            return yield* conflict(c, failure.code, failure.slug, true)
          }
          // 400, not 500: the caller sent a value that is not a link. The request
          // schema above already refuses a malformed slug, but it validates
          // `destination` as a non-empty string only — so this is the branch that
          // keeps a `javascript:` destination out of storage, which the config schema
          // has always refused. The rule is the use-case's; rendering it is ours.
          if (failure._tag === 'LinkValueRejectedError') return badRequest(c, failure.reason)
          return internalError(c, 'Failed to create the link')
        }

        yield* auditLinkMutation(c, AUDIT_ACTIONS.LINK_CREATED, slug, 'info')
        return yield* detailResponse(c, app, slug, 201)
      })
    )
  )
}

/** PATCH /api/admin/links/:slug — sparse edit. There is no rename. */
async function handleUpdateLink(c: Context, app: App): Promise<Response> {
  const slug = c.req.param('slug') ?? ''
  // Short-circuited BEFORE the payload is parsed, so a malformed edit of a
  // config-declared slug still answers 409 rather than 400: the caller's first
  // problem is that the slug is not theirs to write, and fixing the body would
  // not change that. `updateLink` re-checks — this is status precedence, an
  // HTTP concern, not a second copy of the rule.
  if (configSlugs(app).has(slug)) return answerConflict(c, slug)

  // The raw body is kept beside the decoded one: the UTM patch reads which keys were sent.
  const { raw, decoded: parsed } = await decodeJsonBody(c, updateLinkRequestSchema)
  if (!parsed.success) return badRequest(c, 'Invalid link payload')

  const body = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const program = updateLink({
    app,
    slug,
    // Either form REPLACES the other; the repository clears the counterpart
    // column so a re-pointed link cannot keep rotating to the destinations
    // the operator has just replaced.
    destination: parsed.data.destination,
    targets: parsed.data.targets,
    enabled: parsed.data.enabled,
    title: parsed.data.title,
    tags: parsed.data.tags,
    notes: parsed.data.notes,
    validFrom: parsed.data.validFrom,
    validUntil: parsed.data.validUntil,
    maxClicks: parsed.data.maxClicks,
    expiredTo: parsed.data.expiredTo,
    // A sparse patch, merged against the stored block inside the use-case —
    // the route has not read the row and must not have to.
    utm: utmPatchFromFlat(body),
  })

  return runHandlerEffect(
    c,
    answerFailures(
      c,
      Effect.gen(function* () {
        const result = yield* Effect.result(program)
        if (result._tag === 'Failure') {
          const { failure } = result
          if (failure._tag === 'LinkMutationConflictError') {
            return yield* conflict(c, failure.code, failure.slug)
          }
          if (failure._tag === 'LinkValueRejectedError') return badRequest(c, failure.reason)
          if (failure._tag === 'LinkNotFoundError') return notFound(c, 'Not found')
          return internalError(c, 'Failed to update the link')
        }

        yield* auditLinkMutation(c, AUDIT_ACTIONS.LINK_UPDATED, slug, 'info')
        return yield* detailResponse(c, app, slug, 200)
      })
    )
  )
}

/**
 * DELETE /api/admin/links/:slug — soft delete.
 *
 * Answers with the resulting STATE rather than a bare acknowledgement, reusing
 * `linkStateChangeResponseSchema`: a delete is a state transition to `archived`,
 * and `changed: false` on a second call is what lets the console treat
 * idempotency as success instead of as a failed retry.
 */
function handleDeleteLink(c: Context, app: App): Promise<Response> {
  const slug = c.req.param('slug') ?? ''

  return runHandlerEffect(
    c,
    answerFailures(
      c,
      Effect.gen(function* () {
        const result = yield* Effect.result(deleteLink({ app, slug }))
        if (result._tag === 'Failure') {
          const { failure } = result
          if (failure._tag === 'LinkMutationConflictError') {
            return yield* conflict(c, failure.code, failure.slug)
          }
          // A slug that is not shaped like one could never have matched a row, so
          // the alternative here is the anti-enumeration 404 — which would tell the
          // caller their address is unknown when their real problem is that it is
          // not an address.
          if (failure._tag === 'LinkValueRejectedError') return badRequest(c, failure.reason)
          if (failure._tag === 'LinkNotFoundError') return notFound(c, 'Not found')
          return internalError(c, 'Failed to delete the link')
        }

        if (result.success.changed) {
          // `warning`, not `info`: a delete takes a live address out of service, and
          // it is the entry an operator reconstructing an outage scans for.
          yield* auditLinkMutation(c, AUDIT_ACTIONS.LINK_DELETED, slug, 'warning')
        }
        return yield* stateChangeResponse(c, slug, 'archived', result.success.changed)
      })
    )
  )
}

/**
 * POST /api/admin/links/:slug/{disable,enable} — set or lift the overlay.
 *
 * The 409 here is the file's own refusal, short-circuited before the write is
 * attempted; `configLinkRefusesOverlay` is the rule and it lives with the write
 * it guards. See `set-link-overlay.ts` for why the polarity is asymmetric.
 */
function handleSetLinkDisabled(c: Context, app: App, disabled: boolean): Promise<Response> {
  const slug = c.req.param('slug') ?? ''
  if (configLinkRefusesOverlay(app, slug)) return answerConflict(c, slug)

  return runHandlerEffect(
    c,
    answerFailures(
      c,
      Effect.gen(function* () {
        const result = yield* Effect.result(
          setLinkOverlay({
            app,
            slug,
            disabled,
            actorId: getSessionContext(c)?.userId ?? null,
          })
        )
        if (result._tag === 'Failure') {
          if (result.failure._tag === 'LinkNotFoundError') return notFound(c, 'Not found')
          return internalError(c, 'Failed to change the link state')
        }
        if (result.success === undefined) return notFound(c, 'Not found')

        if (result.success.changed) yield* auditOverlayChange(c, slug, disabled)

        return yield* stateChangeResponse(c, slug, result.success.state, result.success.changed)
      })
    )
  )
}

/**
 * Chain every links endpoint onto a Hono instance.
 *
 * The two overlay routes register BEFORE the `:slug` family. They cannot
 * actually collide (different segment counts), but keeping the more specific
 * pattern first is what stops a future `/api/admin/links/:slug/*` handler from
 * silently swallowing them.
 */
export function chainAdminLinksRoutes<T extends Hono>(honoApp: T, app: App): T {
  const withReads = chainAdminReadRoutes(
    honoApp
      .post('/api/admin/links/:slug/disable', (c) => handleSetLinkDisabled(c, app, true))
      .post('/api/admin/links/:slug/enable', (c) => handleSetLinkDisabled(c, app, false))
      .post('/api/admin/links', (c) => handleCreateLink(c, app)),
    app,
    LINKS_READ_OPERATIONS
  )
  return withReads
    .patch('/api/admin/links/:slug', (c) => handleUpdateLink(c, app))
    .delete('/api/admin/links/:slug', (c) => handleDeleteLink(c, app)) as T
}
