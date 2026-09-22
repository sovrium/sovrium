/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The five SCHEMA reads the design-system console runs on:
 *
 *  - `GET /api/admin/schema/component-types`               — the catalogue, as rows.
 *  - `GET /api/admin/schema/component-types/:type`         — one type's fields.
 *  - `GET /api/admin/schema/component-types/:type/options` — every option, at depth.
 *  - `GET /api/admin/schema/field-types`                   — the FIELD catalogue, as rows.
 *  - `GET /api/admin/design-system/provenance`             — why a class is on an element.
 *
 * The `?flat=1` projection of the token document is the fourth read of the same
 * family and lives beside the document it projects, in `design-system.ts`.
 *
 * ─── READ ONLY, AND STRUCTURALLY SO ────────────────────────────────────────
 *
 * Three GET handlers, no request body schema, no write path: [internal ref] A2 puts
 * authoring outside the self-hosted product, and reading the schema is
 * observability. There is nothing a caller can send.
 *
 * ─── THE 404s ARE ANTI-ENUMERATION, NOT ERROR HANDLING ─────────────────────
 *
 * A caller without the admin tier is answered 404 by `requireAdminTier()`
 * upstream (`admin-route-guards.ts`), never 401 or 403 — a status confirming
 * the route exists is itself a signal (standing rule S1). The per-type 404 in
 * {@link handleGetComponentTypeDetail} is the same shape one level down, and
 * [internal ref] draws the line at CATALOGUED rather than at drawable: a name the
 * catalogue does not publish 404s — the `editors` category permanently, because
 * its SSR placeholders ship a live write path — while a type it LISTS but
 * refuses to draw is served with `drawable: false` and its reason. The listing
 * already publishes every catalogued name with its refusal sentence, so that
 * 404 was protecting a set that is not secret, and nothing draws either way.
 *
 * ─── AND THE AUDIT ROW IS ON THE LIST, NOT ON EVERY READ ───────────────────
 *
 * The catalogue is what an operator exports into a shared context window, so
 * "who read it, and when" has to be answerable. A per-type read and a
 * provenance read are navigation INSIDE that surface — one console page visit
 * fires a dozen — and writing a row for each would drown the entry that matters
 * in traffic that records nothing new about the operator.
 */

import { emitAuditEvent } from '@/application/use-cases/admin/audit-log/emit'
import {
  componentTypeCategories,
  componentTypeDetail,
  componentTypeOptions,
  listComponentTypes,
  listFieldTypes,
} from '@/application/use-cases/admin/design-system-schema'
import { resolveActor } from '@/application/use-cases/admin/resolve-actor'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import {
  componentTypeDetailQuerySchema,
  componentTypeDetailSchema,
  componentTypeListResponseSchema,
  componentTypeOptionsQuerySchema,
  componentTypeOptionsResponseSchema,
  provenanceQuerySchema,
  provenanceResponseSchema,
} from '@/domain/models/api/admin/design-system/component-types'
import { fieldTypeListResponseSchema } from '@/domain/models/api/admin/design-system/field-types'
import { decodeSafe } from '@/domain/models/api/combinators/decode'
import { runDomainPromise } from '@/infrastructure/logging/request-effect'
import { effectValidator } from '@/presentation/api/runtime/effect-validator'
import { parseOptionalCap } from '@/presentation/api/runtime/query-cap-parsers'
import { buildClassProvenance } from '@/presentation/render/styling/class-provenance-report'
import type {
  ComponentTypeDetailQuery,
  ComponentTypeOptionsQuery,
  ProvenanceQuery,
} from '@/domain/models/api/admin/design-system/component-types'
import type { App } from '@/domain/models/app'
import type { ContextWithSession } from '@/presentation/api/middleware/auth'
import type { Context, Hono } from 'hono'

/** The response every read here carries. See the module note on caching. */
const NO_STORE = 'no-store'

/**
 * The 404 both per-type reads answer for an uncatalogued name.
 *
 * ONE spelling, because the two handlers share an anti-enumeration property
 * rather than merely a shape: the body says `Not found` and nothing about
 * component types, so a caller cannot tell a name this catalogue withholds from
 * a name nobody ever declared. Two copies diverge one helpful message at a time
 * — `Component type not found` on a single handler is enough to leak the
 * distinction back, and it would read as an improvement in review.
 *
 * Spelled as the module-level constant `agents.ts` and `connections.ts` already
 * use for this same envelope.
 */
const NOT_FOUND = { success: false, message: 'Not found', code: 'NOT_FOUND' } as const

/**
 * A 500 for a payload that failed its own contract.
 *
 * Validating BEFORE serialising is what makes `strictKeys` do any work: a field
 * smuggled into the response is refused here rather than published to a
 * consumer that then depends on it. Same shape as the export beside it.
 */
const contractFailure = (c: Context, what: string): Response =>
  c.json({ success: false, message: `Failed to build ${what}`, code: 'INTERNAL_ERROR' }, 500)

