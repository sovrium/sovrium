/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { interactiveComponents } from './interactive-components'
import { mediaComponents } from './media-components'
import { specialComponents } from './special-components'
import { structuralComponents } from './structural-components'
import { textComponents } from './text-components'
import type { ComponentRenderer } from '../component-dispatch-config'
import type { Component } from '@/domain/models/app/page/sections'

/**
 * Component registry mapping component types to their renderer functions
 *
 * This registry combines all component categories:
 * - Structural: section, header, footer, div, container, etc.
 * - Text: h1-h6, heading, text, paragraph, code, etc.
 * - Media: image, video, audio, iframe, etc.
 * - Interactive: button, link, form, input, icon, badge, etc.
 * - Special: hero, card-*, speech-bubble, navigation, list, etc.
 */
export const COMPONENT_REGISTRY: Partial<Record<Component['type'], ComponentRenderer>> = {
  ...structuralComponents,
  ...textComponents,
  ...mediaComponents,
  ...interactiveComponents,
  ...specialComponents,
}

// Re-export individual component groups for granular imports if needed
export { structuralComponents } from './structural-components'
export { textComponents } from './text-components'
export { mediaComponents } from './media-components'
export { interactiveComponents } from './interactive-components'
export { specialComponents } from './special-components'
