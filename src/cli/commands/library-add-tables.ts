/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { basename } from 'node:path'

/** A table an entry reads: the `--set` param naming it, and the fields it expects. */
interface ExpectedTable {
  readonly table: string
  readonly param: string
  readonly fields: ReadonlyArray<{ readonly name: string; readonly type: string }>
}

/** The tables the config defines, each with the names of its fields. */
const definedTables = (parsed: unknown): ReadonlyMap<string, ReadonlySet<string>> => {
  const tables = (parsed as Readonly<Record<string, unknown>> | undefined)?.['tables']
  return new Map(
    Array.isArray(tables)
      ? tables.flatMap((table: unknown) => {
          const { name, fields } = (table ?? {}) as {
            readonly name?: unknown
            readonly fields?: unknown
          }
          if (typeof name !== 'string') return []
          const fieldNames = Array.isArray(fields)
            ? fields.flatMap((field: unknown) => {
                const fieldName = (field as { readonly name?: unknown } | null)?.name
                return typeof fieldName === 'string' ? [fieldName] : []
              })
            : []
          return [[name, new Set(fieldNames)] as const]
        })
      : []
  )
}

/**
 * Why the entry cannot install — a table, or a field of one, that the config
 * does not define — or `undefined`. Checked before anything is written. An
 * entry binds to the operator's OWN table and never creates one, so
 * the refusal names the table, every field it reads with its type, and the
 * `--set` that points the entry at a table the operator already has.
 */
export const missingTablesMessage = (input: {
  readonly parsed: unknown
  readonly configPath: string
  readonly entryId: string
  readonly expected: readonly ExpectedTable[]
}): string | undefined => {
  const defined = definedTables(input.parsed)
  const problems = input.expected.flatMap((table) => {
    const fields = defined.get(table.table)
    const missing =
      fields === undefined ? table.fields : table.fields.filter((field) => !fields.has(field.name))
    return missing.length === 0 ? [] : [{ table, fields, missing }]
  })
  const [first] = problems
  if (first === undefined) return undefined
  const { entryId } = input
  const configName = basename(input.configPath)
  const fieldList = first.missing.map((field) => `${field.name} (${field.type})`).join(', ')
  return (
    (first.fields === undefined
      ? `Error: ${entryId} reads the table "${first.table.table}", which ${configName} does not define.\n\n` +
        `  It expects these fields: ${fieldList}.\n` +
        `  Point it at one of your tables with --set ${first.table.param}=<table>, or add the table first.`
      : `Error: ${entryId} reads ${fieldList} from the table "${first.table.table}", which ${configName} defines without ${first.missing.length === 1 ? 'that field' : 'those fields'}.\n\n` +
        `  Add the missing field${first.missing.length === 1 ? '' : 's'} to "${first.table.table}", or point the entry at other fields with --set.`) +
    '\n  Nothing was written.'
  )
}
