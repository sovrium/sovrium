/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


const NUMERIC_TYPES: ReadonlySet<string> = new Set([
  'number',
  'integer',
  'decimal',
  'currency',
  'percent',
  'rating',
  'duration',
])

export function isNumericFieldType(type: string): boolean {
  return NUMERIC_TYPES.has(type)
}

export function coerceFieldValues(
  values: Record<string, string>,
  fieldTypes: ReadonlyMap<string, string>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(values).map(([name, value]) => {
      const type = fieldTypes.get(name)
      if (type && isNumericFieldType(type)) {
        const num = Number(value)
        return [name, Number.isFinite(num) ? num : value]
      }
      if (type === 'checkbox' || type === 'boolean') return [name, value === 'true']
      return [name, value]
    })
  )
}

export async function createRecord(
  table: string,
  fields: Record<string, unknown>
): Promise<boolean> {
  const res = await fetch(`/api/tables/${table}/records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  return res.ok
}
