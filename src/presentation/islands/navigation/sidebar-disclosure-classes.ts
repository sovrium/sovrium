/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeSidebarDisclosureListClasses,
  computeSidebarDisclosureStateClasses,
  computeSidebarDisclosureToggleClasses,
} from '@/presentation/design/sidebar-default-classes'

/**
 * The classes a sidebar disclosure's toggle, nested list and state line
 * paint.
 */

export const TOGGLE_CLASS = computeSidebarDisclosureToggleClasses()

export const LIST_CLASS = computeSidebarDisclosureListClasses()

export const STATE_CLASS = computeSidebarDisclosureStateClasses()
