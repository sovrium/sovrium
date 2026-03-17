/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Normalize PostgreSQL type names by removing size specifications
 */
export const normalizeType = (type: string): string =>
  type
    .replace(/\(\d+\)/, '') // Remove (N) like varchar(255) -> varchar
    .replace(/\(\d+,\s*\d+\)/, '') // Remove (N,M) like numeric(10,2) -> numeric
    .trim()

/**
 * Type compatibility groups - types within a group can be safely copied between each other
 */
const TYPE_COMPATIBILITY_GROUPS: readonly (readonly string[])[] = [
  // Integer types (can be widened but not narrowed, but for recreation we allow same family)
  ['smallint', 'integer', 'bigint', 'int2', 'int4', 'int8'],
  // Text types
  ['text', 'varchar', 'character varying', 'char', 'character', 'bpchar'],
  // Boolean
  ['boolean', 'bool'],
  // Floating point
  ['real', 'double precision', 'float4', 'float8'],
  // Numeric/Decimal
  ['numeric', 'decimal'],
  // Date/Time
  ['timestamp', 'timestamp without time zone', 'timestamp with time zone', 'timestamptz'],
  ['date'],
  ['time', 'time without time zone', 'time with time zone', 'timetz'],
  // UUID
  ['uuid'],
  // JSON
  ['json', 'jsonb'],
]

/**
 * Check if two PostgreSQL data types are compatible for data copying
 * Returns true if data can be safely copied from oldType to newType
 */
export const areTypesCompatible = (oldType: string, newType: string): boolean => {
  // Exact match is always compatible
  if (oldType === newType) return true

  const normalizedOld = normalizeType(oldType)
  const normalizedNew = normalizeType(newType)

  if (normalizedOld === normalizedNew) return true

  // Check if both types are in the same compatibility group
  return TYPE_COMPATIBILITY_GROUPS.some(
    (group) => group.includes(normalizedOld) && group.includes(normalizedNew)
  )
}
