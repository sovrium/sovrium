/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { quoteSqlIdentifier } from '@/domain/kernel/sql/sql-formatting'
import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import { getViewFormulaLayers, buildLayeredViewSQL } from '../formula/view-formula-generators'
import { buildComputedSelectClause, buildForwardLookupJoins } from './lookup-computed-columns'
import {
  getBaseTableName,
  isCountField,
  isLookupField,
  isRollupField,
  shouldUseView,
} from './lookup-field-kinds'
import {
  getBaseFields,
  getUpdateBaseFields,
  getInsertValueExpressions,
  getInsertIdExpression,
  getInsertCreatedAtColumn,
  generateInsertTrigger,
  generateUpdateTrigger,
  generateDeleteTrigger,
  generateInsertTriggerSqlite,
  generateUpdateTriggerSqlite,
  generateDeleteTriggerSqlite,
} from './lookup-view-triggers'
import type { Table } from '@/domain/models/app/tables'
import type { DatabaseDialect } from '@/domain/models/process-env/database/database-dialect'

export {
  getBaseTableName,
  getPhysicalTableName,
  getViewBodyReferencedTables,
  shouldUseView,
} from './lookup-field-kinds'

/**
 * Generate CREATE VIEW statement for a table with lookup, rollup, and/or count fields
 * Replaces the base table with a VIEW that includes looked-up, aggregated, and counted columns
 * Returns empty string if table has no lookup, rollup, or count fields
 */
export const generateLookupViewSQL = (
  table: Table,
  allTables: readonly Table[],
  dialect: DatabaseDialect
): string => {
  const lookupFields = table.fields.filter(isLookupField)
  const rollupFields = table.fields.filter(isRollupField)
  const countFields = table.fields.filter(isCountField)

  if (lookupFields.length === 0 && rollupFields.length === 0 && countFields.length === 0) {
    return '' // No lookup, rollup, or count fields - no VIEW needed
  }

  const sanitized = sanitizeTableName(table.name)

  // Build JOIN clauses for forward lookups
  const joins = buildForwardLookupJoins(lookupFields, table.fields, table.name)

  // Computed (lookup/rollup/count) column SELECT list, over the base table.
  const computedSelectClause = buildComputedSelectClause(table, allTables, dialect)

  // Dialect-aware view-replacement keyword: PostgreSQL supports
  // `CREATE OR REPLACE VIEW`; SQLite has no `OR REPLACE`, so emit a plain
  // `CREATE VIEW`. On a full migration the view is already gone on both
  // engines: `reconcileViewTopology` drops every lookup view before the base
  // tables change (Postgres's OR REPLACE cannot drop or reorder a column), and
  // `createLookupViewsEffect` drops any survivor with `DROP VIEW IF EXISTS`.
  const createView = dialect === 'sqlite' ? 'CREATE VIEW' : 'CREATE OR REPLACE VIEW'

  const fromClause = `FROM ${quoteSqlIdentifier(`${sanitized}_base`)} AS base
  ${joins ? joins : ''}`

  // Formulas that reference view-only fields (rollup/lookup/count) are computed
  // HERE in the view — never as base-table columns. A formula cannot reference a
  // sibling SELECT alias on Postgres, so the lookup/rollup/count computation is
  // wrapped in a CTE and each formula is layered on top (one CTE layer per
  // formula, in dependency order so formula-over-formula chains resolve).
  const formulaLayers = getViewFormulaLayers(table.fields, dialect)

  if (formulaLayers.length === 0) {
    // No view-computed formulas — keep the historical single-SELECT shape.
    return `${createView} ${quoteSqlIdentifier(sanitized)} AS
  SELECT
    ${computedSelectClause}
  ${fromClause}`
  }

  return buildLayeredViewSQL({
    createView,
    viewName: quoteSqlIdentifier(sanitized),
    computedSelectClause,
    fromClause,
    formulaLayers,
  })
}

/**
 * Generate INSTEAD OF triggers for a VIEW to make it writable.
 * These triggers redirect INSERT/UPDATE/DELETE operations to the base table.
 *
 * Dialect-aware:
 *
 * - **PostgreSQL** emits `CREATE OR REPLACE FUNCTION … LANGUAGE plpgsql`
 *   wrappers + `CREATE TRIGGER … EXECUTE FUNCTION` — the only way to attach
 *   a body to a PG trigger.
 *
 * - **SQLite** emits plain inline `CREATE TRIGGER … INSTEAD OF … BEGIN …
 *   END;` blocks. No function wrapper, no `OR REPLACE` (preceded by
 *   `DROP TRIGGER IF EXISTS` instead), no `FOR EACH ROW` clause (implicit on
 *   SQLite INSTEAD OF triggers). The trigger body is a plain statement list
 *   that references `NEW.<col>` / `OLD.<col>` exactly the way the PG bodies
 *   do — so the redirect target (`*_base` table + writable column list,
 *   matched on `id`) is identical between the two dialects.
 *
 * Writable column list (`getBaseFields`) already excludes computed (lookup /
 * rollup / count) and one-to-many / many-to-many relationship fields plus
 * `id` — the same exclusions apply on both dialects.
 */
export const generateLookupViewTriggers = (
  table: Table,
  dialect: DatabaseDialect
): readonly string[] => {
  if (!shouldUseView(table)) {
    return [] // No VIEW, no triggers needed
  }

  const sanitized = sanitizeTableName(table.name)
  const baseTableName = getBaseTableName(sanitized)
  const viewName = sanitized
  const baseFields = getBaseFields(table)
  // The UPDATE trigger writes a WIDER list than the INSERT trigger: it must
  // also carry the automatic `deleted_at` column so soft delete / restore
  // through the view are not silently dropped. INSERT deliberately keeps the
  // narrow list — an omitted `deleted_at` takes the base column's own NULL
  // default, so there is nothing for the insert path to carry.
  const updateBaseFields = getUpdateBaseFields(table)
  // DEFAULT-bearing columns, the automatic created_at too, are COALESCE(NEW.col, <default>).
  const createdAt = getInsertCreatedAtColumn(table, dialect)
  const insertValues = [...getInsertValueExpressions(table, dialect), ...createdAt.values]

  // The INSERT trigger PRESERVES an explicitly-provided `id` (kept out of
  // getBaseFields — the UPDATE/DELETE triggers must never rewrite it — so it is
  // prepended only here). See getInsertIdExpression for the per-dialect,
  // per-primary-key-type semantics.
  const insertFields = ['id', ...baseFields, ...createdAt.fields]
  const insertFieldValues = [getInsertIdExpression(table, baseTableName, dialect), ...insertValues]

  if (dialect === 'sqlite') {
    return [
      ...generateInsertTriggerSqlite(viewName, baseTableName, insertFields, insertFieldValues),
      ...generateUpdateTriggerSqlite(viewName, baseTableName, updateBaseFields),
      ...generateDeleteTriggerSqlite(viewName, baseTableName),
    ]
  }

  return [
    ...generateInsertTrigger(viewName, baseTableName, insertFields, insertFieldValues),
    ...generateUpdateTrigger(viewName, baseTableName, updateBaseFields),
    ...generateDeleteTrigger(viewName, baseTableName),
  ]
}
