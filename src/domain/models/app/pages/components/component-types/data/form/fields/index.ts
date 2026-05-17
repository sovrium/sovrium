/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * fields array property for form sections
 *
 * Defines the individual field configurations within a form section,
 * including field name, label, visibility conditions, and validation.
 *
 * This is a re-export for schema path consistency. The canonical definition
 * lives in the sections/form module.
 *
 * @see {@link FormFieldConfigSchema} from `../form`
 */
export { FormFieldConfigSchema as FieldSchema, type FormFieldConfig as Field } from '../schema'
