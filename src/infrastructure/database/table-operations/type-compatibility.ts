/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

export const normalizeType = (type: string): string =>
  type
    .replace(/\(\d+\)/, '')
    .replace(/\(\d+,\s*\d+\)/, '')
    .trim()

const TYPE_COMPATIBILITY_GROUPS: readonly (readonly string[])[] = [
  ['smallint', 'integer', 'bigint', 'int2', 'int4', 'int8'],
  ['text', 'varchar', 'character varying', 'char', 'character', 'bpchar'],
  ['boolean', 'bool'],
  ['real', 'double precision', 'float4', 'float8'],
  ['numeric', 'decimal'],
  ['timestamp', 'timestamp without time zone', 'timestamp with time zone', 'timestamptz'],
  ['date'],
  ['time', 'time without time zone', 'time with time zone', 'timetz'],
  ['uuid'],
  ['json', 'jsonb'],
]

export const areTypesCompatible = (oldType: string, newType: string): boolean => {
  if (oldType === newType) return true

  const normalizedOld = normalizeType(oldType)
  const normalizedNew = normalizeType(newType)

  if (normalizedOld === normalizedNew) return true

  return TYPE_COMPATIBILITY_GROUPS.some(
    (group) => group.includes(normalizedOld) && group.includes(normalizedNew)
  )
}
