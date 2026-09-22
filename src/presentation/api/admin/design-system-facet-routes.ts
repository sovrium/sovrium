/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The seven FACET reads that describe **this operator's** design system:
 *
 *  - `GET /api/admin/design-system/tokens?group=`   — the resolved tokens, + counts.
 *  - `GET /api/admin/design-system/guidance?kind=`  — the declared prose, split.
 *  - `GET /api/admin/design-system/coverage?key=`   — which layers they declared.
 *  - `GET /api/admin/design-system/exports`         — what each export weighs.
 *  - `GET /api/admin/design-system/usage?subject=`  — where a type is written.
 *  - `GET /api/admin/design-system/brand`           — the mark, as rows.
 *  - `GET /api/admin/design-system/zones`           — the zones, as rows.
 *  - `GET /api/admin/design-system/type-ladder`     — the PLATFORM ladder, as rows.
 *
 * The schema reads next door (`design-system-schema.ts`) publish the component
 * REGISTRY — invariant for a given build. Every answer here is a function of the
 * operator's own `App`, which is why each needed an endpoint at all: a console
 * page transcribed into config renders literals and envelopes, and cannot count,
 * filter, introspect or split a string.
 *
 * ─── READ ONLY, AND STRUCTURALLY SO ────────────────────────────────────────
 *
 * Seven GET handlers, no request-body schema, no write path. [internal ref] A2 puts
 * authoring outside the self-hosted product and reading the running
 * configuration is observability, so there is nothing a caller can send.
 *
 * ─── THE 404s ARE ANTI-ENUMERATION, NOT ERROR HANDLING ─────────────────────
 *
 * A caller without the admin tier is answered 404 by `requireAdminTier()`
 * upstream (`admin-route-guards.ts`), never 401 or 403 — a status confirming the
 * route exists is itself a signal (standing rule S1). None of the five ever
 * answers 404 itself: an unknown token group, coverage key or usage name returns
 * zero rows, because "nothing there" is the truthful answer and a 404 would let
 * a caller enumerate what exists by probing. The one refusal is an unknown
 * guidance `kind`, which the closed union in the contract rejects with a 400 —
 * that set IS named, so a caller asking for `voice.forbid` has made a mistake
 * the contract can name rather than one that should ship as an empty table.
 *
 * ─── AND NOT ONE OF THEM WRITES AN AUDIT ROW ───────────────────────────────
 *
 * Deliberate, and stated by the contract rather than inferred: one console page
 * visit fires several of these, and recording each would drown the entry that
 * matters — the EXPORT, which is what an operator pastes into a shared context
 * window — in navigation that records nothing new about them. The two export
 * routes beside this module keep their emit; these carry strictly less than the
 * document those already serve.
 *
 * @see src/domain/models/api/admin/design-system/facets.ts
 */

import { brandFacet, zonesFacet } from '@/application/use-cases/admin/design-system-brand-facet'
import { coverageFacet } from '@/application/use-cases/admin/design-system-coverage'
import {
  designTokenFacet,
  exportsFacet,
  guidanceFacet,
  typeLadderFacet,
} from '@/application/use-cases/admin/design-system-facets'
import { usageFacet } from '@/application/use-cases/admin/design-system-usage-facet'
import {
  brandFacetResponseSchema,
  designZonesResponseSchema,
  designCoverageQuerySchema,
  designCoverageResponseSchema,
  designSystemExportsResponseSchema,
  designTokenFacetResponseSchema,
  designTokenQuerySchema,
  typeLadderResponseSchema,
  guidanceListResponseSchema,
  guidanceQuerySchema,
  usageQuerySchema,
  usageResponseSchema,
} from '@/domain/models/api/admin/design-system/facets'
import { decodeSafe } from '@/domain/models/api/combinators/decode'
import { effectValidator } from '@/presentation/api/runtime/effect-validator'
import type {
  DesignCoverageQuery,
  DesignTokenQuery,
  GuidanceQuery,
  UsageQuery,
} from '@/domain/models/api/admin/design-system/facets'
import type { App } from '@/domain/models/app'
import type { Schema } from 'effect'
import type { Context, Hono } from 'hono'

/** The response every read here carries. See the module note on caching. */
const NO_STORE = 'no-store'

/**
 * A 500 for a payload that failed its own contract.
 *
 * Validating BEFORE serialising is what makes `strictKeys` do any work: a field
 * smuggled into the response is refused here rather than published to a consumer
 * that then depends on it. Same shape as the schema reads beside it.
 */
const contractFailure = (c: Context, what: string): Response =>
  c.json({ success: false, message: `Failed to build ${what}`, code: 'INTERNAL_ERROR' }, 500)

/**
 * The validated query, as `effectValidator` left it.
 *
 * `c.req.valid` is typed off the fluent chain, and these handlers take a bare
 * `Context` so that they stay callable from a test and from the chain alike —
 * the same shape every sibling admin handler has. The cast names exactly what
 * the paired `effectValidator('query', …)` put there.
 */
const validQuery = <Q>(c: Context): Q =>
  (c.req as unknown as { readonly valid: (target: 'query') => Q }).valid('query')

