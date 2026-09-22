/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The four reads the three Developers console pages compose themselves from
 * (`/_admin/api`, `/_admin/mcp`, `/_admin/changelog?view=current`):
 *
 *  - `GET /api/admin/instance`             — the resolved origin, the declared
 *                                            tables, the RFC-computed OAuth
 *                                            application type, and the counts.
 *  - `GET /api/admin/mcp/tools`            — the tools this config exposes.
 *  - `GET /api/admin/config/reflection`    — the serialized config + flat counts.
 *  - `GET /api/admin/config/declarations`  — the declaration tree's rows.
 *
 * ─── WHY THEY EXIST AT ALL ─────────────────────────────────────────────────
 *
 * All three pages were hand-written TypeScript builders, because each is a
 * FUNCTION of the operator's app that a preset page cannot compute. These reads
 * publish those functions so the pages can be config — which is what makes the
 * "the console IS a config app" claim true rather than true-in-most-places.
 *
 * ─── FACTS, NEVER SENTENCES ──────────────────────────────────────
 *
 * A field is REFUSED when it embeds a choice belonging to the console — a word,
 * a sentence, a label, an ordering meant to be read. It is ADMITTED when it is a
 * fact the console cannot compute (a count, a derived boolean, a resolved
 * origin, an RFC-computed enum) or a mechanical serialization of a payload the
 * response already carries. The test is EDITORIAL CONTENT, not string-ness.
 *
 * So there is no `registerCurl` here, no joined example list, no `${origin}/api`
 * and no category heading. `/api/admin/*` is in the published OpenAPI document,
 * so a rendered curl would freeze a comment line, its backslash continuations
 * and its quoting into a contract under Hyrum's law — and could never be
 * translated, because `$t:` substitution runs over `props` and not over a
 * payload.
 *
 * ─── AUTHORISATION ─────────────────────────────────────────────────────────
 *
 * Read-only reflections of the running configuration, so [internal ref] amendment A1
 * governs them exactly as it governs `/api/admin/config/schema` and
 * `/api/admin/env`. The anti-enumeration 404 (rule S1) is wired upstream by
 * `requireAdminTier()` in `admin-route-guards.ts`, which 404s BOTH the
 * missing-session and the wrong-role caller: a 401 would confirm that this
 * address answers to an admin, and an inventory of what an instance runs — or
 * of which tools it exposes to an AI, which is a map of its write surface — is
 * a useful map to anyone deciding whether to keep attacking.
 *
 * All four paths are listed EXPLICITLY in both mirrors of the guard registry.
 * `/api/admin/instance` and `/api/admin/mcp/*` are new namespaces, and an
 * ungated sibling inside a guarded namespace is how a gap starts.
 */

import {
  buildConfigDeclarations,
  buildConfigReflection,
} from '@/application/use-cases/admin/config/config-reflection'
import { buildInstanceFacts } from '@/application/use-cases/admin/config/instance-facts'
import { buildMcpToolsResponse } from '@/application/use-cases/admin/config/mcp-tool-listing'
import {
  configDeclarationFamilySchema,
  configDeclarationsResponseSchema,
  configReflectionResponseSchema,
} from '@/domain/models/api/admin/config'
import { instanceFactsResponseSchema } from '@/domain/models/api/admin/instance'
import { mcpToolCategorySchema, mcpToolsResponseSchema } from '@/domain/models/api/admin/mcp'
import { decodeSafe } from '@/domain/models/api/combinators/decode'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

/**
 * How this request's public origin is resolved.
 *
 * INJECTED rather than imported. The shared resolver
 * (`infrastructure/server/route-setup/resolve-base-url.ts`) is the one every
 * surface that must PRINT this instance's address already uses — the SEO
 * routes, the OpenAPI document's `servers[0].url`, and the console pages — and
 * promoting it rather than writing a third is the ruling the origin contract
 * encodes. But a presentation route may not reach into `infrastructure/server`
 * for behaviour, so the composition root supplies it instead. The alternative,
 * a second resolver living on this side of the boundary, is exactly the
 * duplication the contract forbids.
 */
export type OriginResolver = (c: Context) => string

/**
 * The canonical 400 for a query param outside its closed vocabulary.
 *
 * Answering an empty list instead would read to an operator as "this instance
 * declares nothing" / "this config exposes no tools", which is the one wrong
 * answer a typo must not produce — and it is indistinguishable from the real
 * empty state the page is designed to show.
 */
function badRequest(c: Context, message: string, code: string): Response {
  return c.json({ success: false, message, code }, 400)
}