/** Record who read the catalogue. See the module note on why only this one. */
async function auditCatalogueRead(c: Context): Promise<void> {
  const { session } = (c as ContextWithSession).var
  if (!session) return
  const actor = await runDomainPromise(c, resolveActor(session.userId))
  await emitAuditEvent({
    action: AUDIT_ACTIONS.CONFIG_DESIGN_QUERIED,
    actor,
    resourceId: session.userId,
    severity: 'info',
    result: 'success',
  })
}

/** `GET /api/admin/schema/component-types` — every catalogued type, as rows. */
export async function handleListComponentTypes(c: Context, app: App): Promise<Response> {
  const items = listComponentTypes(app)
  // Counted from `items`, so the nav and the grid beneath it cannot disagree.
  const categories = componentTypeCategories(items)
  const parsed = decodeSafe(componentTypeListResponseSchema)({
    items,
    total: items.length,
    categories,
    // The SAME figures in the shape a dot path can address, folded from the one
    // call above rather than counted a second time: a navigation badge resolves
    // `categoryCounts.<slug>` by walking the envelope, and a dot path cannot
    // index an array by a member's field. Two shapes, one derivation, so they
    // can never disagree.
    categoryCounts: Object.fromEntries(
      categories.map((category) => [category.slug, category.count])
    ),
  })
  if (!parsed.success) return contractFailure(c, 'the component-type catalogue')

  await auditCatalogueRead(c)

  // The catalogue is fixed for a given BUILD but not for a given deploy, and it
  // is admin-scoped: a shared cache holding it would answer "what can this
  // engine draw?" with what the previous version drew.
  c.header('Cache-Control', NO_STORE)
  return c.json(parsed.data, 200)
}

/**
 * `GET /api/admin/schema/field-types` — every table field type, as rows.
 *
 * Takes no `app`, and that is the contract: the field catalogue is derived from
 * the schema alone, so it describes what a table MAY declare rather than what
 * this instance's tables do. Two instances on one build answer identically.
 *
 * No audit row. The sibling that writes one is the component CATALOGUE, because
 * that is the surface an operator exports into a shared context window; this is
 * a static list of type names with no operator content in it at all.
 */
export function handleListFieldTypes(c: Context): Response {
  const items = listFieldTypes()
  const parsed = decodeSafe(fieldTypeListResponseSchema)({ items, total: items.length })
  if (!parsed.success) return contractFailure(c, 'the field-type catalogue')

  // Same reasoning as the component catalogue: fixed for a BUILD, not for a
  // deploy, and admin-scoped — a shared cache would answer "what may a table
  // declare?" with what the previous version accepted.
  c.header('Cache-Control', NO_STORE)
  return c.json(parsed.data, 200)
}

/**
 * `GET /api/admin/schema/component-types/:type` — one type's fields.
 *
 * Takes the app because the detail now carries the operator's own usage — which
 * of THEIR routes write this type, and how many — beside the engine facts. That
 * half is a function of the config, exactly as the listing's `pageCount` is, and
 * for the same reason: a row template binds ONE rows source, so a page reading
 * the detail cannot also read `/api/admin/design-system/usage` and match by name.
 */
export function handleGetComponentTypeDetail(c: Context, app: App): Response {
  // `c.req.valid` is typed off the fluent chain, and these handlers take a bare
  // `Context` so they stay callable from a test and from the chain alike — the
  // same shape every sibling admin handler has. The cast names exactly what
  // `effectValidator('query', componentTypeDetailQuerySchema)` put there.
  const { routesLimit } = (
    c.req as unknown as { readonly valid: (target: 'query') => ComponentTypeDetailQuery }
  ).valid('query')
  // `?routesLimit=0` is "tell me how many without listing them" and is honoured;
  // an unusable value is read as no cap rather than refused — see
  // `parseOptionalCap`, which the `?rows=` cap next door shares.
  const detail = componentTypeDetail(c.req.param('type') ?? '', app, parseOptionalCap(routesLimit))
  // Only an UNCATALOGUED name lands here — an unpublished category (`editors`)
  // or a typo. A refused-but-listed type is served; see the module note.
  if (detail === undefined) {
    return c.json(NOT_FOUND, 404)
  }

  const parsed = decodeSafe(componentTypeDetailSchema)(detail)
  if (!parsed.success) return contractFailure(c, 'the component-type detail')

  c.header('Cache-Control', NO_STORE)
  return c.json(parsed.data, 200)
}

/**
 * `GET /api/admin/schema/component-types/:type/options` — every option, at depth.
 *
 * The read the Configuration section is drawn from. Its sibling one segment up
 * publishes a type's fields ONE level deep, which is the right answer for a
 * props table and not enough for a section that has to name `columns[].format`
 * and list its twelve values.
 *
 * Takes no `app`, and that is the contract: an option tree is derived from the
 * schema alone, so it describes what the ENGINE accepts rather than what this
 * instance declares. Two instances on one build answer identically.
 *
 * No audit row, for the reason the module note gives: the audited surface is
 * the catalogue LIST, and a per-type read is navigation inside it.
 */
