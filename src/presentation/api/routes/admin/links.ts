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
 *   - POST   /api/admin/links               — mint a runtime link
 *   - PATCH  /api/admin/links/:slug         — sparse edit (no rename)
 *   - DELETE /api/admin/links/:slug         — soft delete
 *   - POST   /api/admin/links/:slug/disable — operator kill switch
 *   - POST   /api/admin/links/:slug/enable  — lift the console's own overlay
 *
 * ─── THE CATALOG IS A UNION, AND THE UNION IS THE WHOLE DESIGN ──────────────
 *
 * Two populations answer at `/l/{slug}`: entries in `app.links[]`, resolved from
 * memory and NOT rows anywhere, and rows in `system.links` minted at runtime.
 * The console shows both, so every filter — `q`, `tag`, `state`,
 * `include_archived` — and the pagination that follows are applied to the MERGED
 * set. Filtering only the SQL half would produce a page that is right for the
 * links an operator created and silently wrong for the ones they deployed.
 *
 * A `system.links` row with `source: 'config'` is NOT a third population: it is
 * an overlay carrying `disabled_at` for a config-declared slug, and it is folded
 * into its config entry rather than listed. A `db` row whose slug the config now
 * claims (`shadowed_at`) is skipped for the same reason — one slug, one row.
 *
 * ─── CONFIG-DECLARED SLUGS ARE RESERVED ─────────────────────────────────────
 *
 * Create, update and delete naming a config-declared slug answer **409
 * `LINK_IS_CONFIG_DECLARED`** — never 404, never a silent write. A DB row able
 * to shadow a config link would be config mutation through a data-shaped side
 * door ([internal ref] D2). The caller is an authenticated admin who can SEE the row,
 * so 404 would be a lie and would send them hunting for a link that is right
 * there in the file they need to edit.
 *
 * The disable/enable overlay is the one exception ([internal ref] D3), and it is
 * asymmetric: it may only ever be MORE restrictive than the file. A link the
 * config already disabled refuses the overlay in BOTH directions, because
 * re-enabling it from the console would be the console overruling a reviewed
 * artefact.
 *
 * ─── STATE IS DERIVED, ONCE ─────────────────────────────────────────────────
 *
 * `state` comes from `resolveLinkState` — the same function the redirect handler
 * uses — never from a second copy of the lifecycle rules here. A console
 * reporting `active` for a link whose visitors get a 410 is the specific defect
 * that rule exists to prevent. The catalog adds exactly one value the resolver
 * does not know about: `archived`, for a soft-deleted row.
 *
 * ─── WHAT IS ABSENT ─────────────────────────────────────────────────────────
 *
 * No `password`, and no hash of one ([internal ref] D5) — the port's `LinkRecord` does
 * not carry it, so this module could not leak it if it tried. No click metrics
 * either: those are read from the analytics endpoints with
 * `?event_type=link_click[&event_name={slug}]`, so there is exactly one
 * aggregation path over the click store ([internal ref] D6).
 *
 * Auth gating is wired upstream by `requireAdminTier()`, which answers 404 —
 * never 401/403 — to an anonymous or non-admin caller (standing rule S1). No
 * handler here adds an authorisation path of its own.
 */

/* eslint-disable unicorn/no-null -- the API contracts are `.nullable()` throughout: `null` is the wire value the console renders against, and `undefined` would drop the key from the JSON entirely. */
/* eslint-disable max-lines -- every endpoint of one domain lives in one module here, matching the sibling admin route handlers (buckets.ts, automations.ts). */

