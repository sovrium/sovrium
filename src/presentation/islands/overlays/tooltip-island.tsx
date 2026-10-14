/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Tooltip } from '@base-ui/react/tooltip'
import { computeTooltipArrowClasses, computeTooltipContentClasses } from './tooltip-default-classes'
import type { ReactElement } from 'react'

interface TooltipIslandProps {
  readonly tooltipContent?: string
  readonly floatingSide?: 'top' | 'right' | 'bottom' | 'left'
  readonly tooltipDelay?: number
  readonly childrenHtml?: string
  readonly triggerId?: string
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
}

/**
 * The element the trigger renders AS when the tooltip wraps authored content.
 * Base UI's Tooltip.Trigger is a `<button>` by default, and the authored child
 * is usually a control of its own (a button, a link), so the default would nest
 * a button inside a button. A `<span>` carries the trigger's handlers and ARIA
 * only, and the authored control keeps its own semantics and focus; its hover
 * and focus events reach the span by bubbling. Hoisted so its identity is
 * stable across renders.
 */
const AUTHORED_TRIGGER_RENDER = <span />

/**
 * Tooltip island — wraps Base UI Tooltip for hover/focus info popups.
 *
 * Shows a short text when the user hovers or focuses the trigger element.
 * Supports configurable side positioning and open delay. The trigger element's
 * id (`triggerId`) is placed on the Tooltip.Trigger so the hover target matches
 * the schema-authored child id; the serialized child HTML provides the label.
 */
export default function TooltipIsland({
  tooltipContent = '',
  floatingSide = 'top',
  tooltipDelay = 600,
  childrenHtml,
  triggerId,
  className,
  id,
  'data-testid': testId,
}: TooltipIslandProps): ReactElement {
  // When the trigger child HTML carries its own id, keep the outer Trigger id
  // distinct (the container id) to avoid a duplicate-id collision; otherwise
  // fall back to the trigger id so the hover target is still addressable.
  const triggerElementId = childrenHtml ? id : (triggerId ?? id)
  return (
    <Tooltip.Provider
      delay={tooltipDelay}
      closeDelay={0}
    >
      <Tooltip.Root disableHoverablePopup>
        <Tooltip.Trigger
          data-slot="tooltip-trigger"
          render={childrenHtml ? AUTHORED_TRIGGER_RENDER : undefined}
          className={className}
          id={triggerElementId}
          data-testid={testId}
        >
          {childrenHtml ? (
            // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- preserves SSR trigger HTML on initial paint
            <span dangerouslySetInnerHTML={{ __html: childrenHtml }} />
          ) : (
            <span>?</span>
          )}
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner
            side={floatingSide}
            sideOffset={4}
            className="isolate z-50"
          >
            <Tooltip.Popup
              data-slot="tooltip-content"
              className={computeTooltipContentClasses()}
            >
              {tooltipContent}
              <Tooltip.Arrow className={computeTooltipArrowClasses()} />
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}
