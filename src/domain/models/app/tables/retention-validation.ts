/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The table rules a `retention` window must satisfy, judged with the table's
 * fields because the answer depends on them: `days` is judged by the schema
 * itself, `field` here.
 */

/** The field kinds a row's age may be read from. */
export const RETENTION_FIELD_TYPES: ReadonlySet<string> = new Set([
  'date',
  'datetime',
  'created-at',
  'updated-at',
])

/** The intrinsic timestamp columns every table carries. */
const INTRINSIC_RETENTION_COLUMNS: ReadonlySet<string> = new Set(['created_at', 'updated_at'])

/** The column a window counts from when it names none. */
export const DEFAULT_RETENTION_FIELD = 'created_at'

/** Shape of a table relevant to its retention rule. */
interface TableForRetention {
  readonly fields: ReadonlyArray<{ readonly name: string; readonly type: string }>
  readonly retention?: { readonly field?: string }
}

type ValidationError = { readonly message: string; readonly path: ReadonlyArray<string> }

/**
 * `retention.field` must name a field of the table whose kind is a date, a
 * datetime or a creation or update time — or the table's own `created_at` /
 * `updated_at`. A declared field of that name wins over the intrinsic column,
 * since it is the column the sweep would read.
 *
 * @returns the problem, or `undefined` when the table declares no retention or
 *   its field is acceptable.
 */
export const validateRetention = (table: TableForRetention): ValidationError | undefined => {
  const name = table.retention?.field
  if (name === undefined) return undefined
  const declared = table.fields.find((field) => field.name === name)
  if (declared === undefined) {
    return INTRINSIC_RETENTION_COLUMNS.has(name)
      ? undefined
      : {
          message: `retention.field '${name}' names no field of the table`,
          path: ['retention', 'field'],
        }
  }
  return RETENTION_FIELD_TYPES.has(declared.type)
    ? undefined
    : {
        message: `retention.field '${name}' is a ${declared.type} field; a retention window counts from a date, datetime, created-at or updated-at field`,
        path: ['retention', 'field'],
      }
}
