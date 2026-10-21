/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The columns a merge writes when it creates a row and never when it updates
 * one: when the row was created, and the number it was given.
 *
 * A row matched by an upsert keeps its creation instant and its autonumber.
 * Rewriting a creation date would rewrite the row's history; rewriting an
 * autonumber could swap two rows' numbers under the field's unique index. A
 * replay that compares a row with what it would write skips the same columns,
 * since the write would leave them as they are.
 */

interface FieldShape {
  readonly name: string
  readonly type?: string | undefined
}

interface TableShape {
  readonly name: string
  readonly fields: readonly FieldShape[]
}

/** The field types written on insert only. */
const INSERT_ONLY_TYPES: ReadonlySet<string> = new Set(['created-at', 'autonumber'])

/** The intrinsic creation column every table carries. */
const CREATED_AT_COLUMN = 'created_at'

/**
 * The columns of `tableName` written on insert only: the intrinsic
 * `created_at`, then every `created-at` and `autonumber` field it declares.
 */
export const insertOnlyColumnsOf = (
  tables: readonly TableShape[] | undefined,
  tableName: string
): readonly string[] => {
  const fields = tables?.find((table) => table.name === tableName)?.fields ?? []
  const declared = fields
    .filter((field) => field.type !== undefined && INSERT_ONLY_TYPES.has(field.type))
    .map((field) => field.name)
  return [CREATED_AT_COLUMN, ...declared.filter((name) => name !== CREATED_AT_COLUMN)]
}
