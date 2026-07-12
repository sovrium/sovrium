/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql, type SQL } from 'drizzle-orm'
import { Effect } from 'effect'
import { db, type SessionContextError } from '@/infrastructure/database'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import {
  generateJunctionTableName,
  toSingular,
} from '@/infrastructure/database/sql/sql-junction-tables'
import { wrapDatabaseError } from '../shared/error-handling'
import { validateTableName } from '../shared/validation'


const coerceId = (value: string | number): string | number =>
  typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value

export interface ManyToManyLink {
  readonly relatedTable: string
  readonly relatedIds: readonly (string | number)[]
  readonly hasReciprocal: boolean
}

export interface LinkManyToManyInput {
  readonly sourceTable: string
  readonly sourceId: string | number
  readonly links: readonly ManyToManyLink[]
}

const junctionInsert = (
  aTable: string,
  bTable: string,
  aId: string | number,
  bId: string | number
): Readonly<SQL> => {
  validateTableName(aTable)
  validateTableName(bTable)
  const junction = generateJunctionTableName(aTable, bTable)
  const aCol = `${toSingular(aTable)}_id`
  const bCol = `${toSingular(bTable)}_id`
  return sql`INSERT INTO ${sql.identifier(junction)} (${sql.identifier(aCol)}, ${sql.identifier(bCol)}) VALUES (${coerceId(aId)}, ${coerceId(bId)}) ON CONFLICT DO NOTHING`
}

const buildLinkStatements = (input: LinkManyToManyInput): readonly Readonly<SQL>[] =>
  input.links.flatMap((link) =>
    link.relatedIds.flatMap((relatedId) => {
      const own = junctionInsert(input.sourceTable, link.relatedTable, input.sourceId, relatedId)
      return link.hasReciprocal
        ? [own, junctionInsert(link.relatedTable, input.sourceTable, relatedId, input.sourceId)]
        : [own]
    })
  )

export const linkManyToMany = (
  input: LinkManyToManyInput
): Effect.Effect<void, SessionContextError> => {
  const statements = buildLinkStatements(input)
  if (statements.length === 0) return Effect.void
  return Effect.tryPromise({
    try: () =>
      db.transaction((tx) =>
        statements.reduce<Promise<unknown>>(
          (prev, statement) => prev.then(() => executeRaw(tx, statement)),
          Promise.resolve(undefined)
        )
      ),
    catch: wrapDatabaseError(`Failed to link many-to-many records for ${input.sourceTable}`),
  })
}

export interface ManyToManyReadField {
  readonly fieldName: string
  readonly relatedTable: string
}

export interface ReadManyToManyInput {
  readonly sourceTable: string
  readonly sourceIds: readonly (string | number)[]
  readonly fields: readonly ManyToManyReadField[]
}

export type ManyToManyResult = Record<string, Record<string, readonly (string | number)[]>>

const readFieldRows = (
  sourceTable: string,
  sourceIds: readonly (string | number)[],
  field: ManyToManyReadField
): Promise<ReadonlyArray<Record<string, unknown>>> => {
  validateTableName(sourceTable)
  validateTableName(field.relatedTable)
  const junction = generateJunctionTableName(sourceTable, field.relatedTable)
  const srcCol = `${toSingular(sourceTable)}_id`
  const relCol = `${toSingular(field.relatedTable)}_id`
  const idList = sql.join(
    sourceIds.map((id) => sql`${coerceId(id)}`),
    sql.raw(', ')
  )
  return executeRaw(
    db,
    sql`SELECT ${sql.identifier(srcCol)} AS src, ${sql.identifier(relCol)} AS rel FROM ${sql.identifier(junction)} WHERE ${sql.identifier(srcCol)} IN (${idList})`
  )
}

const foldFieldRows = (
  rows: ReadonlyArray<Record<string, unknown>>
): Record<string, readonly (string | number)[]> =>
  rows.reduce<Record<string, (string | number)[]>>((acc, row) => {
    const src = String(row.src)
    const rel = row.rel as string | number
    return { ...acc, [src]: [...(acc[src] ?? []), rel] }
  }, {})

export const readManyToMany = (
  input: ReadManyToManyInput
): Effect.Effect<ManyToManyResult, SessionContextError> => {
  if (input.fields.length === 0 || input.sourceIds.length === 0) return Effect.succeed({})
  return Effect.tryPromise({
    try: async () => {
      const perField = await Promise.all(
        input.fields.map(async (field) => {
          const rows = await readFieldRows(input.sourceTable, input.sourceIds, field)
          return { field, byRecord: foldFieldRows(rows) }
        })
      )
      return perField.reduce<ManyToManyResult>((acc, { field, byRecord }) => {
        const merged = Object.entries(byRecord).reduce<ManyToManyResult>(
          (inner, [recordId, ids]) => {
            const existing = inner[recordId] ?? {}
            return { ...inner, [recordId]: { ...existing, [field.fieldName]: ids } }
          },
          acc
        )
        return merged
      }, {})
    },
    catch: wrapDatabaseError(`Failed to read many-to-many records for ${input.sourceTable}`),
  })
}
