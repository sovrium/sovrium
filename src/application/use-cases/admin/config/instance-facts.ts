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
 * every one of those is a function of the running app. The facts-not-strings rule rules that this
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
import { appRequiresAi } from '@/domain/models/app/requires-ai'
import {
  resolveAiEcoRouting,
  resolveOllamaBaseUrl,
} from '@/domain/models/process-env/ai/ai-eco-routing'
import { parseDatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'
import { parseStorageEnvConfig } from '@/domain/models/process-env/storage/storage'
import type { InstanceFactsResponse } from '@/domain/models/api/admin/instance'
import type { McpToolCategory } from '@/domain/models/api/admin/mcp'
import type { App } from '@/domain/models/app'
import type { Table } from '@/domain/models/app/tables'

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
 *
 * `labelOf` names a table for people, in the caller's language. It is threaded
 * in for the same reason as `origin`: the language belongs to the request.
 */
export function buildInstanceFacts(
  app: App,
  origin: string,
  limit: number | undefined,
  labelOf: (table: Table) => string
): Omit<InstanceFactsResponse, keyof InstanceRuntimeFacts> {
  const tables = app.tables ?? []
  const example = tables[0]
  const mcpTools = listMcpTools(app)
  const countOf = (category: McpToolCategory): number =>
    mcpTools.filter((tool) => tool.category === category).length

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
    exampleTable: example?.name ?? null,
    ...(example === undefined ? {} : { exampleTableLabel: labelOf(example) }),
    tableCount: tables.length,
    tables: (limit === undefined ? tables : tables.slice(0, limit)).map((table) => ({
      name: table.name,
      label: labelOf(table),
    })),
    mcpToolCount: mcpTools.length,
    mcpToolCountTable: countOf('table'),
    mcpToolCountAction: countOf('action'),
    mcpToolCountAutomation: countOf('automation'),
    generatedAt: new Date().toISOString(),
  }
}

/** What the instance runs on, as the instance read adds them to its facts. */
type InstanceRuntimeFacts = Pick<
  InstanceFactsResponse,
  'bootedAt' | 'database' | 'storage' | 'aiProvider'
>

/**
 * What this instance runs on, read from the process: when it started (the
 * host's one boot instant, handed in by the read, so every read naming the
 * boot names the same one), its database engine and its storage provider by
 * their words, and the AI provider routing would pick — `null` for an app that
 * declares nothing calling a model. Words only: no address, key or credential
 * of any of them.
 */
export function buildInstanceRuntimeFacts(
  app: App,
  bootedAt: string,
  processEnv: Readonly<Record<string, string | undefined>> = process.env
): InstanceRuntimeFacts {
  const routing = appRequiresAi(app)
    ? resolveAiEcoRouting(processEnv, resolveOllamaBaseUrl(processEnv) !== undefined)
    : undefined
  return {
    bootedAt,
    database: parseDatabaseDialectConfig().dialect === 'postgres' ? 'postgresql' : 'sqlite',
    storage: parseStorageEnvConfig().provider,
    aiProvider: routing?.resolvedProvider ?? null,
  }
}
