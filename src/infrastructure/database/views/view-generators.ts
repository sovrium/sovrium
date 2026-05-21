/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { quoteSqlIdentifier } from '@/domain/utils/sql-formatting'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import {
  getExistingViews,
  getExistingMaterializedViews,
  executeSQLStatements,
  executeSQLStatementsParallel,
  type TransactionLike,
} from '../sql/sql-execution'
import { generateSqlCondition } from '../table-queries/filter-operators'
import type { Table } from '@/domain/models/app/tables'
import type { View } from '@/domain/models/app/tables/views'
import type { ViewFilterNode } from '@/domain/models/app/tables/views/filters'

const dropViewStatement = (viewName: string): string => {
  const quoted = quoteSqlIdentifier(viewName)
  return isSqliteRuntime()
    ? `DROP VIEW IF EXISTS ${quoted}`
    : `DROP VIEW IF EXISTS ${quoted} CASCADE`
}

const mapFilterConditions = (nodes: readonly ViewFilterNode[]): readonly string[] => {
  return nodes
    .map((node) => {
      if ('field' in node && 'operator' in node && 'value' in node) {
        return generateSqlCondition(node.field, node.operator, node.value)
      }
      return ''
    })
    .filter((c) => c !== '')
}

const generateWhereClause = (filters: View['filters']): string => {
  if (!filters) return ''

  if ('and' in filters && filters.and) {
    const conditions = mapFilterConditions(filters.and)
    return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  }

  if ('or' in filters && filters.or) {
    const conditions = mapFilterConditions(filters.or)
    return conditions.length > 0 ? `WHERE ${conditions.join(' OR ')}` : ''
  }

  return ''
}

const generateOrderByClause = (sorts: View['sorts'], groupBy: View['groupBy']): string => {
  const groupByItems = groupBy
    ? [`${groupBy.field} ${(groupBy.direction || 'asc').toUpperCase()}`]
    : []

  const sortItems =
    sorts && sorts.length > 0 && !groupBy
      ? sorts.map((sort) => `${sort.field} ${sort.direction.toUpperCase()}`)
      : []

  const orderItems = [...groupByItems, ...sortItems]

  return orderItems.length > 0 ? `ORDER BY ${orderItems.join(', ')}` : ''
}

export const generateViewSQL = (table: Table, view: View): string => {
  const viewType = view.materialized ? 'MATERIALIZED VIEW' : 'VIEW'
  const viewIdStr = quoteSqlIdentifier(String(view.id))

  if (view.query) {
    return `CREATE ${viewType} ${viewIdStr} AS ${view.query}`
  }

  const fields = view.fields && view.fields.length > 0 ? view.fields.join(', ') : '*'
  const whereClause = generateWhereClause(view.filters)
  const orderByClause = generateOrderByClause(view.sorts, view.groupBy)

  const clauses = [`SELECT ${fields}`, `FROM ${table.name}`, whereClause, orderByClause].filter(
    (clause) => clause !== ''
  )

  const query = clauses.join(' ')

  return `CREATE ${viewType} ${viewIdStr} AS ${query}`
}

export const generateTableViewStatements = (table: Table): readonly string[] => {
  if (!table.views || table.views.length === 0) return []

  const sqlViews = table.views.filter((view) => view.query || typeof view.id !== 'number')
  return sqlViews.map((view) => generateViewSQL(table, view))
}

export const generateReadOnlyViewTrigger = (viewId: string | number): readonly string[] => {
  const viewIdStr = String(viewId)
  const quotedViewId = quoteSqlIdentifier(viewIdStr)
  const triggerBaseName = `${viewIdStr.replace(/[^a-z0-9_]/gi, '_')}_readonly`

  return [
    `CREATE OR REPLACE FUNCTION ${triggerBaseName}_insert_fn()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'cannot insert into view "%"', TG_TABLE_NAME;
    END;
    $$ LANGUAGE plpgsql`,
    `CREATE TRIGGER ${triggerBaseName}_insert
    INSTEAD OF INSERT ON ${quotedViewId}
    FOR EACH ROW EXECUTE FUNCTION ${triggerBaseName}_insert_fn()`,

    `CREATE OR REPLACE FUNCTION ${triggerBaseName}_update_fn()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'cannot update view "%"', TG_TABLE_NAME;
    END;
    $$ LANGUAGE plpgsql`,
    `CREATE TRIGGER ${triggerBaseName}_update
    INSTEAD OF UPDATE ON ${quotedViewId}
    FOR EACH ROW EXECUTE FUNCTION ${triggerBaseName}_update_fn()`,

    `CREATE OR REPLACE FUNCTION ${triggerBaseName}_delete_fn()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'cannot delete from view "%"', TG_TABLE_NAME;
    END;
    $$ LANGUAGE plpgsql`,
    `CREATE TRIGGER ${triggerBaseName}_delete
    INSTEAD OF DELETE ON ${quotedViewId}
    FOR EACH ROW EXECUTE FUNCTION ${triggerBaseName}_delete_fn()`,
  ]
}

export const generateDropObsoleteViewsSQL = async (
  tx: TransactionLike,
  tables: readonly Table[]
): Promise<void> => {
  const program = Effect.gen(function* () {
    const [existingViewNames, existingMatViewNames] = yield* Effect.all(
      [getExistingViews(tx), getExistingMaterializedViews(tx)],
      { concurrency: 2 }
    )

    const existingViews = new Set(existingViewNames)
    const existingMatViews = new Set(existingMatViewNames)

    const allSchemaViewIds = new Set<string>(
      tables.flatMap((table) =>
        table.views && table.views.length > 0 ? table.views.map((view) => String(view.id)) : []
      )
    )

    const viewsToDrop = Array.from(existingViews).filter(
      (viewName) => !allSchemaViewIds.has(viewName)
    )
    const matViewsToDrop = Array.from(existingMatViews).filter(
      (viewName) => !allSchemaViewIds.has(viewName)
    )

    const dropViewStatements = viewsToDrop.map(dropViewStatement)
    const dropMatViewStatements = matViewsToDrop.map(
      (viewName) => `DROP MATERIALIZED VIEW IF EXISTS ${quoteSqlIdentifier(viewName)} CASCADE`
    )

    yield* executeSQLStatements(tx, [...dropViewStatements, ...dropMatViewStatements])
  })

  await Effect.runPromise(program)
}

export const dropAllObsoleteViews = async (
  tx: TransactionLike,
  tables: readonly Table[]
): Promise<void> => {
  const program = Effect.gen(function* () {
    const [existingViewNames, existingMatViewNames] = yield* Effect.all(
      [getExistingViews(tx), getExistingMaterializedViews(tx)],
      { concurrency: 2 }
    )

    const allSchemaViews = new Set<string>(
      tables.flatMap((table) => (table.views ? table.views.map((view) => String(view.id)) : []))
    )

    const viewsToDrop = existingViewNames.filter((viewName) => !allSchemaViews.has(viewName))
    const matViewsToDrop = existingMatViewNames.filter((viewName) => !allSchemaViews.has(viewName))

    const dropViewStatements = viewsToDrop.map(dropViewStatement)
    const dropMatViewStatements = matViewsToDrop.map(
      (viewName) => `DROP MATERIALIZED VIEW IF EXISTS ${quoteSqlIdentifier(viewName)} CASCADE`
    )

    if (dropViewStatements.length > 0 || dropMatViewStatements.length > 0) {
      yield* executeSQLStatementsParallel(tx, [...dropViewStatements, ...dropMatViewStatements])
    }
  })

  await Effect.runPromise(program)
}
