/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import * as Renderers from '../renderers/element-renderers'
import { COMPONENT_REGISTRY } from './component-registry'
import type { ComponentDispatchConfig } from './component-dispatch-config'
import type { ReactElement } from 'react'

/**
 * Dispatch component rendering based on type using registry pattern
 * Complexity reduced from 47 to <10 by replacing switch statement with lookup
 * Parameters reduced from 7 to 1 by using config object
 */
export function dispatchComponentType(config: ComponentDispatchConfig): ReactElement | null {
  // Registry lookup replaces giant switch statement
  const renderer = COMPONENT_REGISTRY[config.type]
  if (renderer) {
    return renderer(config)
  }

  // Fallback for unknown types
  return Renderers.renderHTMLElement({
    type: 'div',
    props: config.elementProps,
    content: config.content,
    children: config.renderedChildren,
    interactions: config.interactions,
  })
}
