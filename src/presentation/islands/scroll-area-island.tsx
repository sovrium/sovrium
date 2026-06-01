/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { ScrollArea } from '@base-ui/react/scroll-area'
import { useMemo } from 'react'
import {
  computeScrollAreaScrollbarClasses,
  computeScrollAreaThumbClasses,
} from './scroll-area-default-classes'
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
  const viewportStyle = useMemo(() => ({ maxHeight: scrollAreaHeight }), [scrollAreaHeight])
  return (
    <ScrollArea.Root
      className={className}
      id={id}
      data-testid={testId}
      style={rootStyle}
    >
      <ScrollArea.Viewport
        className="w-full overflow-hidden"
        style={viewportStyle}
      >
        <ScrollArea.Content>
          {childrenHtml && (
            <div dangerouslySetInnerHTML={{ __html: childrenHtml }} />
          )}
        </ScrollArea.Content>
      </ScrollArea.Viewport>

      {(scrollOrientation === 'vertical' || scrollOrientation === 'both') && (
        <ScrollArea.Scrollbar
          orientation="vertical"
          keepMounted
          role="scrollbar"
          className={computeScrollAreaScrollbarClasses({ orientation: 'vertical' })}
        >
          <ScrollArea.Thumb className={computeScrollAreaThumbClasses()} />
        </ScrollArea.Scrollbar>
      )}

      {(scrollOrientation === 'horizontal' || scrollOrientation === 'both') && (
        <ScrollArea.Scrollbar
          orientation="horizontal"
          keepMounted
          role="scrollbar"
          className={computeScrollAreaScrollbarClasses({ orientation: 'horizontal' })}
        >
          <ScrollArea.Thumb className={computeScrollAreaThumbClasses()} />
        </ScrollArea.Scrollbar>
      )}
    </ScrollArea.Root>
  )
}
