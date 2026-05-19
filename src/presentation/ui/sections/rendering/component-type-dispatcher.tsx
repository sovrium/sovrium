/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import * as Renderers from '../renderers/element-renderers'
import { COMPONENT_REGISTRY } from './component-registry'
import type { ComponentDispatchConfig } from './component-dispatch-config'
import type { ReactElement } from 'react'

export function dispatchComponentType(config: ComponentDispatchConfig): ReactElement | null {
  const renderer = COMPONENT_REGISTRY[config.type]
  if (renderer) {
    return renderer(config)
  }

  return Renderers.renderHTMLElement({
    type: 'div',
    props: config.elementProps,
    content: config.content,
    children: config.renderedChildren,
    interactions: config.interactions,
  })
}
