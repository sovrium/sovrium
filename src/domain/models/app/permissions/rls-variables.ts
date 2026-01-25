/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * RLS (Row-Level Security) Variable Placeholders
 *
 * These variables are replaced at runtime with actual values from the
 * authentication context. Used in custom RLS conditions and record permissions.
 *
 * Variable substitution happens in the SQL generation layer, converting
 * placeholders like `{userId}` to actual PostgreSQL expressions like
 * `auth.user_id()`.
 */

/**
 * Available RLS Variables
 *
 * Use these constants when building RLS conditions to ensure consistency
 * across the codebase.
 */
export const RLS_VARIABLES = {
  /**
   * Current authenticated user's ID.
   *
   * @example Condition: `{userId} = created_by`
   * @sql_equivalent `auth.user_id()`
   */
  USER_ID: '{userId}',

  /**
   * Array of current user's roles.
   *
   * @example Condition: `'admin' = ANY({roles})`
   * @sql_equivalent `auth.user_roles()`
   */
  ROLES: '{roles}',
} as const

export type RlsVariable = (typeof RLS_VARIABLES)[keyof typeof RLS_VARIABLES]

/**
 * RLS Variable Documentation
 *
 * Detailed documentation for each variable, used for JSDoc generation
 * and developer reference.
 */
export const RLS_VARIABLE_DOCS = {
  userId: {
    placeholder: RLS_VARIABLES.USER_ID,
    description: "Current authenticated user's ID",
    sqlFunction: 'auth.user_id()',
    examples: ['{userId} = created_by', '{userId} = owner_id', '{userId} = assigned_to'],
  },
  roles: {
    placeholder: RLS_VARIABLES.ROLES,
    description: "Array of current user's roles",
    sqlFunction: 'auth.user_roles()',
    examples: ["'admin' = ANY({roles})", "'editor' = ANY({roles}) OR 'admin' = ANY({roles})"],
  },
} as const

/**
 * Build RLS Variables Documentation String
 *
 * Returns a formatted string documenting all available RLS variables.
 * Used in JSDoc comments to provide consistent documentation.
 *
 * @returns Formatted documentation string
 */
export function buildRlsVariablesDoc(): string {
  return Object.entries(RLS_VARIABLE_DOCS)
    .map(([_key, doc]) => `- \`${doc.placeholder}\`: ${doc.description}`)
    .join('\n')
}
