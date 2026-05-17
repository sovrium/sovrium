/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Pure validation helpers for the multi-tenant `user_access` junction (Z-2).
 *
 * The schema-level `UserAccessRowSchema` (in `src/domain/models/app/tables/permissions.ts`)
 * defines the canonical "ideal-state" shape (UUID-typed `user_id` / `record_ids`).
 * The HTTP insert path however accepts the looser TEXT-based representation
 * already used by the database (DDL in `user-access-table.ts`) and by Z-1's
 * `fetchUserAssignments` query, so applications and tests can use arbitrary
 * string IDs ('c1', 'p1') alongside Better Auth nanoids and UUIDs.
 *
 * These helpers only enforce the cross-config rules:
 *
 * 1. `table_slug` must be listed in `auth.scopeTables` (case-sensitive, exact)
 * 2. `role` must be a name in `auth.roles[].name`
 *    (NOT including built-in roles 'admin'/'member'/'viewer' — the spec is
 *    explicit that user_access roles are independent of Better Auth roles)
 * 3. `record_ids` must be a non-empty array of non-empty strings
 *
 * Validation runs at insert time, not at schema-decode time, because the
 * schema does not have access to the active app config.
 */

export interface UserAccessInput {
  readonly user_id?: unknown
  readonly table_slug?: unknown
  readonly record_ids?: unknown
  readonly role?: unknown
}

export interface UserAccessValidationContext {
  readonly scopeTables: readonly string[]
  readonly roleNames: readonly string[]
}

export interface UserAccessValidationError {
  readonly code: 'VALIDATION_ERROR'
  readonly message: string
  readonly field: 'user_id' | 'table_slug' | 'record_ids' | 'role'
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0

const validateUserId = (input: UserAccessInput): UserAccessValidationError | undefined => {
  if (!isNonEmptyString(input.user_id)) {
    return {
      code: 'VALIDATION_ERROR',
      message: 'user_id is required and must be a non-empty string',
      field: 'user_id',
    }
  }
  return undefined
}

const validateTableSlug = (
  input: UserAccessInput,
  context: UserAccessValidationContext
): UserAccessValidationError | undefined => {
  if (!isNonEmptyString(input.table_slug)) {
    return {
      code: 'VALIDATION_ERROR',
      message: 'table_slug is required and must be a non-empty string',
      field: 'table_slug',
    }
  }
  if (!context.scopeTables.includes(input.table_slug)) {
    return {
      code: 'VALIDATION_ERROR',
      message: `table_slug '${input.table_slug}' is not declared in auth.scopeTables (allowed: ${context.scopeTables.join(', ')})`,
      field: 'table_slug',
    }
  }
  return undefined
}

const validateRecordIds = (input: UserAccessInput): UserAccessValidationError | undefined => {
  if (!Array.isArray(input.record_ids)) {
    return {
      code: 'VALIDATION_ERROR',
      message: 'record_ids must be an array of strings',
      field: 'record_ids',
    }
  }
  if (input.record_ids.length === 0) {
    return {
      code: 'VALIDATION_ERROR',
      message: 'record_ids must contain at least one record id',
      field: 'record_ids',
    }
  }
  const hasInvalid = input.record_ids.some((v) => !isNonEmptyString(v))
  if (hasInvalid) {
    return {
      code: 'VALIDATION_ERROR',
      message: 'record_ids must contain only non-empty strings',
      field: 'record_ids',
    }
  }
  return undefined
}

const validateRole = (
  input: UserAccessInput,
  context: UserAccessValidationContext
): UserAccessValidationError | undefined => {
  if (!isNonEmptyString(input.role)) {
    return {
      code: 'VALIDATION_ERROR',
      message: 'role is required and must be a non-empty string',
      field: 'role',
    }
  }
  if (!context.roleNames.includes(input.role)) {
    return {
      code: 'VALIDATION_ERROR',
      message: `role '${input.role}' is not declared in auth.roles (allowed: ${context.roleNames.join(', ')})`,
      field: 'role',
    }
  }
  return undefined
}

/**
 * Validate a `user_access` row insert against the active auth config.
 *
 * Returns `undefined` on success, or a structured error describing the first
 * rule violated. Callers (HTTP handlers) translate the error into a 400
 * response while preserving `field` and `message` for spec assertions.
 */
export const validateUserAccessInput = (
  input: UserAccessInput,
  context: UserAccessValidationContext
): UserAccessValidationError | undefined =>
  validateUserId(input) ??
  validateTableSlug(input, context) ??
  validateRecordIds(input) ??
  validateRole(input, context)
