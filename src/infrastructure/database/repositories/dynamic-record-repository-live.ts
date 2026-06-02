/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { sql } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  DynamicRecordError,
  DynamicRecordRepository,
  type DynamicRecordFilter,
} from '@/application/ports/repositories/dynamic-record-repository'
import { db } from '@/infrastructure/database'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import { generateSqlConditionFragment } from '@/infrastructure/database/table-queries/filter-operators'
import {
  castToFloat,
  countAsIntSelectClause,
} from '@/infrastructure/database/table-queries/query-helpers/aggregation-helpers'

const wrap = makeDbWrap((cause) => new DynamicRecordError({ cause }))

const whereClause = (filter: DynamicRecordFilter | undefined) =>
  filter === undefined
    ? sql``
    : sql` WHERE ${generateSqlConditionFragment(filter.column, 'equals', filter.value)}`

export const DynamicRecordRepositoryLive = Layer.succeed(DynamicRecordRepository, {
  count: (input) =>
    wrap(async () => {
      const query = sql`SELECT ${countAsIntSelectClause()} AS count FROM ${sql.identifier(
        input.table
      )}${whereClause(input.filter)}`
      const result = (await db.execute(query)) as unknown as ReadonlyArray<{
        readonly count: number
      }>
      return Number(result[0]?.count ?? 0)
    }),

  aggregate: (input) =>
    wrap(async () => {
      const aggExpr =
        input.fn === 'AVG'
          ? castToFloat(sql`AVG(${sql.identifier(input.column)})`)
          : castToFloat(sql`SUM(${sql.identifier(input.column)})`)
      const query = sql`SELECT ${aggExpr} AS value FROM ${sql.identifier(
        input.table
      )}${whereClause(input.filter)}`
      const result = (await db.execute(query)) as unknown as ReadonlyArray<{
        readonly value: number | null
      }>
      const value = result[0]?.value
      return value === null || value === undefined ? undefined : Number(value)
    }),

  list: (input) =>
    wrap(async () => {
      const orderBy =
        input.sortColumn !== undefined
          ? sql` ORDER BY ${sql.identifier(input.sortColumn)} DESC`
          : sql``
      const query = sql`SELECT * FROM ${sql.identifier(input.table)}${whereClause(
        input.filter
      )}${orderBy} LIMIT ${input.limit}`
      return (await db.execute(query)) as unknown as ReadonlyArray<Record<string, unknown>>
    }),

  insert: (input) =>
    wrap(async () => {
      const entries = Object.entries(input.data)
      const query =
        entries.length === 0
          ? sql`INSERT INTO ${sql.identifier(input.table)} DEFAULT VALUES RETURNING id`
          : sql`INSERT INTO ${sql.identifier(input.table)} (${sql.join(
              entries.map(([key]) => sql.identifier(key)),
              sql`, `
            )}) VALUES (${sql.join(
              entries.map(([, value]) => sql`${value}`),
              sql`, `
            )}) RETURNING id`
      const result = (await db.execute(query)) as unknown as ReadonlyArray<{
        readonly id: number | string
      }>
      return result[0]?.id ?? 0
    }),

  updateById: (input) =>
    wrap(async () => {
      const assignments = sql.join(
        Object.entries(input.data).map(([key, value]) => sql`${sql.identifier(key)} = ${value}`),
        sql`, `
      )
      const result = (await db.execute(
        sql`UPDATE ${sql.identifier(
          input.table
        )} SET ${assignments} WHERE id = ${input.recordId} RETURNING id`
      )) as unknown as ReadonlyArray<{ readonly id: number }>
      return result.length > 0
    }),

  updateAll: (input) =>
    wrap(async () => {
      const assignments = sql.join(
        Object.entries(input.data).map(([key, value]) => sql`${sql.identifier(key)} = ${value}`),
        sql`, `
      )
      const result = (await db.execute(
        sql`UPDATE ${sql.identifier(input.table)} SET ${assignments} RETURNING id`
      )) as unknown as ReadonlyArray<{ readonly id: number }>
      return result.map((row) => row.id)
    }),

  delete: (input) =>
    wrap(async () => {
      const query =
        input.filter === undefined
          ? sql`DELETE FROM ${sql.identifier(input.table)} RETURNING id`
          : sql`DELETE FROM ${sql.identifier(input.table)}${whereClause(input.filter)} RETURNING id`
      const result = (await db.execute(query)) as unknown as ReadonlyArray<{
        readonly id: number
      }>
      return result.map((row) => row.id)
    }),

  runRawQuery: (input) =>
    wrap(
      async () =>
        (await db.execute(sql.raw(input.sql))) as unknown as ReadonlyArray<Record<string, unknown>>
    ),
})