/**
 * The canonical 500 for a response the endpoint built but could not encode.
 *
 * A decode failure here means the projection and its published contract have
 * drifted, which is a server defect and never the caller's — so it is not
 * softened into an empty 200.
 */
function encodeFailure(c: Context, what: string): Response {
  return c.json({ success: false, message: `Failed to build ${what}`, code: 'INTERNAL_ERROR' }, 500)
}

/**
 * A config reflection is the least appropriate payload in the product for a
 * shared cache to hold: admin-scoped, changing on every deploy, and a stale hit
 * would answer "what is running?" with what USED to run — the exact failure mode
 * these endpoints exist to eliminate. The instance facts additionally resolve
 * their origin from the request that asked.
 */
function noStore(c: Context): void {
  c.header('Cache-Control', 'no-store')
}

/**
 * A positive integer `limit`, or `undefined` when absent.
 *
 * A malformed value is treated as absent rather than refused: `limit` narrows a
 * display list, so the honest degradation is showing everything. That is the
 * opposite direction from `family` and `category`, which name a closed
 * vocabulary where a typo's silent answer is actively misleading.
 */
function parseLimit(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

/** `GET /api/admin/instance` — every fact the API and MCP pages gate and template on. */
export function handleGetInstanceFacts(c: Context, app: App, origin: string): Response {
  const body = buildInstanceFacts(app, origin, parseLimit(c.req.query('limit')))
  const parsed = decodeSafe(instanceFactsResponseSchema)(body)
  if (!parsed.success) return encodeFailure(c, 'instance facts response')
  noStore(c)
  return c.json(parsed.data, 200)
}

/** `GET /api/admin/mcp/tools` — the exposed tools, optionally narrowed. */
export function handleGetMcpTools(c: Context, app: App): Response {
  const raw = c.req.query('category')
  const decoded = raw === undefined ? undefined : decodeSafe(mcpToolCategorySchema)(raw)
  if (decoded !== undefined && !decoded.success) {
    return badRequest(
      c,
      'Unknown tool category. Expected one of: table, action, automation.',
      'INVALID_CATEGORY'
    )
  }

  const body = buildMcpToolsResponse(app, decoded?.success === true ? decoded.data : undefined)
  const parsed = decodeSafe(mcpToolsResponseSchema)(body)
  if (!parsed.success) return encodeFailure(c, 'mcp tools response')
  noStore(c)
  return c.json(parsed.data, 200)
}

/** `GET /api/admin/config/reflection` — the Schema page's own record. */
export function handleGetConfigReflection(c: Context, app: App): Response {
  const parsed = decodeSafe(configReflectionResponseSchema)(buildConfigReflection(app, process.env))
  if (!parsed.success) return encodeFailure(c, 'config reflection response')
  noStore(c)
  return c.json(parsed.data, 200)
}

/** `GET /api/admin/config/declarations` — the declaration tree's rows. */
export function handleGetConfigDeclarations(c: Context, app: App): Response {
  const raw = c.req.query('family')
  const decoded = raw === undefined ? undefined : decodeSafe(configDeclarationFamilySchema)(raw)
  if (decoded !== undefined && !decoded.success) {
    return badRequest(
      c,
      'Unknown config family. Expected one of: tables, pages, forms, automations, agents, buckets, connections.',
      'INVALID_FAMILY'
    )
  }

  const body = buildConfigDeclarations(
    app,
    process.env,
    decoded?.success === true ? decoded.data : undefined
  )
  const parsed = decodeSafe(configDeclarationsResponseSchema)(body)
  if (!parsed.success) return encodeFailure(c, 'config declarations response')
  noStore(c)
  return c.json(parsed.data, 200)
}

/**
 * Chain the four Developers reads onto a Hono instance.
 *
 * `resolveApp` is the live-App resolver (not the boot-time `app`) so a config
 * reload is reflected without a restart — the whole promise of these endpoints
 * is that they describe what is running NOW. `resolveOrigin` is the shared
 * base-URL resolver, injected for the boundary reason {@link OriginResolver}
 * records.
 */
export function chainAdminDeveloperReadRoutes<T extends Hono>(
  honoApp: T,
  resolveApp: () => App,
  resolveOrigin: OriginResolver
): T {
  return honoApp
    .get('/api/admin/instance', (c) => handleGetInstanceFacts(c, resolveApp(), resolveOrigin(c)))
    .get('/api/admin/mcp/tools', (c) => handleGetMcpTools(c, resolveApp()))
    .get('/api/admin/config/reflection', (c) => handleGetConfigReflection(c, resolveApp()))
    .get('/api/admin/config/declarations', (c) => handleGetConfigDeclarations(c, resolveApp())) as T
}
