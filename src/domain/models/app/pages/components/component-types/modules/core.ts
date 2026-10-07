/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ComponentClassesSchema } from '../../../../component-style'
import { ComponentPropsSchema } from '../../props'

/**
 * Core fields available to almost all components.
 *
 * `props` carries the element's attributes and its root `className`; `classes`
 * styles the component's named parts (see `ComponentClassesSchema`), which is
 * what lets a template restyle an inner element without an arbitrary
 * descendant selector.
 */
export const coreFields = {
  props: Schema.optional(ComponentPropsSchema),
  classes: Schema.optional(ComponentClassesSchema),
} as const
