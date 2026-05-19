/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { JSONSchema } from 'effect'
import { AppSchema } from '@/domain/models/app'

const CONSTRAINT_TITLE_PATTERN =
  /^(maxLength|minLength|minItems|maxItems|nonEmptyString|nonEmpty|int|positive|negative|nonNegative|nonPositive|finite|between|greaterThan|greaterThanOrEqualTo|lessThan|lessThanOrEqualTo|pattern|unknown)\b/

export const fixEmptyPatternProperties = (node: unknown): unknown => {
  if (node === null || typeof node !== 'object') return node

  if (Array.isArray(node)) return node.map(fixEmptyPatternProperties)

  const obj = node as Record<string, unknown>
  const processed = Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [key, fixEmptyPatternProperties(value)])
  )

  const patternProps = processed['patternProperties'] as Record<string, unknown> | undefined
  const propertyNames = processed['propertyNames'] as Record<string, unknown> | undefined

  if (
    patternProps &&
    typeof patternProps === 'object' &&
    '' in patternProps &&
    propertyNames &&
    typeof propertyNames === 'object' &&
    typeof propertyNames['pattern'] === 'string'
  ) {
    const { pattern } = propertyNames
    const valueSchema = patternProps['']
    const { '': _, ...rest } = patternProps
    return {
      ...Object.fromEntries(
        Object.entries(processed).filter(
          ([k]) => k !== 'patternProperties' && k !== 'propertyNames'
        )
      ),
      patternProperties: { ...rest, [pattern]: valueSchema },
    }
  }

  return processed
}

export const stripConstraintTitles = (node: unknown): unknown => {
  if (node === null || typeof node !== 'object') return node

  if (Array.isArray(node)) return node.map(stripConstraintTitles)

  const obj = node as Record<string, unknown>
  return Object.fromEntries(
    Object.entries(obj)
      .filter(
        ([key, value]) =>
          !(key === 'title' && typeof value === 'string' && CONSTRAINT_TITLE_PATTERN.test(value))
      )
      .map(([key, value]) => [key, stripConstraintTitles(value)])
  )
}

export const generateAppJsonSchema = (): Record<string, unknown> => {
  const rawSchema = JSONSchema.make(AppSchema)

  return {
    $id: 'https://sovrium.com/schema/app.json',
    $schema: 'http://json-schema.org/draft-07/schema#',
    ...(stripConstraintTitles(fixEmptyPatternProperties(rawSchema)) as Record<string, unknown>),
  }
}
