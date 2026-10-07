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
import { resolveActor } from '@/application/use-cases/admin/resolve-actor'
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
  type LinkMutationConflictCode,
} from '@/application/use-cases/links'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import {
  adminLinkDetailResponseSchema,
  createLinkRequestSchema,
  linkMutationConflictSchema,
  linkStateChangeResponseSchema,
  updateLinkRequestSchema,
} from '@/domain/models/api/admin/links'
import { decodeOrThrow, decodeSafe } from '@/domain/models/api/combinators/decode'
import {
  provideDomain,
  runDomainPromise,
  runRequestEffect,
} from '@/infrastructure/logging/request-effect'
import { emitAuditEvent } from '@/presentation/api/admin/audit-events'
import { chainAdminReadRoutes } from '@/presentation/api/admin/read-operation-routes'
import { badRequest, internalError, notFound } from '@/presentation/api/runtime/auth-helpers'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import type { AnalyticsRepository } from '@/application/ports/repositories/analytics/analytics-repository'
import type { LinkRepository } from '@/application/ports/repositories/links/link-repository'
import type { Severity } from '@/domain/models/api/admin/envelope/severity'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

/**
 * Run a links program to a `Result`, never throwing into the Hono handler.
 *
 * The services come from the set the server resolved at boot, read off this
 * request. `createAppLayer` carries `LinkRepository` (beside the other
 * `Database`-reading repositories) and `AnalyticsRepository`, so nothing is
 * constructed here per call.
 */
const runLinks = <A, E>(
  c: Context,
  program: Effect.Effect<A, E, LinkRepository | AnalyticsRepository>
) => runRequestEffect(c, provideDomain(c, program).pipe(Effect.result))

// ---------------------------------------------------------------------------
// Canonical response envelopes
// ---------------------------------------------------------------------------

/**
 * The prose for each refusal, keyed by its discriminant.
 *
 * A table rather than a ternary chain because the enum has three members and
 * the console branches on `code`, never on the message — so the message exists
 * only for the human reading the response, and each one must NAME the slug it
 * refused. A refusal that does not say which slug it means is unactionable when
 * a console posts several.
 */
type ConflictCode = LinkMutationConflictCode

const CONFLICT_MESSAGES: Readonly<Record<ConflictCode, (slug: string) => string>> = {
  LINK_IS_CONFIG_DECLARED: (slug) =>
    `Link '${slug}' is declared in app.links[] and can only be edited in the configuration file.`,
  LINK_SLUG_TAKEN: (slug) => `Link '${slug}' already exists.`,
  LINK_RESERVED_SLUG: (slug) =>
    `Slug '${slug}' is reserved by the admin API and cannot be minted — a link there would ` +
    `resolve publicly while being permanently invisible in the console.`,
}

/** 409 with the stable discriminant the console branches on. */
const conflict = (c: Context, code: ConflictCode, slug: string) => {
  const body = decodeOrThrow(linkMutationConflictSchema)({
    success: false,
    code,
    message: CONFLICT_MESSAGES[code](slug),
  })
  return c.json(body, 409)
}