import { Effect, Layer } from 'effect'
import { AnalyticsRepository } from '@/application/ports/repositories/analytics/analytics-repository'
import {
  LinkRepository,
  type LinkRecord,
  type LinkSource,
  type LinkUtmRecord,
} from '@/application/ports/repositories/links/link-repository'
import { emitAuditEvent } from '@/application/use-cases/admin/audit-log/emit'
import { resolveActor } from '@/application/use-cases/admin/resolve-actor'
import {
  configSlugs,
  createLink,
  declaredLink,
  deleteLink,
  updateLink,
  utmPatchFromFlat,
  utmRecordFromFlat,
  type LinkMutationConflictCode,
} from '@/application/use-cases/links'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import {
  adminLinkDetailResponseSchema,
  adminLinksListQuerySchema,
  adminLinksListResponseSchema,
  createLinkRequestSchema,
  linkMutationConflictSchema,
  linkStateChangeResponseSchema,
  updateLinkRequestSchema,
  type AdminLink,
} from '@/domain/models/api/admin/links'
import { linkTargets } from '@/domain/models/app/links'
import { resolveLinkState, type ResolvableLink } from '@/domain/utils/matching/link-resolver'
import { DatabaseLive } from '@/infrastructure/database/drizzle/layer'
import { AnalyticsRepositoryLive } from '@/infrastructure/database/repositories/analytics/analytics-repository-live'
import { LinkRepositoryLive } from '@/infrastructure/database/repositories/links/link-repository-live'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import type { Severity } from '@/domain/models/api/admin/_shared/severity'
import type { App } from '@/domain/models/app'
import type { Link } from '@/domain/models/app/links'
import type { Context, Hono } from 'hono'

/** The fixed, non-configurable base path a link is served at. */
const LINK_PREFIX = '/l/'

/** The operational states the catalog reports. */
type CatalogState = 'active' | 'disabled' | 'scheduled' | 'expired' | 'exhausted' | 'archived'

/**
 * Composition root for the links console.
 *
 * `LinkRepositoryLive` needs `Database`; the click count needs
 * `AnalyticsRepository`. Both are merged here so the handlers below stay
 * dependency-free at the call site.
 */
const LinksRuntimeLayer = Layer.mergeAll(
  Layer.provide(LinkRepositoryLive, DatabaseLive),
  AnalyticsRepositoryLive
)

/** Run a links program to a `Result`, never throwing into the Hono handler. */
const runLinks = <A, E>(program: Effect.Effect<A, E, LinkRepository | AnalyticsRepository>) =>
  Effect.runPromise(Effect.result(Effect.provide(program, LinksRuntimeLayer)))

// ---------------------------------------------------------------------------
// Canonical response envelopes
// ---------------------------------------------------------------------------

const badRequest = (c: Context, message = 'Invalid link payload') =>
  c.json({ success: false, message, code: 'BAD_REQUEST' }, 400)

/** Anti-enumeration 404 — the same body an unauthorised caller gets upstream. */
const notFound = (c: Context) =>
  c.json({ success: false, message: 'Not found', code: 'NOT_FOUND' }, 404)

const internalError = (c: Context, message = 'Internal server error') =>
  c.json({ success: false, message, code: 'INTERNAL_ERROR' }, 500)

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
  const body = linkMutationConflictSchema.parse({
    success: false,
    code,
    message: CONFLICT_MESSAGES[code](slug),
  })
  return c.json(body, 409)
}

// ---------------------------------------------------------------------------
// The union: building one catalog entry from either population
// ---------------------------------------------------------------------------

/** The five campaign parameters, as the detail contract renders them. */
interface UtmView {
  readonly source: string | null
  readonly medium: string | null
  readonly campaign: string | null
  readonly content: string | null
  readonly term: string | null
}

/**
 * One catalog row before it is projected onto a contract.
 *
 * `link` is the ONLY lifecycle source: `validFrom`, `maxClicks` and the rest are
 * read back off it rather than carried alongside, so the values the console
 * displays and the values `resolveLinkState` decided from cannot disagree.
 */
interface CatalogEntry {
  readonly slug: string
  readonly source: LinkSource
  readonly link: ResolvableLink
  readonly title: string | null
  readonly tags: readonly string[]
  readonly notes: string | null
  readonly utm: UtmView | null
  readonly archived: boolean
  readonly deletedAt: string | null
}

/** Normalise any accepted datetime spelling to ISO 8601 UTC, or report absence. */
const toIsoOrNull = (value: string | null | undefined): string | null => {
  if (value === null || value === undefined) return null
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString()
}

/** `toIsoOrNull` in the shape `ResolvableLink.lifecycle` expects. */
const toIsoOrUndefined = (value: string | null | undefined): string | undefined =>
  toIsoOrNull(value) ?? undefined

/** Project a stored/declared utm block onto the contract's fixed five rows. */
const toUtmView = (utm: LinkUtmRecord | null | undefined): UtmView | null => {
  if (utm === null || utm === undefined) return null
  return {
    source: utm.source ?? null,
    medium: utm.medium ?? null,
    campaign: utm.campaign ?? null,
    content: utm.content ?? null,
    term: utm.term ?? null,
  }
}

