/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


interface JsonSchemaLike {
  readonly type?: string
  readonly properties?: Readonly<Record<string, JsonSchemaLike>>
  readonly required?: ReadonlyArray<string>
  readonly minLength?: number
  readonly minimum?: number
  readonly maximum?: number
  readonly format?: string
}

const isObject = (v: unknown): v is Readonly<Record<string, unknown>> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const validateString = (value: unknown, schema: JsonSchemaLike): string | undefined => {
  if (typeof value !== 'string') return 'must be a string'
  if (schema.minLength !== undefined && value.length < schema.minLength) {
    return `must be at least ${String(schema.minLength)} characters`
  }
  if (schema.format === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return 'must be a valid email'
  }
  return undefined
}

const validateInteger = (value: unknown, schema: JsonSchemaLike): string | undefined => {
  const n = Number(value)
  if (!Number.isInteger(n)) return 'must be an integer'
  if (schema.minimum !== undefined && n < schema.minimum) return 'too small'
  if (schema.maximum !== undefined && n > schema.maximum) return 'too large'
  return undefined
}

const validateField = (value: unknown, schema: JsonSchemaLike): string | undefined => {
  if (schema.type === 'string') return validateString(value, schema)
  if (schema.type === 'integer') return validateInteger(value, schema)
  if (schema.type === 'number') return Number.isNaN(Number(value)) ? 'must be a number' : undefined
  if (schema.type === 'boolean') return typeof value !== 'boolean' ? 'must be a boolean' : undefined
  return undefined
}

export const validateAgainstSchema = (
  value: unknown,
  schema: Readonly<Record<string, unknown>>
): ReadonlyArray<string> => {
  const s = schema as JsonSchemaLike
  if (s.type !== 'object' || s.properties === undefined) return []
  const obj = isObject(value) ? value : {}
  const required = s.required ?? []
  const missing = required
    .filter((key) => obj[key] === undefined || obj[key] === null || obj[key] === '')
    .map((key) => `${key}: required`)
  const fieldErrors = Object.entries(s.properties).flatMap(([key, fieldSchema]) => {
    if (obj[key] === undefined) return []
    const err = validateField(obj[key], fieldSchema)
    return err === undefined ? [] : [`${key}: ${err}`]
  })
  return [...missing, ...fieldErrors]
}

export const coerceQueryForSchema = (
  query: Readonly<Record<string, string>>,
  schema: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> => {
  const props = (schema as JsonSchemaLike).properties
  if (props === undefined) return query
  return Object.fromEntries(
    Object.entries(query).map(([k, v]) => {
      const fieldSchema = props[k]
      if (fieldSchema === undefined) return [k, v]
      if (fieldSchema.type === 'integer' || fieldSchema.type === 'number') {
        const n = Number(v)
        return [k, Number.isNaN(n) ? v : n]
      }
      return [k, v]
    })
  )
}
