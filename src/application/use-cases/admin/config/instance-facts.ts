/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The facts the console's `/api` and `/mcp` docs pages compose themselves from.
 *
 * Both pages print addresses and commands an operator pastes into a shell, and
 * every one of those is a function of the running app. [internal ref] rules that this
 * endpoint publishes the FACTS and the console composes the strings: no curl, no
 * joined example list, no heading, no `${origin}/api`.
 *
 * The counts are FLAT rather than nested under a `counts` object, and that is
 * load-bearing rather than stylistic: `visibility.record` names ONE record field
 * with no path syntax, so a nested `counts.mcpToolTable` is unreachable by the
 * gate that has to decide whether a category heading renders at all.
 */

import { oauthApplicationTypeFor } from '@/domain/kernel/url/oauth-loopback'
import { listMcpTools } from '@/domain/models/app/admin/admin-mcp-tool-listing'
import type { InstanceFactsResponse } from '@/domain/models/api/admin/instance'
import type { McpToolCategory } from '@/domain/models/api/admin/mcp'
import type { App } from '@/domain/models/app'

/**
 * Build the instance facts for one request.
 *
 * `origin` is resolved by the ROUTE through the shared `resolveRequestBaseUrl`
 * — the same resolver the live SEO routes and the served OpenAPI document's
 * `servers[0].url` use. It is threaded in rather than resolved here because it
 * depends on the request that asked, which is also why `generatedAt` is
 * per-request.
 *
 * `limit` caps the `tables` array only. The counts stay whole: a page folding
 * the first four table names still gates "this app has an API surface at all"
 * on `tableCount`, and a capped count would make a five-table app look like a
 * four-table one.
 */
export function buildInstanceFacts(
  app: App,
  origin: string,
  limit?: number
): InstanceFactsResponse {
  const tables = app.tables ?? []
  const mcpTools = listMcpTools(app)
  const countOf = (category: McpToolCategory): number =>
    mcpTools.filter((tool) => tool.category === category).length

  /* eslint-disable unicorn/no-null -- `version` and `exampleTable` are declared `Schema.NullOr` on the published contract, and the null is load-bearing: a config gate has a value to compare against where an ABSENT key coerces to the string "undefined" and matches nothing. */
  return {
    origin,
    version: app.version ?? null,
    // `=== true` rather than truthiness, matching the `auth.apiKeys` capability
    // predicate: the key is a plain boolean an operator can write `false` to,
    // and on that config every `/api/auth/api-key/*` route is left unregistered
    // — so the page's key-management pointer must be gated exactly as the
    // endpoints are, or it links to a 404.
    apiKeysEnabled: app.auth?.apiKeys === true,
    oauthApplicationType: oauthApplicationTypeFor(origin),
    // DECLARATION order throughout, never sorted: the operator's own grouping
    // is information, and the first declared table is the one every single-call
    // example on the page names, so `exampleTable` and `tables[0]` must agree.
    exampleTable: tables[0]?.name ?? null,
    tableCount: tables.length,
    tables: (limit === undefined ? tables : tables.slice(0, limit)).map((table) => ({
      name: table.name,
    })),
    mcpToolCount: mcpTools.length,
    mcpToolCountTable: countOf('table'),
    mcpToolCountAction: countOf('action'),
    mcpToolCountAutomation: countOf('automation'),
    generatedAt: new Date().toISOString(),
  }
  /* eslint-enable unicorn/no-null */
}
