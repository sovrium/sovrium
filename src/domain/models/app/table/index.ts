/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TableIdSchema } from '@/domain/models/app/common/branded-ids'
import { FieldsSchema } from './fields'
import { IndexesSchema } from './indexes'
import { NameSchema } from './name'
import { TablePermissionsSchema } from './permissions'
import { PrimaryKeySchema } from './primary-key'
import { UniqueConstraintsSchema } from './unique-constraints'
import { ViewSchema } from './views'

/**
 * Table Schema
 *
 * Defines a single database table entity with its structure, fields, and constraints.
 * Each table represents a distinct entity (e.g., users, products, orders) with fields
 * that define the data schema. Tables support primary keys, unique constraints, and
 * indexes for efficient data access and integrity.
 *
 * @example
 * ```typescript
 * const userTable = {
 *   id: 1,
 *   name: 'users',
 *   fields: [
 *     { id: 1, name: 'email', type: 'email', required: true },
 *     { id: 2, name: 'name', type: 'single-line-text', required: true }
 *   ],
 *   primaryKey: { fields: ['id'] },
 *   uniqueConstraints: [{ fields: ['email'] }]
 * }
 * ```
 *
 * @see docs/specifications/roadmap/tables.md for full specification
 */

/**
 * Common SQL/formula keywords and functions that should be excluded from field references.
 * Defined as a constant to avoid recreating the Set on every function call.
 */
const FORMULA_KEYWORDS = new Set([
  'if',
  'then',
  'else',
  'and',
  'or',
  'not',
  'concat',
  'round',
  'sum',
  'avg',
  'max',
  'min',
  'count',
  'true',
  'false',
  'null',
  'case',
  'when',
  'end',
  'ceil',
  'floor',
  'abs',
  'current_date',
  'current_time',
  'current_timestamp',
  'now',
  'upper',
  'lower',
  'trim',
  'length',
  'substr',
  'substring',
  'replace',
  'coalesce',
  'nullif',
  'cast',
  'extract',
  'date_add',
  'date_sub',
  'date_diff',
  'year',
  'month',
  'day',
  'hour',
  'minute',
  'second',
  'power',
  'sqrt',
  'mod',
  'greatest',
  'least',
])

/**
 * Extract potential field references from a formula expression.
 * This is a simplified parser that extracts identifiers (words) from the formula.
 * It doesn't handle complex syntax but catches common field reference patterns.
 *
 * @param formula - The formula expression to parse
 * @returns Array of field names referenced in the formula
 */
const extractFieldReferences = (formula: string): ReadonlyArray<string> => {
  // Match word characters (field names) - exclude function names and operators
  // This regex matches identifiers that could be field names
  const identifierPattern = /\b([a-z_][a-z0-9_]*)\b/gi
  const matches = formula.match(identifierPattern) || []

  return matches
    .map((match) => match.toLowerCase())
    .filter((identifier) => !FORMULA_KEYWORDS.has(identifier))
}

/**
 * Detect circular dependencies in formula fields using depth-first search.
 * A circular dependency exists when a formula field references itself directly or indirectly
 * through a chain of other formula fields.
 *
 * @param fields - Array of fields to validate
 * @returns Array of field names involved in circular dependencies, or empty array if none found
 */
const detectCircularDependencies = (
  fields: ReadonlyArray<{ readonly name: string; readonly type: string; readonly formula?: string }>
): ReadonlyArray<string> => {
  // Build dependency graph: field name -> fields it references
  const dependencyGraph = new Map<string, ReadonlyArray<string>>()

  for (const field of fields) {
    if ('formula' in field && typeof field.formula === 'string') {
      const references = extractFieldReferences(field.formula)
      dependencyGraph.set(field.name, references)
    }
  }

  // Detect cycles using DFS with visited and recursion stack tracking
  const visited = new Set<string>()
  const recursionStack = new Set<string>()
  const cycleNodes: string[] = []

  const hasCycle = (node: string): boolean => {
    if (recursionStack.has(node)) {
      // Cycle detected - add to result
      cycleNodes.push(node)
      return true
    }

    if (visited.has(node)) {
      // Already processed this node
      return false
    }

    visited.add(node)
    recursionStack.add(node)

    const dependencies = dependencyGraph.get(node) || []
    for (const dep of dependencies) {
      if (dependencyGraph.has(dep) && hasCycle(dep)) {
        // Propagate cycle detection
        if (!cycleNodes.includes(node)) {
          cycleNodes.push(node)
        }
        return true
      }
    }

    recursionStack.delete(node)
    return false
  }

  // Check all formula fields for cycles
  for (const fieldName of dependencyGraph.keys()) {
    if (!visited.has(fieldName)) {
      if (hasCycle(fieldName)) {
        break // Stop after finding first cycle
      }
    }
  }

  return cycleNodes
}

