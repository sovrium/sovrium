/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { PreviewCard } from '@base-ui/react/preview-card'
import type { ReactElement } from 'react'

interface HoverCardIslandProps {
  readonly floatingSide?: 'top' | 'right' | 'bottom' | 'left'
  readonly floatingAlign?: 'start' | 'center' | 'end'
  readonly openDelay?: number
  readonly closeDelay?: number
  readonly triggerHtml?: string
  readonly triggerLabel?: string
  readonly triggerId?: string
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

const TRIGGER_RENDER = <span />

function HoverCardPopupContents({
  childrenHtml,
}: {
  readonly childrenHtml?: string
}): ReactElement {
  return (
    <>
      {childrenHtml && <SSRSkeletonDiv html={childrenHtml} />}
      <PreviewCard.Arrow className="text-background-overlay">
        <svg
          width="12"
          height="6"
          viewBox="0 0 12 6"
          fill="currentColor"
        >
          <path d="M0 6L6 0L12 6" />
        </svg>
      </PreviewCard.Arrow>
    </>
  )
}

export default function HoverCardIsland({
  floatingSide = 'bottom',
  floatingAlign = 'center',
  openDelay = 600,
  closeDelay = 300,
  triggerHtml,
  triggerLabel,
  childrenHtml,
  className,
  'data-testid': testId,
}: HoverCardIslandProps): ReactElement {
  const triggerInner = triggerHtml ? (
    <SSRSkeletonSpan html={triggerHtml} />
  ) : (
    <span>{triggerLabel ?? 'Open'}</span>
  )
  return (
    <PreviewCard.Root>
      <PreviewCard.Trigger
        render={TRIGGER_RENDER}
        className={className}
        data-testid={testId}
        delay={openDelay}
        closeDelay={closeDelay}
      >
        {triggerInner}
      </PreviewCard.Trigger>
      <PreviewCard.Portal>
        <PreviewCard.Positioner
          side={floatingSide}
          align={floatingAlign}
          sideOffset={8}
        >
          <PreviewCard.Popup className="border-border bg-background-overlay text-foreground w-72 rounded-lg border p-4 shadow-lg transition-all data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
            <HoverCardPopupContents childrenHtml={childrenHtml} />
          </PreviewCard.Popup>
        </PreviewCard.Positioner>
      </PreviewCard.Portal>
    </PreviewCard.Root>
  )
}
