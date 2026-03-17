/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Check Constraint Schema
 *
 * Defines a custom CHECK constraint that validates data at the database level.
 * CHECK constraints allow you to enforce complex business rules beyond basic
 * field-level validation.
 *
 * @example
 * ```typescript
 * const constraint = {
 *   name: 'chk_active_members_have_email',
 *   check: '(is_active = false) OR (email IS NOT NULL)'
 * }
 * ```
 */
export const CheckConstraintSchema = Schema.Struct({
  /**
   * Constraint name (must be unique within the table)
   */
  name: Schema.String.pipe(
    Schema.minLength(1),
    Schema.pattern(/^[a-z][a-z0-9_]*$/),
    Schema.annotations({
      title: 'Constraint Name',
      description:
        'Unique name for the CHECK constraint (lowercase, alphanumeric with underscores)',
      examples: ['chk_active_members_have_email', 'chk_price_positive', 'chk_end_after_start'],
    })
  ),

  /**
   * SQL check expression
   */
  check: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({
      title: 'Check Expression',
      description: 'PostgreSQL boolean expression that must evaluate to TRUE for valid data',
      examples: [
        '(is_active = false) OR (email IS NOT NULL)',
        'price > 0',
        'end_date > start_date',
        "(status = 'completed') OR (completed_at IS NULL)",
      ],
    })
  ),
})

export type CheckConstraint = Schema.Schema.Type<typeof CheckConstraintSchema>

/**
 * Check Constraints Schema
 *
 * Array of CHECK constraints applied at the table level.
 *
 * @example
 * ```typescript
 * const constraints = [
 *   {
 *     name: 'chk_active_members_have_email',
 *     check: '(is_active = false) OR (email IS NOT NULL)'
 *   },
 *   {
 *     name: 'chk_price_positive',
 *     check: 'price > 0'
 *   }
 * ]
 * ```
 */
export const CheckConstraintsSchema = Schema.Array(CheckConstraintSchema).pipe(
  Schema.annotations({
    title: 'Check Constraints',
    description:
      'Table-level CHECK constraints for enforcing complex business rules beyond field-level validation',
    examples: [
      [
        {
          name: 'chk_active_members_have_email',
          check: '(is_active = false) OR (email IS NOT NULL)',
        },
      ],
      [
        {
          name: 'chk_price_positive',
          check: 'price > 0',
        },
        {
          name: 'chk_end_after_start',
          check: 'end_date > start_date',
        },
      ],
    ],
  })
)

export type CheckConstraints = Schema.Schema.Type<typeof CheckConstraintsSchema>
