/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { translateFormulaToSqlite } from './formula-sqlite-translation'
import { translateFormulaToPostgres } from './formula-utils'

/**
 * The dialect seam for formula SQL.
 *
 * Every formula-to-SQL path used to call `translateFormulaToPostgres` directly,
 * which made the whole formula subsystem Postgres-only BY CONSTRUCTION: there
 * was no SQLite arm to reach and no branch that could have reached one. On the
 * zero-config default engine that produced SQL SQLite cannot execute.
 *
 * Routing every call site through this function means adding an engine is a
 * change to ONE dispatch, and a formula path can no longer silently assume
 * Postgres.
 *
 * Reachability of the four call sites, as it stands (measured 2026-07-26):
 *
 *   - `view-formula-generators.ts` — reachable on BOTH dialects. View-computed
 *     formulas (those referencing a rollup/lookup/count) are rendered into the
 *     `CREATE VIEW` on either engine. This is the site the SQLite arm exists for.
 *   - `formula-trigger-generators.ts` (×2) — Postgres-only TODAY, because
 *     `table-features.ts` skips the whole advanced-trigger block on SQLite (it
 *     emits PL/pgSQL). Dispatching anyway means the day SQLite grows a trigger
 *     path, it inherits the right translation rather than the wrong one.
 *   - `sql-column-generators.ts` — Postgres-only TODAY, because
 *     `formulaEmitsPlainColumn` short-circuits on SQLite (no
 *     `GENERATED ALWAYS AS`). Same reasoning.
 *
 * @throws {UnsupportedInSqliteError} on SQLite, when the formula calls a
 * function that engine does not provide — raised at DDL-generation time rather
 * than left to fail at the first write.
 */
export const translateFormula = (
  formula: string,
  allFields?: readonly { name: string; type: string }[]
): string =>
  isSqliteRuntime()
    ? translateFormulaToSqlite(formula, allFields)
    : translateFormulaToPostgres(formula, allFields)
