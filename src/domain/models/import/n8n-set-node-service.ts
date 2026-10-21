/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * An n8n Edit Fields (Set) node's parameters, normalised to the one shape the
 * registry reads (`flow-step-mappings.ts`): `fields`, a list of
 * `{ name, value }`, plus `dotNotation` and `includeOtherFields`.
 *
 * - Version 3.3 and later write `assignments.assignments[]` of
 *   `{ name, value, type }`; earlier versions write `values.string[]`,
 *   `values.number[]` and `values.boolean[]` of `{ name, value }`.
 * - A typed literal is written as that literal: a number, a boolean, and a
 *   list or an object n8n holds as JSON text. An expression (`={{ … }}`) is
 *   left for the tokenizer.
 * - "Include other input fields" is `includeOtherFields` from 3.3, `include`
 *   (default `all`) in 3.0 to 3.2, and the inverse of `keepOnlySet` before.
 * - A node in raw JSON mode names no field, so it is `undefined`.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'

type Json = Readonly<Record<string, unknown>>

/** The n8n Set node's type. */
export const N8N_SET_NODE = 'n8n-nodes-base.set'

/** A JSON text read as the list or object its type names, else `undefined`. */
const parsedJson = (text: string, type: 'array' | 'object'): unknown => {
  try {
    const parsed: unknown = JSON.parse(text)
    return (type === 'array' ? Array.isArray(parsed) : isRecord(parsed)) ? parsed : undefined
  } catch {
    return undefined
  }
}

/** A number written as text, or `undefined` when it is not one. */
const numberOf = (text: string): number | undefined => {
  const number = Number(text)
  return text.trim() !== '' && Number.isFinite(number) ? number : undefined
}

/** A boolean written as text, or `undefined` when it is not one. */
const booleanOf = (text: string): boolean | undefined =>
  text === 'true' ? true : text === 'false' ? false : undefined

/** A text as the literal its n8n type names, or `undefined` when it does not read as one. */
const literalOf = (text: string, type: unknown): unknown => {
  if (type === 'number') return numberOf(text)
  if (type === 'boolean') return booleanOf(text)
  return type === 'array' || type === 'object' ? parsedJson(text, type) : undefined
}

/** A value as the literal its n8n type names; an expression or an unreadable one as given. */
export const typedLiteral = (value: unknown, type: unknown): unknown =>
  typeof value !== 'string' || value.startsWith('=') ? value : (literalOf(value, type) ?? value)

const fieldOf = (item: unknown, type: unknown): readonly Json[] =>
  isRecord(item) && typeof item['name'] === 'string' && item['name'] !== ''
    ? [{ name: item['name'], value: typedLiteral(item['value'], item['type'] ?? type) }]
    : []

/** The `assignments` (3.3+) or the typed `values` groups (earlier), as `{ name, value }`. */
const fieldsOf = (parameters: Json): readonly Json[] => {
  const assignments = isRecord(parameters['assignments'])
    ? parameters['assignments']['assignments']
    : undefined
  if (Array.isArray(assignments)) return assignments.flatMap((item) => fieldOf(item, undefined))
  const values = isRecord(parameters['values']) ? parameters['values'] : {}
  return Object.entries(values).flatMap(([type, group]) =>
    Array.isArray(group) ? group.flatMap((item) => fieldOf(item, type)) : []
  )
}

/** Whether the node also hands on the other fields of its input, as its version spells it. */
const includesOtherFields = (parameters: Json, typeVersion: number): boolean => {
  if (typeVersion >= 3.3) return parameters['includeOtherFields'] === true
  if (typeVersion >= 3) return (parameters['include'] ?? 'all') !== 'none'
  return parameters['keepOnlySet'] !== true
}

/** A Set node's parameters as the registry reads them, or `undefined` when it names no field. */
export const n8nSetInputs = (node: {
  readonly typeVersion: number
  readonly parameters: Json
}): Json | undefined => {
  const { parameters, typeVersion } = node
  if (parameters['mode'] === 'raw') return undefined
  const fields = fieldsOf(parameters)
  if (fields.length === 0) return undefined
  const options = isRecord(parameters['options']) ? parameters['options'] : {}
  return {
    fields,
    dotNotation: options['dotNotation'] !== false,
    includeOtherFields: includesOtherFields(parameters, typeVersion),
  }
}
