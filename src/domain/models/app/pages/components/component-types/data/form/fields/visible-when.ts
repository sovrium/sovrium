/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * visibleWhen property for form field configurations
 *
 * Defines conditional visibility rules for form fields based on
 * the value of another field (e.g., show "state" field only when
 * "country" is "US").
 *
 * This is a re-export for schema path consistency. The canonical definition
 * lives in the sections/form module.
 *
 * @see {@link VisibleWhenSchema} from `../form`
 */
export { VisibleWhenSchema, type VisibleWhen } from '../schema'
