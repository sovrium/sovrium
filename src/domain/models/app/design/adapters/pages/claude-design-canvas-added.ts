/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { CANVAS_STAMP } from './claude-design-canvas-draw'
import { CANVAS_LINK_STAMP } from './claude-design-canvas-links'
import { shownText } from './claude-design-canvas-style'
import type { HtmlElementNode } from '@/domain/kernel/sanitize/html-element-tree'
import type { DrawnAs } from '@/domain/models/app/pages/page-drawing'

/**
 * How a node the designer added is drawn: its element, its class list, and on
 * a link the address its `data-sovrium-href` names, which the merge writes on
 * the new node. A mounted component (`<x-import>`) names no element.
 */
export const drawnAsOf = (element: HtmlElementNode): DrawnAs => {
  const className = shownText(element.attributes['class'] ?? '')
  const href =
    element.attributes[CANVAS_STAMP.kit] === 'link'
      ? element.attributes[CANVAS_LINK_STAMP.href]
      : undefined
  return {
    ...(element.tag === 'x-import' ? {} : { element: element.tag }),
    ...(className === '' ? {} : { className }),
    ...(href === undefined || href === '' ? {} : { href }),
  }
}