/** Build the detail body for a row that was just written. */
const detailResponse = async (
  c: Context,
  app: App,
  slug: string,
  status: 200 | 201
): Promise<Response> => {
  const result = await runLinks(c, readLinkEntry({ app, slug, now: new Date() }))
  if (result._tag === 'Failure' || result.success === undefined) {
    return internalError(c, 'Failed to read the link back')
  }
  const body = decodeSafe(adminLinkDetailResponseSchema)({
    link: toAdminLinkDetail(result.success.entry, result.success.state),
  })
  if (!body.success) return internalError(c, 'Failed to build the link detail')
  return c.json(body.data, status)
}

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
const auditLinkMutation = async (
  c: Context,
  action: string,
  slug: string,
  severity: Severity
): Promise<void> => {
  const userId = getSessionContext(c)?.userId
  if (userId === undefined) return
  const actor = await runDomainPromise(c, resolveActor(userId))
  // Returned rather than awaited: the caller awaits this promise, so ordering is
  // unchanged (a spec reads the audit log the moment the mutation answers) while
  // the emit stays a return statement instead of a bare side-effecting one.
  return emitAuditEvent({
    action,
    actor,
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
const auditOverlayChange = (c: Context, slug: string, disabled: boolean): Promise<void> =>
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
const stateChangeResponse = (
  c: Context,
  slug: string,
  state: CatalogState,
  changed: boolean
): Response => {
  const body = decodeSafe(linkStateChangeResponseSchema)({ slug, state, changed })
  if (!body.success) return internalError(c, 'Failed to build the state-change response')
  return c.json(body.data, 200)
}

/** POST /api/admin/links — mint a runtime link. */
async function handleCreateLink(c: Context, app: App): Promise<Response> {
  const raw: unknown = await c.req.json().catch(() => undefined)
  const parsed = decodeSafe(createLinkRequestSchema)(raw)
  if (!parsed.success) return badRequest(c, 'Invalid link payload')

  const { slug } = parsed.data
  const body = parsed.data as Record<string, unknown>

  // Both reservation guards, and the slug-taken conflict, are the use-case's:
  // the automation `link` action refuses exactly what this endpoint refuses.
  const result = await runLinks(
    c,
    createLink({
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
  )

  if (result._tag === 'Failure') {
    const { failure } = result
    if (failure._tag === 'LinkMutationConflictError') return conflict(c, failure.code, failure.slug)
    // 400, not 500: the caller sent a value that is not a link. The request
    // schema above already refuses a malformed slug, but it validates
    // `destination` as a non-empty string only — so this is the branch that
    // keeps a `javascript:` destination out of storage, which the config schema
    // has always refused. The rule is the use-case's; rendering it is ours.
    if (failure._tag === 'LinkValueRejectedError') return badRequest(c, failure.reason)
    return internalError(c, 'Failed to create the link')
  }

  await auditLinkMutation(c, AUDIT_ACTIONS.LINK_CREATED, slug, 'info')
  return detailResponse(c, app, slug, 201)
}

/** PATCH /api/admin/links/:slug — sparse edit. There is no rename. */
async function handleUpdateLink(c: Context, app: App): Promise<Response> {
  const slug = c.req.param('slug') ?? ''
  // Short-circuited BEFORE the payload is parsed, so a malformed edit of a
  // config-declared slug still answers 409 rather than 400: the caller's first
  // problem is that the slug is not theirs to write, and fixing the body would
  // not change that. `updateLink` re-checks — this is status precedence, an
  // HTTP concern, not a second copy of the rule.
  if (configSlugs(app).has(slug)) return conflict(c, 'LINK_IS_CONFIG_DECLARED', slug)

  const raw: unknown = await c.req.json().catch(() => undefined)
  const parsed = decodeSafe(updateLinkRequestSchema)(raw)
  if (!parsed.success) return badRequest(c, 'Invalid link payload')

  const body = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const result = await runLinks(
    c,
    updateLink({
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
  )

  if (result._tag === 'Failure') {
    const { failure } = result
    if (failure._tag === 'LinkMutationConflictError') return conflict(c, failure.code, failure.slug)
    if (failure._tag === 'LinkValueRejectedError') return badRequest(c, failure.reason)
    if (failure._tag === 'LinkNotFoundError') return notFound(c, 'Not found')
    return internalError(c, 'Failed to update the link')
  }

  await auditLinkMutation(c, AUDIT_ACTIONS.LINK_UPDATED, slug, 'info')
  return detailResponse(c, app, slug, 200)
}

/**
 * DELETE /api/admin/links/:slug — soft delete.
 *
 * Answers with the resulting STATE rather than a bare acknowledgement, reusing
 * `linkStateChangeResponseSchema`: a delete is a state transition to `archived`,
 * and `changed: false` on a second call is what lets the console treat
 * idempotency as success instead of as a failed retry.
 */
async function handleDeleteLink(c: Context, app: App): Promise<Response> {
  const slug = c.req.param('slug') ?? ''

  const result = await runLinks(c, deleteLink({ app, slug }))

  if (result._tag === 'Failure') {
    const { failure } = result
    if (failure._tag === 'LinkMutationConflictError') return conflict(c, failure.code, failure.slug)
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
    await auditLinkMutation(c, AUDIT_ACTIONS.LINK_DELETED, slug, 'warning')
  }
  return stateChangeResponse(c, slug, 'archived', result.success.changed)
}

/**
 * POST /api/admin/links/:slug/{disable,enable} — set or lift the overlay.
 *
 * The 409 here is the file's own refusal, short-circuited before the write is
 * attempted; `configLinkRefusesOverlay` is the rule and it lives with the write
 * it guards. See `set-link-overlay.ts` for why the polarity is asymmetric.
 */
async function handleSetLinkDisabled(c: Context, app: App, disabled: boolean): Promise<Response> {
  const slug = c.req.param('slug') ?? ''
  if (configLinkRefusesOverlay(app, slug)) return conflict(c, 'LINK_IS_CONFIG_DECLARED', slug)

  const result = await runLinks(
    c,
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

  if (result.success.changed) {
    await auditOverlayChange(c, slug, disabled)
  }

  return stateChangeResponse(c, slug, result.success.state, result.success.changed)
}

/**
 * Chain every links endpoint onto a Hono instance.
 *
 * The two overlay routes register BEFORE the `:slug` family. They cannot
 * actually collide (different segment counts), but keeping the more specific
 * pattern first is what stops a future `/api/admin/links/:slug/*` handler from
 * silently swallowing them.
 *
 * `resolveApp` is the live-App resolver rather than the boot `app`, so a config
 * reload is reflected without a restart — a catalog describing the previous
 * deploy's `app.links[]` would report the wrong `source` for every entry, and
 * `source` is what the console gates its Edit and Delete affordances on.
 */
export function chainAdminLinksRoutes<T extends Hono>(honoApp: T, resolveApp: () => App): T {
  const withReads = chainAdminReadRoutes(
    honoApp
      .post('/api/admin/links/:slug/disable', (c) => handleSetLinkDisabled(c, resolveApp(), true))
      .post('/api/admin/links/:slug/enable', (c) => handleSetLinkDisabled(c, resolveApp(), false))
      .post('/api/admin/links', (c) => handleCreateLink(c, resolveApp())),
    resolveApp,
    LINKS_READ_OPERATIONS
  )
  return withReads
    .patch('/api/admin/links/:slug', (c) => handleUpdateLink(c, resolveApp()))
    .delete('/api/admin/links/:slug', (c) => handleDeleteLink(c, resolveApp())) as T
}
