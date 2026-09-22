/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Validation Module Exports
 */

export {
  FieldValidationError,
  FieldPermissionError,
  FieldFormatError,
  FieldStorageError,
  ValidationContext,
  createValidationLayer,
  formatValidationError,
  type ValidationResult,
} from '../middleware/validation'

export {
  validateReadonlyIdField,
  validateReadonlyComputedFields,
  validateRequiredFields,
  filterAllowedFields,
  validateFieldWritePermissions,
  validateFieldFormats,
  validateAttachmentConstraints,
} from './field-rules'

export {
  validateMultiSelectOptions,
  validateMultiSelectSelectionLimits,
} from './multi-select-rules'

export { validateRelationshipLinkLimits } from './relationship-rules'

export {
  validateRecordCreation,
  validateRecordUpdate,
  sanitizeRichTextFields,
} from './record-rules'
