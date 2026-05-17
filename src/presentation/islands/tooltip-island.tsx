/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Tooltip } from '@base-ui/react/tooltip'
import type { ReactElement } from 'react'

interface TooltipIslandProps {
  readonly tooltipContent?: string
  readonly floatingSide?: 'top' | 'right' | 'bottom' | 'left'
  readonly tooltipDelay?: number
  readonly childrenHtml?: string
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
}

/**
 * Tooltip island — wraps Base UI Tooltip for hover/focus info popups.
 *
 * Shows a short text when the user hovers or focuses the trigger element.
 * Supports configurable side positioning and open delay.
 */
export default function TooltipIsland({
  tooltipContent = '',
  floatingSide = 'top',
  tooltipDelay = 600,
  childrenHtml,
  className,
  id,
  'data-testid': testId,
}: TooltipIslandProps): ReactElement {
  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger
          delay={tooltipDelay}
          className={className}
          id={id}
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
            <Tooltip.Popup className="rounded-md bg-gray-900 px-3 py-1.5 text-xs text-white shadow-md transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0">
              {tooltipContent}
              <Tooltip.Arrow className="text-gray-900">
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
