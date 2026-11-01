/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Which parts of an app need the account directory (`GET /api/users/directory`).
 *
 * The directory lists other accounts by name. It exists so a person can be
 * picked — in a person field, in the presence list, or on a page that lists
 * people — and it answers only where the app has such a need.
 */

/** The field types whose value is an account: a picked person or a stamp. */
export const USER_REFERENCE_FIELD_TYPES: ReadonlySet<string> = new Set([
  'user',
  'created-by',
  'updated-by',
])

/** The path of the account directory. */
export const USER_DIRECTORY_ENDPOINT = '/api/users/directory'

interface TableLike {
  readonly name: string
  readonly fields: ReadonlyArray<{ readonly type: string }>
}

/** Whether a table holds a field whose value is an account. */
export const holdsPersonField = (table: TableLike): boolean =>
  table.fields.some((field) => USER_REFERENCE_FIELD_TYPES.has(field.type))

/** The tables of an app that hold a field whose value is an account. */
export const tablesHoldingPersonField = <T extends TableLike>(app: {
  readonly tables?: ReadonlyArray<T>
}): ReadonlyArray<T> => (app.tables ?? []).filter(holdsPersonField)

const namesDirectory = (endpoint: unknown): boolean =>
  typeof endpoint === 'string' &&
  (endpoint === USER_DIRECTORY_ENDPOINT || endpoint.startsWith(`${USER_DIRECTORY_ENDPOINT}?`))

const listsDirectory = (node: unknown): boolean => {
  if (Array.isArray(node)) return node.some(listsDirectory)
  if (typeof node !== 'object' || node === null) return false
  const record = node as Readonly<Record<string, unknown>>
  const { system } = record
  if (
    typeof system === 'object' &&
    system !== null &&
    namesDirectory((system as Record<string, unknown>)['endpoint'])
  ) {
    return true
  }
  return Object.values(record).some(listsDirectory)
}

/**
 * Whether a page, or a component template a page may use, reads the account
 * directory through a data source's `system.endpoint` — an app-level need,
 * shared by every signed-in caller.
 */
export const appListsUserDirectory = (app: {
  readonly pages?: unknown
  readonly components?: unknown
}): boolean => listsDirectory(app.pages) || listsDirectory(app.components)