/**
 * Serve one facet, or fail loudly against its own contract.
 *
 * A design system is admin-scoped and changes on every deploy, so a shared cache
 * holding one of these would answer "what does this app look like?" with what it
 * USED to look like — the exact failure the console exists to eliminate.
 */
const served = <S extends Schema.Top>(
  c: Context,
  schema: S,
  payload: unknown,
  what: string
): Response => {
  const parsed = decodeSafe(schema)(payload)
  if (!parsed.success) return contractFailure(c, what)
  c.header('Cache-Control', NO_STORE)
  return c.json(parsed.data, 200)
}

/** `GET /api/admin/design-system/tokens?group=` — the resolved tokens, + counts. */
export function handleGetDesignTokens(c: Context, app: App): Response {
  const { group } = validQuery<DesignTokenQuery>(c)
  return served(
    c,
    designTokenFacetResponseSchema,
    designTokenFacet(app, group),
    'the design token facet'
  )
}

/** `GET /api/admin/design-system/guidance?kind=&label=` — the declared prose, split. */
export function handleGetDesignGuidance(c: Context, app: App): Response {
  // `label` narrows to one subject, which is what a per-component card asks for
  // through its nested `{ system }` binding. It composes with `kind`, and an
  // unknown subject answers zero rows rather than 404 — see the query contract.
  const { kind, label } = validQuery<GuidanceQuery>(c)
  return served(
    c,
    guidanceListResponseSchema,
    guidanceFacet(app, kind, label),
    'the guidance listing'
  )
}

/** `GET /api/admin/design-system/coverage?key=` — which layers they declared. */
export function handleGetDesignCoverage(c: Context, app: App): Response {
  const { key } = validQuery<DesignCoverageQuery>(c)
  return served(c, designCoverageResponseSchema, coverageFacet(app, key), 'the declaration ledger')
}

/** `GET /api/admin/design-system/exports` — what each export weighs. */
export function handleGetDesignExports(c: Context, app: App): Response {
  return served(c, designSystemExportsResponseSchema, exportsFacet(app), 'the export ledger')
}

/** `GET /api/admin/design-system/usage?subject=&name=` — where a subject is written. */
export function handleGetDesignUsage(c: Context, app: App): Response {
  const { subject, name } = validQuery<UsageQuery>(c)
  // `type` is the question asked most, so it is what an unqualified read means.
  return served(
    c,
    usageResponseSchema,
    usageFacet(app, subject ?? 'type', name),
    'the usage ledger'
  )
}

/** `GET /api/admin/design-system/brand` — the declared mark, as rows. */
export function handleGetDesignBrand(c: Context, app: App): Response {
  return served(c, brandFacetResponseSchema, brandFacet(app), 'the brand facet')
}

/** `GET /api/admin/design-system/zones` — the declared zones, as rows. */
export function handleGetDesignZones(c: Context, app: App): Response {
  return served(c, designZonesResponseSchema, zonesFacet(app), 'the zones listing')
}

/**
 * `GET /api/admin/design-system/type-ladder` — the PLATFORM ladder, as rows.
 *
 * Takes no `app`. The ladder belongs to the engine's stylesheet, so this is a
 * build constant and two instances on one build answer identically — which is
 * what makes it safe to draw beside a disclosure saying the operator declared
 * no type scale of their own.
 */
export function handleGetTypeLadder(c: Context): Response {
  return served(c, typeLadderResponseSchema, typeLadderFacet(), 'the platform type ladder')
}

/**
 * Chain the eight facet reads onto a Hono instance.
 *
 * `resolveApp` is the live-App resolver (not the boot-time `app`) so a config
 * reload is reflected without a restart — a token table describing the previous
 * deploy's palette is worse than none, which is the same reason the exports
 * beside it resolve live.
 */
export function chainAdminDesignSystemFacetRoutes<T extends Hono>(
  honoApp: T,
  resolveApp: () => App
): T {
  return (
    honoApp
      .get(
        '/api/admin/design-system/tokens',
        effectValidator('query', designTokenQuerySchema),
        (c) => handleGetDesignTokens(c, resolveApp())
      )
      .get(
        '/api/admin/design-system/guidance',
        effectValidator('query', guidanceQuerySchema),
        (c) => handleGetDesignGuidance(c, resolveApp())
      )
      .get(
        '/api/admin/design-system/coverage',
        effectValidator('query', designCoverageQuerySchema),
        (c) => handleGetDesignCoverage(c, resolveApp())
      )
      .get('/api/admin/design-system/exports', (c) => handleGetDesignExports(c, resolveApp()))
      .get('/api/admin/design-system/usage', effectValidator('query', usageQuerySchema), (c) =>
        handleGetDesignUsage(c, resolveApp())
      )
      // No query: the mark is a singleton. A `?variant=` filter was considered and
      // left out — the page draws both panels together, and one row is already the
      // answer for the common case.
      .get('/api/admin/design-system/brand', (c) => handleGetDesignBrand(c, resolveApp()))
      .get('/api/admin/design-system/zones', (c) => handleGetDesignZones(c, resolveApp()))
      // No query and no app: a build constant, unlike every read above it.
      .get('/api/admin/design-system/type-ladder', (c) => handleGetTypeLadder(c)) as T
  )
}
