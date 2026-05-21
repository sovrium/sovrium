/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { ScrollArea } from '@base-ui/react/scroll-area'
import { useMemo } from 'react'
import type { ReactElement } from 'react'

interface ScrollAreaIslandProps {
  readonly scrollAreaHeight?: string
  readonly scrollOrientation?: 'vertical' | 'horizontal' | 'both'
  readonly childrenHtml?: string
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
}

export default function ScrollAreaIsland({
  scrollAreaHeight = '400px',
  scrollOrientation = 'vertical',
  childrenHtml,
  className,
  id,
  'data-testid': testId,
}: ScrollAreaIslandProps): ReactElement {
  const rootStyle = useMemo(() => ({ maxHeight: scrollAreaHeight }), [scrollAreaHeight])
  return (
    <ScrollArea.Root
      className={className}
      id={id}
      data-testid={testId}
      style={rootStyle}
    >
      <ScrollArea.Viewport className="h-full w-full overflow-hidden">
        {childrenHtml && (
          <div dangerouslySetInnerHTML={{ __html: childrenHtml }} />
        )}
      </ScrollArea.Viewport>

      {(scrollOrientation === 'vertical' || scrollOrientation === 'both') && (
        <ScrollArea.Scrollbar
          orientation="vertical"
          className="flex w-2 touch-none p-0.5 opacity-0 transition-opacity hover:opacity-100 data-[hovering]:opacity-100 data-[scrolling]:opacity-100"
        >
          <ScrollArea.Thumb className="bg-border-strong flex-1 rounded-full" />
        </ScrollArea.Scrollbar>
      )}

      {(scrollOrientation === 'horizontal' || scrollOrientation === 'both') && (
        <ScrollArea.Scrollbar
          orientation="horizontal"
          className="flex h-2 touch-none p-0.5 opacity-0 transition-opacity hover:opacity-100 data-[hovering]:opacity-100 data-[scrolling]:opacity-100"
        >
          <ScrollArea.Thumb className="bg-border-strong flex-1 rounded-full" />
        </ScrollArea.Scrollbar>
      )}
    </ScrollArea.Root>
  )
}
