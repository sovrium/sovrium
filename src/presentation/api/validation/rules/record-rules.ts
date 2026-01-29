/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  validateReadonlyIdField,
  validateDefaultFields,
  validateRequiredFields,
  filterAllowedFields,
  validateFieldWritePermissions,
} from './field-rules'
import type {
  ValidationError,
  PermissionError,
  ValidationContext,
} from '../../middleware/validation'

/**
 * Validate fields for record creation
 * Composes all field-level validations
 */
export function validateRecordCreation(
  requestedFields: Record<string, unknown>
): Effect.Effect<Record<string, unknown>, ValidationError | PermissionError, ValidationContext> {
  return Effect.gen(function* () {
    // Step 1: Check readonly 'id' field
    yield* validateReadonlyIdField(requestedFields)

    // Step 2: Check fields with default values
    yield* validateDefaultFields(requestedFields)

    // Step 3: Filter fields based on write permissions
    const { allowedData, forbiddenFields } = yield* filterAllowedFields(requestedFields)

    // Step 4: Check for forbidden fields
    yield* validateFieldWritePermissions(forbiddenFields)

    // Step 5: Validate required fields (on allowed data)
    yield* validateRequiredFields(allowedData)

    return allowedData
  })
}

/**
 * Validate fields for record update
 * Similar to creation but without required field validation
 */
export function validateRecordUpdate(
  requestedFields: Record<string, unknown>
): Effect.Effect<Record<string, unknown>, ValidationError | PermissionError, ValidationContext> {
  return Effect.gen(function* () {
    // Step 1: Check readonly 'id' field
    yield* validateReadonlyIdField(requestedFields)

    // Step 2: Check fields with default values
    yield* validateDefaultFields(requestedFields)

    // Step 3: Filter fields based on write permissions
    const { allowedData, forbiddenFields } = yield* filterAllowedFields(requestedFields)

    // Step 4: Check for forbidden fields
    yield* validateFieldWritePermissions(forbiddenFields)

    // Note: No required field validation for updates (partial updates allowed)

    return allowedData
  })
}