export function handleGetComponentTypeOptions(c: Context): Response {
  // `c.req.valid` is typed off the fluent chain, and these handlers take a bare
  // `Context` so they stay callable from a test and from the chain alike — the
  // same shape every sibling admin handler has. The cast names exactly what
  // `effectValidator('query', componentTypeOptionsQuerySchema)` put there.
  const { group } = (
    c.req as unknown as { readonly valid: (target: 'query') => ComponentTypeOptionsQuery }
  ).valid('query')
  const options = componentTypeOptions(c.req.param('type') ?? '', group)
  // Only an UNCATALOGUED name lands here. A type the catalogue lists but
  // refuses to DRAW is served — see the use case.
  if (options === undefined) {
    return c.json(NOT_FOUND, 404)
  }

  const parsed = decodeSafe(componentTypeOptionsResponseSchema)(options)
  if (!parsed.success) return contractFailure(c, 'the component-type option tree')

  c.header('Cache-Control', NO_STORE)
  return c.json(parsed.data, 200)
}

/**
 * `GET /api/admin/design-system/provenance?type=&part=` — the layer chain.
 *
 * An unknown `type` is NOT a 404 here, and the asymmetry with the detail route
 * is deliberate: `design.components` is an open record keyed by engine type, so
 * the honest answer for a type nobody has styled is an EMPTY chain — "nothing
 * contributes classes to this part" — which is the same answer a real but
 * untouched type gets. A 404 would claim the type does not exist, which this
 * endpoint is in no position to say and which the catalogue answers already.
 */
export function handleGetClassProvenance(c: Context, app: App): Response {
  // `c.req.valid` is typed off the fluent chain, and these handlers take a bare
  // `Context` so that they stay callable from a test and from the chain alike —
  // the same shape every sibling admin handler has. The cast names exactly what
  // `effectValidator('query', provenanceQuerySchema)` put there.
  const { type, part } = (
    c.req as unknown as { readonly valid: (target: 'query') => ProvenanceQuery }
  ).valid('query')
  const report = buildClassProvenance({
    ...(app.design === undefined ? {} : { design: app.design }),
    type,
    part,
  })

  const parsed = decodeSafe(provenanceResponseSchema)({ type, ...report })
  if (!parsed.success) return contractFailure(c, 'the class provenance chain')

  c.header('Cache-Control', NO_STORE)
  return c.json(parsed.data, 200)
}

/**
 * Chain the five schema reads onto a Hono instance.
 *
 * `resolveApp` is the live-App resolver (not the boot-time `app`) so a config
 * reload is reflected without a restart — a provenance chain describing the
 * previous deploy's `design.components` is worse than none.
 */
export function chainAdminDesignSystemSchemaRoutes<T extends Hono>(
  honoApp: T,
  resolveApp: () => App
): T {
  return (
    honoApp
      .get('/api/admin/schema/component-types', (c) => handleListComponentTypes(c, resolveApp()))
      // Adjacent to the bare `:type` route below because the two are one pair,
      // and NOT because the order is load-bearing — the same framing as the
      // `field-types` note further down. A Hono path parameter matches exactly
      // one segment, so `:type` never sees `.../button/options` whichever way
      // round the two are declared: measured against all five routers Hono
      // ships (Smart, RegExp, Trie, Pattern, Linear) with the bare route
      // registered FIRST, and every one of them still dispatched here.
      //
      // Order would start to decide if either were ever widened to a `*`, which
      // matches greedily and takes whichever was registered first. That is the
      // edit to think twice about — not a reordering of these two.
      // The `?group=` narrowing is DECODED rather than read raw, so the one
      // query this route takes is part of its published contract and an
      // unrecognised param is refused rather than ignored — the same treatment
      // the provenance read gets below.
      .get(
        '/api/admin/schema/component-types/:type/options',
        effectValidator('query', componentTypeOptionsQuerySchema),
        (c) => handleGetComponentTypeOptions(c)
      )
      // `?routesLimit=` is DECODED rather than read raw, on the same terms as
      // the `?group=` narrowing above: the one query this route takes is part of
      // its published contract, so an unrecognised param is refused instead of
      // ignored. Declared AFTER the `/options` route for the reason given there
      // — the pairing, not an ordering requirement.
      .get(
        '/api/admin/schema/component-types/:type',
        effectValidator('query', componentTypeDetailQuerySchema),
        (c) => handleGetComponentTypeDetail(c, resolveApp())
      )
      // Declared BEFORE the `:type` route would ever see it, and that ordering is
      // not load-bearing here — `field-types` sits under `/schema/`, not under
      // `/schema/component-types/`, so no parameter could capture it. Kept beside
      // its sibling because a reader looking for "the schema reads" wants all
      // five in one place.
      .get('/api/admin/schema/field-types', (c) => handleListFieldTypes(c))
      .get(
        '/api/admin/design-system/provenance',
        effectValidator('query', provenanceQuerySchema),
        (c) => handleGetClassProvenance(c, resolveApp())
      ) as T
  )
}
