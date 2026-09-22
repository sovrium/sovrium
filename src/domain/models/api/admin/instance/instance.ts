/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for `GET /api/admin/instance` — the facts the console's two
 * Developers docs pages need in order to compose themselves.
 *
 * Source story: [internal ref]
 *
 * ─── WHY THIS PUBLISHES FACTS AND NOT SENTENCES ───────────────────
 *
 * The `/api` and `/mcp` pages print addresses and commands an operator pastes
 * into a shell. The tempting shape for an endpoint serving them is the finished
 * artifact — a `registerCurl` string, a joined list of example requests — and it
 * is refused. Three reasons, none of them taste:
 *
 *  - The prose is the CONSOLE's, and the console is not this endpoint's only
 *    reader. `/api/admin/*` is in the published OpenAPI document, so a rendered
 *    curl freezes a comment line, its backslash continuations and its quoting
 *    into a contract under Hyrum's law. What the page needs from that curl is
 *    two facts: the origin and the OAuth application type.
 *  - It forecloses translation. `$t:` substitution runs over `props`, so a
 *    server-rendered English comment inside a code block can never be
 *    translated, while the same line composed in config from `$record.origin`
 *    can.
 *  - It is not reusable, which is the test that matters. Another config app
 *    cannot consume this console's sentences; it can consume this instance's
 *    origin.
 *
 * The rule the whole payload is built to: **a field is refused when it embeds a
 * choice that belongs to the console — a word, a sentence, a label, an ordering
 * meant to be read. A field is admitted when it is a fact the console cannot
 * compute** (a count, a derived boolean, a resolved origin, an RFC-computed
 * enum). `defaultState` on the sibling env endpoint is the same call
 * made in the small; this is it made in the large.
 *
 * Consequently there is no `apiBaseUrl` and no `mcpEndpoint` here, though both
 * were drafted: `${origin}/api` and `${origin}/mcp` are compositions the config
 * performs with one substitution, and publishing them would be the endpoint
 * doing the page's job.
 *
 * ─── AUTHORISATION ──────────────────────────────────────────────────────────
 *
 * A read-only reflection of the running configuration, so [internal ref] amendment A1
 * governs it exactly as it governs `/api/admin/config/schema` and
 * `/api/admin/env`: reading is observability, mutating is authoring. There is no
 * request schema because there is nothing a caller can send but a page size.
 *
 * The anti-enumeration 404 (rule S1) is wired upstream by `requireAdminTier()`,
 * which 404s both the missing-session and the wrong-role caller. Nothing here
 * carries a value, a credential, or a path on the host.
 */

import { Schema } from 'effect'
import { looseIsoDateTime } from '@/domain/models/api/combinators/formats'

/**
 * The `application_type` an OAuth client registering a redirect URI on THIS
 * instance's own origin must send (RFC 8252 §7.3, RFC 7591).
 *
 * A computed FACT about the instance, not a label: an `http` loopback redirect
 * URI is legal only for a `native` client, and every other origin — notably a
 * deployed `https` one — is genuinely `web`. Omitting the field defaults a
 * client to `web`, which is refused `400 invalid_redirect_uri` on the
 * zero-config self-hosted posture, so a console printing a registration body
 * without it hands the operator a command that cannot work.
 *
 * The console cannot compute this: config has no URL parser and no way to test a
 * host against the three loopback spellings the RFC names.
 */
export const oauthApplicationTypeSchema = Schema.Literals(['native', 'web']).annotate({
  identifier: 'OAuthApplicationType',
  description:
    "The application_type a client registering a redirect URI on this instance's origin must send. `native` for an http loopback origin (RFC 8252 §7.3), `web` otherwise.",
})

/** @public */
export type OAuthApplicationType = typeof oauthApplicationTypeSchema.Type

/**
 * One declared table, by the name its REST routes are keyed on.
 *
 * Name only. A docs page composing `GET /api/tables/<name>/records` needs the
 * identifier and nothing else, and the per-table roll-up an operator might also
 * want — row counts, soft-deleted backlog, last write — already has its own
 * endpoint at `/api/admin/tables/overview`. Two projections of the same entity
 * that disagree is the failure mode a second aggregation path always produces.
 */
export const instanceTableSchema = Schema.Struct({
  name: Schema.String.annotate({
    description: "The table's name, as its REST routes are keyed on it",
  }),
}).annotate({ identifier: 'InstanceTable' })

/** @public */
export type InstanceTable = typeof instanceTableSchema.Type

/**
 * `GET /api/admin/instance` — every fact the API and MCP docs pages gate and
 * template on.
 *
 * The counts are FLAT rather than nested under a `counts` object, and that is
 * load-bearing rather than stylistic: `visibility.record` names ONE record
 * field, so a nested `counts.table` is unreachable by the gate that has to
 * decide whether a category heading renders at all.
 */
export const instanceFactsResponseSchema = Schema.Struct({
  origin: Schema.String.annotate({
    description:
      'The instance\'s resolved public origin, no trailing slash. BASE_URL, else the proxy/Host headers, else the request URL — the order the docs pages already encode. Config composes "$record.origin/api" and "$record.origin/mcp" from it.',
    examples: ['https://app.example.com'],
  }),
  version: Schema.NullOr(Schema.String).annotate({
    description: "The running config's declared `app.version`, or null when it declares none.",
  }),
  apiKeysEnabled: Schema.Boolean.annotate({
    description:
      'Whether the app opted into `auth.apiKeys`. The API page gates its key-management pointer on this: without the opt-in the endpoints and the page both 404, and a link to a 404 is worse than no link.',
  }),
  oauthApplicationType: oauthApplicationTypeSchema,
  exampleTable: Schema.NullOr(Schema.String).annotate({
    description:
      "The FIRST declared table's name — the one the single-call examples (cURL, JavaScript, the create line) are written against. Null when the app declares no table. Declaration order, so every example on the page names the same table.",
  }),
  tableCount: Schema.Finite.annotate({
    description:
      'How many tables the config declares. The gate for "this app has an API surface at all" — a fact, where "no tables yet" is a sentence the console keeps.',
  }),
  tables: Schema.Array(instanceTableSchema).annotate({
    description:
      "The declared tables in DECLARATION order — the operator's own grouping, which is information. Capped by the `limit` query param. Read for its ROWS by the API page's example block, which folds one `GET /api/tables/$record.name/records` line per table into a single code block.",
  }),
  mcpToolCount: Schema.Finite.annotate({
    description:
      'Total MCP tools this config exposes. Zero is the common configuration, and the MCP page gates its honest empty state on it.',
  }),
  mcpToolCountTable: Schema.Finite.annotate({
    description:
      'MCP tools in the `table` category. The MCP page gates that category\'s heading on `{ field: mcpToolCountTable, gt: 0 }` — which is why the count is published and the heading word "Data" is not.',
  }),
  mcpToolCountAction: Schema.Finite.annotate({
    description: "MCP tools in the `action` category; gates that category's heading.",
  }),
  mcpToolCountAutomation: Schema.Finite.annotate({
    description: "MCP tools in the `automation` category; gates that category's heading.",
  }),
  generatedAt: looseIsoDateTime({
    description:
      'ISO 8601 UTC timestamp of the read. Per-request, because the resolved origin depends on the request that asked.',
  }),
}).annotate({ identifier: 'InstanceFactsResponse' })

/** @public */
export type InstanceFactsResponse = typeof instanceFactsResponseSchema.Type
