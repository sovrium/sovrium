/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `GET /api/admin/mcp/tools` — the tools this config exposes, projected for
 * display and optionally narrowed to one family.
 *
 * The listing itself is `listMcpTools` (`domain/utils/admin-mcp-tool-listing.ts`),
 * which already existed to feed the MCP docs page and is reused verbatim rather
 * than re-derived. Two properties of that module are what make it the right
 * source, and both are load-bearing for this endpoint's promise:
 *
 *  - its tool NAMES are a faithful mirror of `compileMcpTools`, so an operator
 *    reading the console and an AI reading `tools/list` see one set of
 *    identifiers — the property an admin config MCP tools spec asserts by naming
 *    the exact `{appName}_{entity}_{operation}` strings rather than counting;
 *  - its DESCRIPTIONS come from the shared builders in
 *    `domain/models/shared/ai-access` that the wire-format compiler also calls,
 *    which is precisely why the facts-not-strings rule admits `description` into the payload
 *    despite it being an English sentence: it is not the console's sentence.
 *
 * It also lives in the domain layer, where the wire compiler does not — the
 * application layer may not reach into `infrastructure/server` for behaviour,
 * and a second copy of the naming convention is exactly how the console and the
 * protocol would come to disagree.
 *
 * `category` is a DISCRIMINANT, not a heading: the words "Data", "Actions" and
 * "Automations" exist nowhere but on the console page and stay in its config.
 */

import { listAdminReadTools } from '@/application/use-cases/admin/admin-read-registry'
import { listMcpTools } from '@/domain/models/app/admin/admin-mcp-tool-listing'
import type {
  McpToolCategory,
  McpToolListing,
  McpToolsResponse,
} from '@/domain/models/api/admin/mcp'
import type { App } from '@/domain/models/app'

/** What the listing needs to know about the running MCP server. */
export interface McpToolsListingOptions {
  /**
   * `MCP_EXPOSE_INTERNALS`. With it off the server offers no admin read tool,
   * and the listing never shows a tool the server would not offer.
   */
  readonly exposeInternals: boolean
}

/**
 * The listing, narrowed when a category is given.
 *
 * `total` counts the tools MATCHING the request rather than the whole
 * catalogue: that is the figure a consumer paging or gating on this response
 * needs, and a `total` ignoring the filter would tell a narrowed caller there
 * are more rows to fetch than exist.
 *
 * The `admin` category is answered ONLY when asked for. The admin read tools
 * are compiled from the app's name on every instance, so they are not config
 * exposure: the default listing and its `total` stay config-derived, and a
 * config exposing nothing still answers an empty array and a zero.
 */
export function buildMcpToolsResponse(
  app: App,
  category: McpToolCategory | undefined,
  options: McpToolsListingOptions
): McpToolsResponse {
  if (category === 'admin') {
    const tools: ReadonlyArray<McpToolListing> = options.exposeInternals
      ? listAdminReadTools(app.name).map((tool) => ({ ...tool, category: 'admin' as const }))
      : []
    return { tools, total: tools.length }
  }
  const tools = listMcpTools(app).filter(
    (tool) => category === undefined || tool.category === category
  )
  return { tools, total: tools.length }
}
