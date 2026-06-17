/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


interface AuthorshipFieldShape {
  readonly name: string
  readonly type: string
}

interface AuthorshipTableShape {
  readonly name: string
  readonly fields: ReadonlyArray<AuthorshipFieldShape>
}

const findTable = (
  tables: ReadonlyArray<AuthorshipTableShape> | undefined,
  tableName: string
): AuthorshipTableShape | undefined => tables?.find((table) => table.name === tableName)

export const createdByFieldNames = (
  tables: ReadonlyArray<AuthorshipTableShape> | undefined,
  tableName: string
): readonly string[] =>
  (findTable(tables, tableName)?.fields ?? [])
    .filter((field) => field.type === 'created-by')
    .map((field) => field.name)

export const updatedByFieldNames = (
  tables: ReadonlyArray<AuthorshipTableShape> | undefined,
  tableName: string
): readonly string[] =>
  (findTable(tables, tableName)?.fields ?? [])
    .filter((field) => field.type === 'updated-by')
    .map((field) => field.name)

export const buildCreateAuthorshipOverrides = (
  tables: ReadonlyArray<AuthorshipTableShape> | undefined,
  tableName: string,
  actorId: string
): Record<string, string> => {
  const names = [
    ...createdByFieldNames(tables, tableName),
    ...updatedByFieldNames(tables, tableName),
  ]
  return Object.fromEntries(names.map((name) => [name, actorId]))
}

export const buildUpdateAuthorshipOverrides = (
  tables: ReadonlyArray<AuthorshipTableShape> | undefined,
  tableName: string,
  actorId: string
): Record<string, string> => {
  const names = updatedByFieldNames(tables, tableName)
  return Object.fromEntries(names.map((name) => [name, actorId]))
}