export const TableSchema = Schema.Struct({
  id: Schema.optional(TableIdSchema),
  name: NameSchema,
  fields: FieldsSchema,
  primaryKey: Schema.optional(PrimaryKeySchema),
  uniqueConstraints: Schema.optional(UniqueConstraintsSchema),
  indexes: Schema.optional(IndexesSchema),
  views: Schema.optional(Schema.Array(ViewSchema)),

  /**
   * Table-level permissions (high-level RBAC abstraction).
   *
   * Automatically generates RLS policies based on permission configuration.
   * Supports public, authenticated, role-based, and owner-based access control.
   *
   * @example Role-based permissions
   * ```typescript
   * permissions: {
   *   read: { type: 'roles', roles: ['member'] },
   *   create: { type: 'roles', roles: ['admin'] },
   *   update: { type: 'authenticated' },
   *   delete: { type: 'roles', roles: ['admin'] },
   * }
   * ```
   *
   * @example Owner-based access
   * ```typescript
   * permissions: {
   *   read: { type: 'owner', field: 'user_id' },
   *   update: { type: 'owner', field: 'user_id' },
   *   delete: { type: 'owner', field: 'user_id' },
   * }
   * ```
   *
   * @see TablePermissionsSchema for full configuration options
   */
  permissions: Schema.optional(TablePermissionsSchema),
}).pipe(
  Schema.filter((table) => {
    // Validate that formula fields only reference existing fields
    const fieldNames = new Set(table.fields.map((field) => field.name))
    const formulaFields = table.fields.filter(
      (field): field is Extract<typeof field, { type: 'formula' }> => field.type === 'formula'
    )

    // Find the first invalid field reference across all formula fields
    const invalidReference = formulaFields
      .flatMap((formulaField) => {
        const referencedFields = extractFieldReferences(formulaField.formula)
        const invalidField = referencedFields.find((refField) => !fieldNames.has(refField))
        return invalidField ? [{ formulaField, invalidField }] : []
      })
      .at(0)

    if (invalidReference) {
      return {
        message: `Invalid field reference: field '${invalidReference.invalidField}' not found in formula '${invalidReference.formulaField.formula}'`,
        path: ['fields'],
      }
    }

    // Detect circular dependencies in formula fields
    const circularFields = detectCircularDependencies(table.fields)
    if (circularFields.length > 0) {
      return {
        message: `Circular dependency detected in formula fields: ${circularFields.join(' -> ')}`,
        path: ['fields'],
      }
    }

    return true
  }),
  Schema.annotations({
    title: 'Table',
    description:
      'A database table that defines the structure of an entity in your application. Contains fields, constraints, and indexes to organize and validate data.',
    examples: [
      {
        id: 1,
        name: 'users',
        fields: [
          { id: 1, name: 'email', type: 'email' as const, required: true },
          { id: 2, name: 'name', type: 'single-line-text' as const, required: true },
        ],
      },
      {
        id: 2,
        name: 'products',
        fields: [
          { id: 1, name: 'title', type: 'single-line-text' as const, required: true },
          {
            id: 2,
            name: 'price',
            type: 'currency' as const,
            required: true,
            currency: 'USD',
          },
          { id: 3, name: 'description', type: 'long-text' as const, required: false },
        ],
        primaryKey: { type: 'composite', fields: ['id'] },
      },
    ],
  })
)

export type Table = Schema.Schema.Type<typeof TableSchema>

// Re-export all table model schemas and types for convenient imports
export * from './id'
export * from './field-name'
export * from './name'
export * from './fields'
export * from './primary-key'
export * from './unique-constraints'
export * from './indexes'
export * from './field-types'
export * from './views'
export * from './permissions'
