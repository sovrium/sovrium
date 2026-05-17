/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * fieldGroups array property for form sections
 *
 * Defines grouped collections of form fields with a shared label,
 * used to organize form layouts into logical sections.
 *
 * This is a re-export for schema path consistency. The canonical definition
 * lives in the sections/form module.
 *
 * @see {@link FormFieldGroupSchema} from `../form`
 */
export {
  FormFieldGroupSchema as FieldGroupSchema,
  type FormFieldGroup as FieldGroup,
} from '../schema'
