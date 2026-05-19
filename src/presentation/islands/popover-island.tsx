/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Popover } from '@base-ui/react/popover'
import type { ReactElement } from 'react'

interface PopoverIslandProps {
  readonly title?: string
  readonly description?: string
  readonly floatingSide?: 'top' | 'right' | 'bottom' | 'left'
  readonly floatingAlign?: 'start' | 'center' | 'end'
  readonly triggerHtml?: string
  readonly childrenHtml?: string
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
}

function SSRSkeletonSpan({ html }: { readonly html: string }): ReactElement {
  return <span dangerouslySetInnerHTML={{ __html: html }} />
}

function SSRSkeletonDiv({ html }: { readonly html: string }): ReactElement {
  return <div dangerouslySetInnerHTML={{ __html: html }} />
}

export default function PopoverIsland({
  title,
  description,
  floatingSide = 'bottom',
  floatingAlign = 'center',
  triggerHtml,
  childrenHtml,
  className,
  id,
  'data-testid': testId,
}: PopoverIslandProps): ReactElement {
  return (
    <Popover.Root>
      <Popover.Trigger
        className={className}
        id={id}
        data-testid={testId}
      >
        {triggerHtml ? <SSRSkeletonSpan html={triggerHtml} /> : <span>Open</span>}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side={floatingSide}
          align={floatingAlign}
          sideOffset={8}
        >
          <Popover.Popup className="w-72 rounded-lg border border-gray-200 bg-white p-4 shadow-lg transition-all data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
            {title && (
              <Popover.Title className="mb-1 text-sm font-semibold text-gray-900">
                {title}
              </Popover.Title>
            )}
            {description && (
              <Popover.Description className="mb-3 text-sm text-gray-600">
                {description}
              </Popover.Description>
            )}
            {childrenHtml && <SSRSkeletonDiv html={childrenHtml} />}
            <Popover.Arrow className="text-white">
              <svg
                width="12"
                height="6"
                viewBox="0 0 12 6"
                fill="currentColor"
              >
                <path d="M0 6L6 0L12 6" />
              </svg>
            </Popover.Arrow>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
