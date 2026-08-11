/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Tooltip } from '@base-ui/react/tooltip'
import { computeTooltipPopupClasses } from './overlay-default-classes'
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
            sideOffset={6}
          >
            <Tooltip.Popup className={computeTooltipPopupClasses()}>
              {tooltipContent}
              <Tooltip.Arrow className="text-foreground">
                <svg
                  width="10"
                  height="5"
                  viewBox="0 0 10 5"
                  fill="currentColor"
                >
                  <path d="M0 0L5 5L10 0" />
                </svg>
              </Tooltip.Arrow>
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}
