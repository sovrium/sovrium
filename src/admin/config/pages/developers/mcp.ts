/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// MCP — connect an AI client to this instance, and see what it would reach.
//
// ─── WHY IT WAS A BUILDER, AND WHY IT IS NOT ANY MORE ──────────────────────
//
// 519 lines of TypeScript, and every one of the three wiring blocks was a
// function of the running instance: the mount address is the resolved origin,
// and the registration body's `application_type` is decided by whether that
// origin is an http LOOPBACK one (RFC 8252 §7.3). Config has no URL parser, so
// it could not compute the second at all.
//
// `/api/admin/instance` publishes both as FACTS — `origin` and
// `oauthApplicationType` — and the page composes the curl around them. That is
// the rule exactly: the endpoint answers what config cannot compute, the console
// keeps the words. A `registerCurl` field would have frozen this file's comment
// line, its backslash continuations and its quoting into a published OpenAPI
// contract, and could never be translated.
//
// ─── TWO `$record` NAMESPACES ON ONE PAGE ──────────────────────────────────
//
// The scalars come from the PAGE record (`dataSource: { system }`); the tool
// rows come from row templates bound to `/api/admin/mcp/tools`. Those are two
// namespaces, and they only coexist because `applyPageLevelRecordBinding` walks
// with the COLLECTION-template substitution, which leaves the children of a
// `dataSource`-bearing node alone. Under the plain walk the page record would
// win — it runs first — and every `$record.name` in a tool row would resolve
// against the instance facts, which have no `name`, and render as the empty
// string. Silently: nothing throws, and the rows come out blank.
//
// ─── THE HEADINGS GATE ON COUNTS, NOT ON ROWS ──────────────────────────────
//
// "Data", "Actions" and "Automations" exist nowhere but on this page, so they
// are not published. Each group gates on the count `/api/admin/instance`
// publishes for its category (`gt: 0`), and the empty state on `mcpToolCount
// eq: 0`. That is why the counts are FLAT on that payload: `visibility.record`
// names one field and has no path syntax, so a nested `counts.table` would be
// unreachable by the gate that decides whether the heading renders at all.
//
// Publishing the count is also what makes the "no empty-state slot on a system
// row template" seam irrelevant here: the empty state is a sibling gated on a
// number, not a slot on the binding.

import dashboardMcpDocs from './dashboard-mcp-docs.page.json'
import type { Page as PageConfig } from '@/domain/models/app'

export default dashboardMcpDocs as PageConfig
