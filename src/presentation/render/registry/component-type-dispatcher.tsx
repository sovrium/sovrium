/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Fragment, type ReactElement } from 'react'
import {
  EXPORT_STAMP_CLOSE_ATTRIBUTE,
  EXPORT_STAMP_OPEN_ATTRIBUTE,
} from '@/domain/models/app/pages/export-node-stamp-service'
import { exportNodeIdOf } from '@/domain/models/app/pages/node-identity'
import * as Renderers from '../elements'
import { COMPONENT_REGISTRY } from './component-registry'
import type {
  ComponentDispatchConfig,
  ComponentRenderer,
  DispatchableComponentType,
} from './component-dispatch-config'

/**
 * Dispatch component rendering based on type using registry pattern
 * Complexity reduced from 47 to <10 by replacing switch statement with lookup
 * Parameters reduced from 7 to 1 by using config object
 */
export function dispatchComponentType(config: ComponentDispatchConfig): ReactElement | null {
  const drawn = drawComponentType(config)
  const exportNodeId = exportNodeIdOf(config.component)
  if (exportNodeId === undefined) return drawn
  // A page export's node, bracketed so its id lands on whatever root its type
  // draws (`export-node-stamp-service.ts`); no other render carries an id.
  return (
    <Fragment>
      <template {...{ [EXPORT_STAMP_OPEN_ATTRIBUTE]: exportNodeId }} />
      {drawn}
      <template {...{ [EXPORT_STAMP_CLOSE_ATTRIBUTE]: exportNodeId }} />
    </Fragment>
  )
}

/**
 * Draw one component with its type's renderer.
 *
 * Generic in the type drawn, so the registry hands back the renderer typed for
 * THAT type and the config reaches it typed the same way: the renderer reads its
 * own branch of the component union, which the boot decode of the app config
 * already proved the component is a member of. This is the one place a
 * component is narrowed to its type for drawing; it adds no runtime check, and
 * an unknown type keeps its answer below.
 */
function drawComponentType<K extends DispatchableComponentType>(
  config: ComponentDispatchConfig<K>
): ReactElement | null {
  // Registry lookup replaces giant switch statement
  const renderer: ComponentRenderer<K> | undefined = COMPONENT_REGISTRY[config.type]
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
