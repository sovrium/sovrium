/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `SOVRIUM_DB_QUERY_HEADER` env var — operator toggle for the
 * `X-Sovrium-Db-Queries` response header (the per-request DB query-count
 * seam; see `@/infrastructure/telemetry/db-query-counter`).
 *
 * When enabled, every HTTP response carries an `X-Sovrium-Db-Queries: <n>`
 * header — the number of SQL statements issued while serving that request.
 *
 * ## Default `off` — SECURITY-load-bearing, not a style choice
 *
 * Unlike `ECO_INDEX_HEADER` (default `on`), this header defaults OFF and must
 * stay that way. Always-on, it lets an unauthenticated caller distinguish
 * "404 because the row does not exist" (few queries) from "404 because you
 * lack permission" (more queries — the permission checks ran) — defeating the
 * anti-enumeration guarantee of standing rule S1
 *. Do NOT
 * flip this default; only the ONLY-when-emitting gate is env-controlled, the
 * counting itself is unconditional and feeds the span attribute and the
 * `db.query.per_request` histogram, neither of which is client-visible.
 *
 * Parsing mirrors the `ECO_*` contract: unset/empty resolves to the
 * default; a SET-but-unrecognised value throws so a typo is never silently
 * read as "unset". The parser is called at REQUEST time by the middleware
 * (operator toggles take effect without a restart, matching
 * `ECO_INDEX_HEADER`); there is currently no boot-time validation pass for
 * `SOVRIUM_*` telemetry vars, so a typo surfaces as a loud per-request error
 * naming the variable rather than a boot refusal.
 */
import { parseEcoEnum } from '../eco/eco-env-parsing'

export type DbQueryHeaderMode = 'on' | 'off'

const DB_QUERY_HEADER_MODES: readonly DbQueryHeaderMode[] = ['on', 'off']

/** Default when `SOVRIUM_DB_QUERY_HEADER` is unset — OFF (anti-enumeration). */
export const DEFAULT_DB_QUERY_HEADER: DbQueryHeaderMode = 'off'

/**
 * Resolve `SOVRIUM_DB_QUERY_HEADER` from a snapshot of env vars. Only an
 * explicit `on` (case-insensitive, surrounding whitespace ignored) enables
 * the header.
 *
 * @throws Error when set to anything other than `on` or `off`.
 */
export const parseDbQueryHeader = (
  processEnv: Readonly<Record<string, string | undefined>>
): DbQueryHeaderMode =>
  parseEcoEnum('SOVRIUM_DB_QUERY_HEADER', processEnv['SOVRIUM_DB_QUERY_HEADER'], {
    allowed: DB_QUERY_HEADER_MODES,
    fallback: DEFAULT_DB_QUERY_HEADER,
  })
