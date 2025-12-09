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
  'exp',
  'trunc',
  'log',
  'ln',
  'sign',
])

/**
 * Validate formula syntax to detect common syntax errors.
 * Checks for patterns that would cause SQL syntax errors.
 *
 * @param formula - The formula expression to validate
 * @returns Error message if invalid, undefined if valid
 */
const validateFormulaSyntax = (formula: string): string | undefined => {
  // Check for consecutive operators (e.g., "* *", "+ +", "- -")
  if (/[+\-*/%]\s*[+\-*/%]/.test(formula)) {
    return 'Invalid formula syntax: consecutive operators detected'
  }

  // Check for unmatched parentheses
  const openParens = (formula.match(/\(/g) || []).length
  const closeParens = (formula.match(/\)/g) || []).length
  if (openParens !== closeParens) {
    return 'Invalid formula syntax: unmatched parentheses'
  }

  // Check for empty parentheses
  if (/\(\s*\)/.test(formula)) {
    return 'Invalid formula syntax: empty parentheses'
  }

  return undefined
}

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
 * Default roles available in Sovrium.
 * These are the standard roles defined by the organization plugin.
 */
const DEFAULT_ROLES = new Set(['owner', 'admin', 'member', 'viewer'])

/**
 * Extract all role references from table permissions.
 * Checks table-level and field-level permissions for role references.
 *
 * @param permissions - Table permissions configuration
 * @returns Set of role names referenced in permissions
 */
const extractRoleReferences = (
  permissions: {
    readonly read?: { readonly type: string; readonly roles?: ReadonlyArray<string> }
    readonly create?: { readonly type: string; readonly roles?: ReadonlyArray<string> }
    readonly update?: { readonly type: string; readonly roles?: ReadonlyArray<string> }
    readonly delete?: { readonly type: string; readonly roles?: ReadonlyArray<string> }
    readonly fields?: ReadonlyArray<{
      readonly field: string
      readonly read?: { readonly type: string; readonly roles?: ReadonlyArray<string> }
      readonly write?: { readonly type: string; readonly roles?: ReadonlyArray<string> }
    }>
  }
): ReadonlySet<string> => {
  // Check table-level permissions
  // eslint-disable-next-line drizzle/enforce-delete-with-where
  const tableLevelPermissions = [permissions.read, permissions.create, permissions.update, permissions.delete]
  const tableLevelRoles = tableLevelPermissions.flatMap((permission) =>
    permission?.type === 'roles' && permission.roles ? permission.roles : []
  )

  // Check field-level permissions
  const fieldLevelRoles = (permissions.fields || []).flatMap((fieldPermission) => [
    ...(fieldPermission.read?.type === 'roles' && fieldPermission.read.roles
      ? fieldPermission.read.roles
      : []),
    ...(fieldPermission.write?.type === 'roles' && fieldPermission.write.roles
      ? fieldPermission.write.roles
      : []),
  ])

  return new Set([...tableLevelRoles, ...fieldLevelRoles])
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
  const dependencyGraph: ReadonlyMap<string, ReadonlyArray<string>> = new Map(
    fields
      .filter((field): field is typeof field & { formula: string } =>
        'formula' in field && typeof field.formula === 'string'
      )
      .map((field) => [field.name, extractFieldReferences(field.formula)] as const)
  )

  // Detect cycles using DFS with visited and recursion stack tracking
  type DFSState = {
    readonly visited: ReadonlySet<string>
    readonly recursionStack: ReadonlySet<string>
    readonly cycleNodes: ReadonlyArray<string>
  }

  const hasCycle = (node: string, state: DFSState): { readonly found: boolean; readonly state: DFSState } => {
    if (state.recursionStack.has(node)) {
      // Cycle detected - add to result
      return {
        found: true,
        state: {
          ...state,
          cycleNodes: [...state.cycleNodes, node],
        },
      }
    }

    if (state.visited.has(node)) {
      // Already processed this node
      return { found: false, state }
    }

    const newState: DFSState = {
      visited: new Set([...state.visited, node]),
      recursionStack: new Set([...state.recursionStack, node]),
      cycleNodes: state.cycleNodes,
    }

    const dependencies = dependencyGraph.get(node) || []
    const result = dependencies.reduce<{ readonly found: boolean; readonly state: DFSState }>(
      (acc, dep) => {
        if (acc.found || !dependencyGraph.has(dep)) {
          return acc
        }
        const depResult = hasCycle(dep, acc.state)
        if (depResult.found) {
          // Propagate cycle detection
          const cycleNodes = depResult.state.cycleNodes.includes(node)
            ? depResult.state.cycleNodes
            : [...depResult.state.cycleNodes, node]
          return {
            found: true,
            state: {
              ...depResult.state,
              cycleNodes,
            },
          }
        }
        return depResult
      },
      { found: false, state: newState }
    )

    // Remove from recursion stack after processing (immutable way)
    const finalState: DFSState = {
      ...result.state,
      recursionStack: new Set(
        [...result.state.recursionStack].filter((n) => n !== node)
      ),
    }

    return { found: result.found, state: finalState }
  }

  // Check all formula fields for cycles
  const initialState: DFSState = {
    visited: new Set(),
    recursionStack: new Set(),
    cycleNodes: [],
  }

  const result = [...dependencyGraph.keys()].reduce<{ readonly found: boolean; readonly state: DFSState }>(
    (acc, fieldName) => {
      if (acc.found || acc.state.visited.has(fieldName)) {
        return acc
      }
      return hasCycle(fieldName, acc.state)
    },
    { found: false, state: initialState }
  )

  return result.state.cycleNodes
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

    // Validate formula syntax first (before checking field references)
    const syntaxError = formulaFields
      .map((formulaField) => ({
        field: formulaField,
        error: validateFormulaSyntax(formulaField.formula),
      }))
      .find((result) => result.error !== undefined)

    if (syntaxError?.error) {
      return {
        message: syntaxError.error,
        path: ['fields'],
      }
    }

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

    // Validate organizationScoped requires organization_id field
    if (table.permissions?.organizationScoped === true) {
      const organizationIdField = table.fields.find((field) => field.name === 'organization_id')
      if (!organizationIdField) {
        return {
          message: 'organizationScoped requires organization_id field',
          path: ['permissions', 'organizationScoped'],
        }
      }
      // Validate organization_id field type (must be text-based for Better Auth compatibility)
      const validTypes = ['single-line-text', 'long-text', 'email', 'url', 'phone-number']
      if (!validTypes.includes(organizationIdField.type)) {
        return {
          message: `organization_id field must be a text type (single-line-text, long-text, email, url, or phone-number), got: ${organizationIdField.type}`,
          path: ['fields'],
        }
      }
    }

    // Validate that all roles referenced in permissions exist
    if (table.permissions) {
      const referencedRoles = extractRoleReferences(table.permissions)
      const invalidRoles = [...referencedRoles].filter((role) => !DEFAULT_ROLES.has(role))

      if (invalidRoles.length > 0) {
        const roleList = invalidRoles.map((r) => `'${r}'`).join(', ')
        return {
          message: `Invalid role ${roleList} not found. Available roles: ${[...DEFAULT_ROLES].map((r) => `'${r}'`).join(', ')}`,
          path: ['permissions'],
        }
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