/**
 * The lifecycle a config-declared link resolves against.
 *
 * The overlay may only SUBTRACT: `enabled` is the conjunction of what the file
 * says and what the console has not switched off.
 */
const configLifecycle = (link: Link, overlay: LinkRecord | undefined) => ({
  enabled: link.lifecycle?.enabled !== false && (overlay?.disabledAt ?? null) === null,
  validFrom: toIsoOrUndefined(link.lifecycle?.validFrom),
  validUntil: toIsoOrUndefined(link.lifecycle?.validUntil),
  maxClicks: link.lifecycle?.maxClicks,
  expiredTo: link.lifecycle?.expiredTo,
})

/** The resolvable definition a config-declared link contributes. */
const configResolvable = (link: Link, overlay: LinkRecord | undefined): ResolvableLink => ({
  slug: link.slug,
  ...(link.to === undefined ? {} : { to: link.to }),
  ...(link.targets === undefined ? {} : { targets: link.targets }),
  lifecycle: configLifecycle(link, overlay),
  ...(link.utm === undefined ? {} : { utm: link.utm }),
})

/** Fold a config-declared link and its optional overlay row into one entry. */
const configEntry = (link: Link, overlay: LinkRecord | undefined): CatalogEntry => ({
  slug: link.slug,
  source: 'config',
  link: configResolvable(link, overlay),
  title: link.title ?? null,
  tags: link.tags === undefined ? [] : [...link.tags],
  notes: link.notes ?? null,
  utm: toUtmView(link.utm),
  archived: false,
  deletedAt: null,
})

/** Project a `source: 'db'` row into a catalog entry. */
const dbEntry = (row: LinkRecord): CatalogEntry => ({
  slug: row.slug,
  source: 'db',
  link: {
    slug: row.slug,
    ...(row.destination === null ? {} : { to: row.destination }),
    ...(row.targets === null ? {} : { targets: row.targets }),
    lifecycle: {
      enabled: row.enabled && row.disabledAt === null,
      validFrom: toIsoOrUndefined(row.validFrom),
      validUntil: toIsoOrUndefined(row.validUntil),
      maxClicks: row.maxClicks ?? undefined,
      expiredTo: row.expiredTo ?? undefined,
    },
    ...(row.utm === null ? {} : { utm: row.utm }),
  },
  title: row.title,
  tags: row.tags,
  notes: row.notes,
  utm: toUtmView(row.utm),
  archived: row.deletedAt !== null || row.archivedAt !== null,
  deletedAt: row.deletedAt,
})

/**
 * Merge both populations into one catalog, ordered by slug.
 *
 * Slug ascending is the only TOTAL order available across the union: a config
 * entry has no `created_at` to sort against a DB row's, and an order that fell
 * back to "config first, then rows by recency" would make the cursor
 * non-monotonic the moment a link was minted mid-pagination.
 */
const buildCatalog = (app: App, rows: readonly LinkRecord[]): readonly CatalogEntry[] => {
  const declared = app.links ?? []
  const claimed = configSlugs(app)
  const overlays = new Map(rows.filter((row) => row.source === 'config').map((r) => [r.slug, r]))

  const fromConfig = declared.map((link) => configEntry(link, overlays.get(link.slug)))
  const fromDb = rows
    .filter((row) => row.source === 'db')
    // A shadowed row's slug now belongs to the file. Listing it too would show
    // one address twice, with two different destinations.
    .filter((row) => !claimed.has(row.slug))
    .map(dbEntry)

  return [...fromConfig, ...fromDb].toSorted((a, b) => a.slug.localeCompare(b.slug))
}

// ---------------------------------------------------------------------------
// State derivation
// ---------------------------------------------------------------------------

/**
 * How many clicks this link has already been credited with.
 *
 * Counted over `system.analytics_events`, the ONE place a click is written, so
 * the console's `exhausted` badge and the redirect handler's refusal are reading
 * the same number. Returns 0 when the store is unreadable — an unenforceable cap
 * must not become a state the operator cannot explain.
 */
