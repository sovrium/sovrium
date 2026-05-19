/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
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

export const validateUserAccessInput = (
  input: UserAccessInput,
  context: UserAccessValidationContext
): UserAccessValidationError | undefined =>
  validateUserId(input) ??
  validateTableSlug(input, context) ??
  validateRecordIds(input) ??
  validateRole(input, context)
