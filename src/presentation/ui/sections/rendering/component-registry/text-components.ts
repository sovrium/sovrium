/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import * as Renderers from '../../renderers/element-renderers'
import type { ComponentRenderer } from '../component-dispatch-config'
import type { Component } from '@/domain/models/app/pages/components'

const HEADING_LEVELS: Record<string, number> = {
  h1: 1,
  h2: 2,
  h3: 3,
  h4: 4,
  h5: 5,
  h6: 6,
}

export const textComponents: Partial<Record<Component['type'], ComponentRenderer>> = {
  text: ({ elementProps, content, renderedChildren, component }) => {
    const element = (component as Record<string, unknown> | undefined)?.element as
      | string
      | undefined
    const headingLevel = element ? HEADING_LEVELS[element] : undefined

    if (headingLevel) {
      return Renderers.renderHeading(
        headingLevel as 1 | 2 | 3 | 4 | 5 | 6,
        elementProps,
        content,
        renderedChildren
      )
    }
    if (element === 'pre') {
      return Renderers.renderPre(elementProps, content, renderedChildren)
    }
    if (element === 'code') {
      return Renderers.renderCode(elementProps, content, renderedChildren)
    }
    if (element === 'p') {
      return Renderers.renderParagraph(elementProps, content, renderedChildren)
    }
    if (element === 'blockquote') {
      return Renderers.renderContent(elementProps, content)
    }

    return Renderers.renderTextElement(elementProps, content, renderedChildren)
  },
}
