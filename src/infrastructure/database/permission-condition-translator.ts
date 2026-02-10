/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Translate permission condition variables to PostgreSQL current_setting() calls
 *
 * Variable substitution:
 * - {userId} → current_setting('app.user_id', true)::TEXT
 * - {user.property} → current_setting('app.user_property', true)::TEXT
 *
 * The second parameter (true) makes current_setting return NULL if setting doesn't exist,
 * instead of raising an error.
 *
 * Note: User IDs are TEXT in Better Auth, not INTEGER
 *
 * @param condition - Permission condition with variable placeholders
 * @returns PostgreSQL expression with current_setting() calls
 *
 * @example
 * translatePermissionCondition('{userId} = author_id')
 * // Returns: "current_setting('app.user_id', true)::TEXT = author_id"
 *
 * @example
 * translatePermissionCondition('draft = false OR {userId} = author_id')
 * // Returns: "draft = false OR current_setting('app.user_id', true)::TEXT = author_id"
 */
export const translatePermissionCondition = (condition: string): string =>
  condition
    .replace(/\{userId\}/g, "current_setting('app.user_id', true)::TEXT")
    .replace(/\{user\.(\w+)\}/g, (_, prop) => `current_setting('app.user_${prop}', true)::TEXT`)
