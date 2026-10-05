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
  FieldFormatError,
  FieldStorageError,
  createValidationLayer,
  formatValidationError,
} from '../middleware/validation'

export { validateAttachmentReferences } from './field-rules'

export {
  validateMultiSelectOptions,
  validateMultiSelectSelectionLimits,
} from './multi-select-rules'

export { validateRelationshipLinkLimits } from './relationship-rules'

export { validateRecordCreation, sanitizeRichTextFields } from './record-rules'
