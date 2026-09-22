/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for `GET /api/admin/mcp/tools` — the MCP tools this config
 * exposes, as ROWS the console's MCP page renders through a row template.
 *
 * Source story: [internal ref]
 *
 * ─── WHY A `description` IS ADMITTED HERE AND A HEADING IS NOT ────
 *
 * [internal ref] refuses a field that embeds a choice belonging to the console. A tool
 * `description` is the sharpest boundary case in the whole payload — it is an
 * English sentence — and it is admitted, for a reason that is checkable rather
 * than aesthetic: it is **not the console's sentence**. `listMcpTools` builds it
 * from the SAME `buildTableToolDescription` / `buildActionToolDescription` /
 * `buildAutomationToolDescription` helpers the wire-format compiler
 * (`mcp/tool-compiler.ts`) calls, so the string this endpoint returns is the one
 * an AI client already receives over `tools/list`. It is platform-published data
 * about the tool, and the docs page's whole promise is that what it shows is
 * what the server advertises.
 *
 * The category HEADINGS are the other side of that line. "Data", "Actions" and
 * "Automations" exist nowhere but on this page; they are the console naming its
 * own grouping. They stay in config, gated on the per-category counts
 * `/api/admin/instance` publishes — which is why this endpoint returns a
 * `category` discriminant and not a label.
 *
 * The empty state is the same call once more. "No tools exposed yet" and the
 * line telling an operator to add `aiAccess` are sentences this page writes, so
 * this endpoint's answer to a config exposing nothing is an empty array and a
 * zero, never a message.
 *
 * ─── AUTHORISATION ──────────────────────────────────────────────────────────
 *
 * A read-only reflection of the running configuration under [internal ref] amendment
 * A1. The listing is pure config-derivation and is NOT gated by `MCP_ENABLED` —
 * that env var gates the `/mcp` server mount, not the question "what would this
 * config expose". The anti-enumeration 404 (rule S1) is wired upstream by
 * `requireAdminTier()`.
 *
 * A tool name is `{appName}_{entity}_{operation}` — an identifier the operator
 * chose, carrying no credential and no host path.
 */

import { Schema } from 'effect'

/**
 * Which config entity a tool derives from.
 *
 * A discriminant, not a label. It is what the `category` query param filters on
 * and what a config gate would compare against; the words a reader sees are the
 * console's and live in its own config.
 */
export const mcpToolCategorySchema = Schema.Literals(['table', 'action', 'automation']).annotate({
  identifier: 'McpToolCategory',
  description:
    "Which config entity the tool derives from: a table, an action template, or a manual automation. A discriminant — the heading a reader sees is the console's own copy.",
})

/** @public */
export type McpToolCategory = typeof mcpToolCategorySchema.Type

/**
 * One exposed tool, projected for display.
 *
 * Deliberately NOT the wire-format tool: no JSON-Schema input shape, no
 * annotations, no output schema. A docs page shows an operator which tools their
 * config exposes; the authoritative wire contract is the MCP server's own
 * `tools/list`, and publishing a second full projection of it here would create
 * two descriptions of one tool that could drift apart.
 */
export const mcpToolListingSchema = Schema.Struct({
  name: Schema.String.annotate({
    description:
      'The exact tool name the MCP server advertises over tools/list ({appName}_{entity}_{operation}). Mirrored rather than re-derived, so an operator reading the console and an AI reading the protocol see one identifier.',
    examples: ['partner-app_demandes_read'],
  }),
  category: mcpToolCategorySchema,
  description: Schema.String.annotate({
    description:
      "The tool's own one-line description, from the shared builders the wire-format compiler also calls — the same string an AI client receives. Platform-published data about the tool, not console copy.",
  }),
}).annotate({ identifier: 'McpToolListing' })

/** @public */
export type McpToolListing = typeof mcpToolListingSchema.Type

/**
 * `GET /api/admin/mcp/tools` — the exposed tools, optionally narrowed to one
 * category by the `category` query param.
 *
 * `total` counts the tools MATCHING the request rather than the whole catalogue,
 * which is the figure a consumer paging or gating on this response needs. The
 * console does not read it: its headings gate on the per-category counts
 * `/api/admin/instance` publishes, so one page render asks one endpoint for its
 * gates and another for its rows, and neither has to be fetched twice to answer
 * the other's question.
 */
export const mcpToolsResponseSchema = Schema.Struct({
  tools: Schema.Array(mcpToolListingSchema).annotate({
    description:
      'The exposed tools, in catalogue order (tables, then actions, then automations). Empty when the config exposes none — which is the DEFAULT posture, since nothing is exposed without an explicit `aiAccess`.',
  }),
  total: Schema.Finite.annotate({
    description:
      'How many tools match this request — narrowed by `category` when the param is present, the whole catalogue otherwise.',
  }),
}).annotate({ identifier: 'McpToolsResponse' })

/** @public */
export type McpToolsResponse = typeof mcpToolsResponseSchema.Type
