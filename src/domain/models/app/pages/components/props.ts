/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Component props re-export for sections
 *
 * The `props` property in ComponentSchema uses ComponentPropsSchema from the
 * shared components module. This file provides a section-local re-export
 * for schema path consistency.
 *
 * @see {@link ComponentPropsSchema} from `../../components/props`
 */
export {
  ComponentPropsSchema,
  ComponentPropValueSchema,
  type ComponentProps,
  type ComponentPropValue,
} from '../../components/props'