const countClicks = (
  appName: string,
  slug: string
): Effect.Effect<number, never, AnalyticsRepository> =>
  Effect.gen(function* () {
    const repository = yield* AnalyticsRepository
    const result = yield* repository.listEvents({
      appName,
      eventType: 'link_click',
      eventName: slug,
      limit: 1,
    })
    return result.pagination.total
  }).pipe(Effect.orElseSucceed(() => 0))

/**
 * The entry's operational state.
 *
 * `archived` short-circuits: a soft-deleted link has no lifecycle question left
 * to answer. Everything else defers to `resolveLinkState`.
 */
const entryState = (
  appName: string,
  entry: Readonly<CatalogEntry>,
  now: Date
): Effect.Effect<CatalogState, never, AnalyticsRepository> =>
  Effect.gen(function* () {
    if (entry.archived) return 'archived' as const
    const cap = entry.link.lifecycle?.maxClicks
    const clickCount = cap === undefined ? 0 : yield* countClicks(appName, entry.slug)
    return resolveLinkState(entry.link, { now, clickCount })
  })

// ---------------------------------------------------------------------------
// Contract projections
// ---------------------------------------------------------------------------

/** The destination the grid renders — the first of the link's candidates. */
const primaryDestination = (entry: Readonly<CatalogEntry>): string =>
  linkTargets(entry.link)[0]?.to ?? ''

/**
 * Project an entry onto the catalog row contract.
 *
 * `lastModifiedBy` is always null: `system.links` records who CREATED a row
 * (`created_by`) but not who last edited it, and inventing an actor from the
 * creator would answer the operator's "who last touched this?" with a
 * confidently wrong name.
 */
const toAdminLink = (entry: Readonly<CatalogEntry>, state: CatalogState): AdminLink => ({
  slug: entry.slug,
  shortUrl: `${LINK_PREFIX}${entry.slug}`,
  destination: primaryDestination(entry),
  title: entry.title,
  tags: [...entry.tags],
  source: entry.source,
  state,
  validFrom: toIsoOrNull(entry.link.lifecycle?.validFrom),
  validUntil: toIsoOrNull(entry.link.lifecycle?.validUntil),
  maxClicks: entry.link.lifecycle?.maxClicks ?? null,
  _admin: { lastModifiedBy: null, deletedAt: entry.deletedAt },
})

/** Project an entry onto the detail contract. */
const toAdminLinkDetail = (entry: Readonly<CatalogEntry>, state: CatalogState) => ({
  ...toAdminLink(entry, state),
  targets: linkTargets(entry.link).map((target, index) => ({
    index,
    to: target.to,
    // An absent weight is 1, not 0: treating it as 0 would drop a declared
    // destination out of the rotation while it still reads as participating.
    weight: Math.max(1, Math.trunc(target.weight ?? 1)),
  })),
  utm: entry.utm,
  notes: entry.notes,
  expiredTo: entry.link.lifecycle?.expiredTo ?? null,
  qrUrl: `${LINK_PREFIX}${entry.slug}.svg`,
})

// ---------------------------------------------------------------------------
// Query parsing, filtering, pagination
// ---------------------------------------------------------------------------

interface ListQuery {
  readonly cursor: string | undefined
  readonly limit: number
  readonly q: string | undefined
  readonly tag: string | undefined
  readonly source: LinkSource | undefined
  readonly state: CatalogState | undefined
  readonly includeArchived: boolean
}

/**
 * Parse the list query.
 *
 * `include_archived` is read from the RAW string rather than from the schema's
 * `z.coerce.boolean()`, which is `Boolean("false") === true` — the coercion
 * would turn an explicit opt-OUT into an opt-in and quietly surface deleted
 * links. The contract's stated intent ("Default false") is what is implemented.
 */
const parseListQuery = (c: Context): ListQuery | undefined => {
  const parsed = adminLinksListQuerySchema.safeParse(c.req.query())
  if (!parsed.success) return undefined
  const raw = c.req.query('include_archived')
  return {
    cursor: parsed.data.cursor,
    limit: parsed.data.limit,
    q: parsed.data.q === undefined || parsed.data.q === '' ? undefined : parsed.data.q,
    tag: parsed.data.tag,
    source: parsed.data.source,
    state: parsed.data.state,
    includeArchived: raw === 'true' || raw === '1',
  }
}

/** Opaque base64 cursor over the slug — the catalog's sort key. */
const encodeCursor = (slug: string): string => btoa(slug)

