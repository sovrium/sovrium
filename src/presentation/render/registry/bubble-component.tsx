/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeBubbleClasses } from '../../design/bubble-default-classes'
import { mergePrestyle } from './interactive-prestyle-builders'
import type { ComponentRenderer } from './component-dispatch-config'

/**
 * The `bubble` component: the surface of one chat turn, set to its side of the
 * thread by `align` (`start`, the default, or `end`). Its `content` comes first
 * and its children after it, inside the one surface.
 */
const bubbleComponent: ComponentRenderer = ({
  elementPropsWithSpacing,
  content,
  renderedChildren,
  component,
}) => {
  const align = (component as { align?: unknown } | undefined)?.align === 'end' ? 'end' : 'start'
  return (
    <div
      data-testid={elementPropsWithSpacing['data-testid'] as string | undefined}
      data-component-type="bubble"
      data-align={align}
      className={mergePrestyle(
        computeBubbleClasses({ align }),
        elementPropsWithSpacing['className'] as string | undefined
      )}
    >
      {content}
      {renderedChildren}
    </div>
  )
}

/** The bubble family's renderers, keyed by type, for the structural registry. */
export const bubbleComponents = {
  bubble: bubbleComponent,
} as const satisfies Readonly<Record<string, ComponentRenderer>>