const decodeCursor = (cursor: string | undefined): string | undefined => {
  if (cursor === undefined) return undefined
  try {
    return atob(cursor)
  } catch {
    return undefined
  }
}

/** The filters a state has no bearing on — applied before any click is counted. */
const matchesStaticFilters = (entry: Readonly<CatalogEntry>, query: ListQuery): boolean => {
  if (!query.includeArchived && entry.archived) return false
  if (query.source !== undefined && entry.source !== query.source) return false
  if (query.tag !== undefined && !entry.tags.includes(query.tag)) return false
  if (query.q === undefined) return true

  const needle = query.q.toLowerCase()
  return [entry.slug, entry.title ?? '', primaryDestination(entry)].some((haystack) =>
    haystack.toLowerCase().includes(needle)
  )
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/** GET /api/admin/links — the merged catalog. */
async function handleListLinks(c: Context, app: App): Promise<Response> {
  const query = parseListQuery(c)
  if (query === undefined) return badRequest(c, 'Invalid query parameters')

  const now = new Date()
  const result = await runLinks(
    Effect.gen(function* () {
      const repository = yield* LinkRepository
      const rows = yield* repository.list({
        appName: app.name,
        includeArchived: query.includeArchived,
      })

      const candidates = buildCatalog(app, rows).filter((entry) =>
        matchesStaticFilters(entry, query)
      )

      // States are resolved for every candidate, not just the page: `total` and
      // the `state` filter are both defined over the whole result set, and a
      // page-local resolution would make them disagree with each other.
      const stated = yield* Effect.forEach(candidates, (entry) =>
        entryState(app.name, entry, now).pipe(Effect.map((state) => ({ entry, state })))
      )

      return query.state === undefined ? stated : stated.filter((row) => row.state === query.state)
    })
  )

  if (result._tag === 'Failure') return internalError(c, 'Failed to read the links catalog')

  const after = decodeCursor(query.cursor)
  const remaining =
    after === undefined ? result.success : result.success.filter((row) => row.entry.slug > after)
  const page = remaining.slice(0, query.limit)
  const last = page.at(-1)

  const body = adminLinksListResponseSchema.safeParse({
    items: page.map((row) => toAdminLink(row.entry, row.state)),
    nextCursor: remaining.length > page.length && last ? encodeCursor(last.entry.slug) : null,
    total: result.success.length,
    appliedQuery: query.q ?? null,
  })
  if (!body.success) return internalError(c, 'Failed to build the links catalog')

  c.header('Cache-Control', 'no-store')
  return c.json(body.data, 200)
}

/**
 * Resolve one slug across the union.
 *
 * Returns the config entry when the file claims the slug (with its overlay
 * folded in), the DB entry when a live row holds it, and `undefined` when
 * neither does.
 */
const resolveEntry = (
  app: App,
  slug: string
): Effect.Effect<CatalogEntry | undefined, unknown, LinkRepository> =>
  Effect.gen(function* () {
    const repository = yield* LinkRepository
    const declared = declaredLink(app, slug)
    if (declared !== undefined) {
      const overlay = yield* repository.findBySlug({
        appName: app.name,
        slug,
        source: 'config',
      })
      return configEntry(declared, overlay)
    }

    const row = yield* repository.findBySlug({ appName: app.name, slug, source: 'db' })
    return row === undefined ? undefined : dbEntry(row)
  })

/** GET /api/admin/links/:slug — one link's full definition. */
async function handleLinkDetail(c: Context, app: App): Promise<Response> {
  const slug = c.req.param('slug') ?? ''
  const now = new Date()

  const result = await runLinks(
    Effect.gen(function* () {
      const entry = yield* resolveEntry(app, slug)
      if (entry === undefined) return undefined
      const state = yield* entryState(app.name, entry, now)
      return { entry, state }
    })
  )

  if (result._tag === 'Failure') return internalError(c, 'Failed to read the link')
  if (result.success === undefined) return notFound(c)

  const body = adminLinkDetailResponseSchema.safeParse({
    link: toAdminLinkDetail(result.success.entry, result.success.state),
  })
  if (!body.success) return internalError(c, 'Failed to build the link detail')

  c.header('Cache-Control', 'no-store')
  return c.json(body.data, 200)
}

/** Build the detail body for a row that was just written. */
const detailResponse = async (
  c: Context,
  app: App,
  slug: string,
  status: 200 | 201
): Promise<Response> => {
  const now = new Date()
  const result = await runLinks(
    Effect.gen(function* () {
      const entry = yield* resolveEntry(app, slug)
      if (entry === undefined) return undefined
      const state = yield* entryState(app.name, entry, now)
      return { entry, state }
    })
  )
  if (result._tag === 'Failure' || result.success === undefined) {
    return internalError(c, 'Failed to read the link back')
  }
  const body = adminLinkDetailResponseSchema.safeParse({
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
  const actor = await resolveActor(userId)
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
  const body = linkStateChangeResponseSchema.safeParse({ slug, state, changed })
  if (!body.success) return internalError(c, 'Failed to build the state-change response')
  return c.json(body.data, 200)
}

/** POST /api/admin/links — mint a runtime link. */
async function handleCreateLink(c: Context, app: App): Promise<Response> {
  const raw: unknown = await c.req.json().catch(() => undefined)
  const parsed = createLinkRequestSchema.safeParse(raw)
  if (!parsed.success) return badRequest(c)

  const { slug } = parsed.data
  const body = parsed.data as unknown as Record<string, unknown>

  // Both reservation guards, and the slug-taken conflict, are the use-case's:
  // the automation `link` action refuses exactly what this endpoint refuses.
  const result = await runLinks(
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
    // 400, not 500: the caller sent a value that is not a link. The Zod schema
    // above already refuses a malformed slug, but it validates `destination`
    // as a non-empty string only — so this is the branch that keeps a
    // `javascript:` destination out of storage, which the config schema has
    // always refused. The rule is the use-case's; rendering it is ours.
    if (failure._tag === 'LinkValueRejectedError') return badRequest(c, failure.reason)
    return internalError(c, 'Failed to create the link')
  }

  // eslint-disable-next-line functional/no-expression-statements -- the audit emit is a required side effect and must complete before the response: a spec reads the audit log the moment this endpoint answers. `ignoreVoid` does not cover `await`, so the suppression is the only lever; the sibling admin handlers (forms.ts) disable the same rule file-wide for this reason.
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
  const parsed = updateLinkRequestSchema.safeParse(raw)
  if (!parsed.success) return badRequest(c)

  const body = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const result = await runLinks(
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
    if (failure._tag === 'LinkNotFoundError') return notFound(c)
    return internalError(c, 'Failed to update the link')
  }

  // eslint-disable-next-line functional/no-expression-statements -- the audit emit is a required side effect and must complete before the response: a spec reads the audit log the moment this endpoint answers. `ignoreVoid` does not cover `await`, so the suppression is the only lever; the sibling admin handlers (forms.ts) disable the same rule file-wide for this reason.
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

  const result = await runLinks(deleteLink({ app, slug }))

  if (result._tag === 'Failure') {
    const { failure } = result
    if (failure._tag === 'LinkMutationConflictError') return conflict(c, failure.code, failure.slug)
    // A slug that is not shaped like one could never have matched a row, so
    // the alternative here is the anti-enumeration 404 — which would tell the
    // caller their address is unknown when their real problem is that it is
    // not an address.
    if (failure._tag === 'LinkValueRejectedError') return badRequest(c, failure.reason)
    if (failure._tag === 'LinkNotFoundError') return notFound(c)
    return internalError(c, 'Failed to delete the link')
  }

  if (result.success.changed) {
    // `warning`, not `info`: a delete takes a live address out of service, and
    // it is the entry an operator reconstructing an outage scans for.
    // eslint-disable-next-line functional/no-expression-statements -- the audit emit is a required side effect and must complete before the response: a spec reads the audit log the moment this endpoint answers. `ignoreVoid` does not cover `await`, so the suppression is the only lever; the sibling admin handlers (forms.ts) disable the same rule file-wide for this reason.
    await auditLinkMutation(c, AUDIT_ACTIONS.LINK_DELETED, slug, 'warning')
  }
  return stateChangeResponse(c, slug, 'archived', result.success.changed)
}

/**
 * The operator overlay, POST /api/admin/links/:slug/{disable,enable}.
 *
 * The polarity is asymmetric by design ([internal ref] D3, restated on the `disabled_at`
 * column): the overlay may only ever be MORE restrictive than the file. A
 * config-declared link the file already disabled therefore refuses BOTH
 * directions with 409 — enabling it would be the console overruling a reviewed
 * artefact, and disabling it further is a no-op dressed as an action.
 *
 * For a `db` link there is no file to overrule, so `enabled: false` on the row
 * itself is edited through PATCH; the overlay just adds or lifts the kill
 * switch, and the response reports whatever state the resolver then computes —
 * which is still `disabled` if the row's own flag is off.
 */
const refusesOverlay = (declared: Link | undefined): boolean =>
  declared !== undefined && declared.lifecycle?.enabled === false

/**
 * Apply (or lift) the overlay and report the state that follows.
 *
 * `undefined` means there is no such link to overlay. The write is skipped when
 * the row already holds the requested polarity, which is what makes `changed`
 * an honest answer rather than a restatement of the request.
 */
const overlayTransition = (input: {
  readonly app: App
  readonly slug: string
  readonly declared: Link | undefined
  readonly disabled: boolean
  readonly actorId: string | null
}): Effect.Effect<
  { readonly state: CatalogState; readonly changed: boolean } | undefined,
  unknown,
  LinkRepository | AnalyticsRepository
> =>
  Effect.gen(function* () {
    const { app, slug, declared, disabled } = input
    const repository = yield* LinkRepository
    const source: LinkSource = declared === undefined ? 'db' : 'config'
    const current = yield* repository.findBySlug({ appName: app.name, slug, source })
    if (declared === undefined && current === undefined) return undefined

    const changed = ((current?.disabledAt ?? null) !== null) !== disabled
    if (changed) {
      yield* repository.setDisabled({
        appName: app.name,
        slug,
        source,
        disabled,
        actorId: input.actorId,
      })
    }

    const entry = yield* resolveEntry(app, slug)
    if (entry === undefined) return undefined
    const state = yield* entryState(app.name, entry, new Date())
    return { state, changed }
  })

/** POST /api/admin/links/:slug/{disable,enable} — set or lift the overlay. */
async function handleSetLinkDisabled(c: Context, app: App, disabled: boolean): Promise<Response> {
  const slug = c.req.param('slug') ?? ''
  const declared = declaredLink(app, slug)
  if (refusesOverlay(declared)) return conflict(c, 'LINK_IS_CONFIG_DECLARED', slug)

  const result = await runLinks(
    overlayTransition({
      app,
      slug,
      declared,
      disabled,
      actorId: getSessionContext(c)?.userId ?? null,
    })
  )

  if (result._tag === 'Failure') {
    const failure = result.failure as { readonly _tag?: string }
    if (failure._tag === 'LinkNotFoundError') return notFound(c)
    return internalError(c, 'Failed to change the link state')
  }
  if (result.success === undefined) return notFound(c)

  if (result.success.changed) {
    // eslint-disable-next-line functional/no-expression-statements -- the audit emit is a required side effect and must complete before the response: a spec reads the audit log the moment this endpoint answers. `ignoreVoid` does not cover `await`, so the suppression is the only lever; the sibling admin handlers (forms.ts) disable the same rule file-wide for this reason.
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
/* eslint-disable drizzle/enforce-delete-with-where -- the .delete() below is a Hono route definition, not a Drizzle delete */
export function chainAdminLinksRoutes<T extends Hono>(honoApp: T, resolveApp: () => App): T {
  return honoApp
    .post('/api/admin/links/:slug/disable', (c) => handleSetLinkDisabled(c, resolveApp(), true))
    .post('/api/admin/links/:slug/enable', (c) => handleSetLinkDisabled(c, resolveApp(), false))
    .get('/api/admin/links', (c) => handleListLinks(c, resolveApp()))
    .post('/api/admin/links', (c) => handleCreateLink(c, resolveApp()))
    .get('/api/admin/links/:slug', (c) => handleLinkDetail(c, resolveApp()))
    .patch('/api/admin/links/:slug', (c) => handleUpdateLink(c, resolveApp()))
    .delete('/api/admin/links/:slug', (c) => handleDeleteLink(c, resolveApp())) as T
}
/* eslint-enable drizzle/enforce-delete-with-where */

/* eslint-enable unicorn/no-null */
/* eslint-enable max-lines */
