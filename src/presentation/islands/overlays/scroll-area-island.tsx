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

/**
 * Scroll area island — wraps Base UI ScrollArea for custom scrollbars.
 *
 * Provides custom-styled scrollbars that appear on hover, replacing
 * the browser's native scrollbar. Supports vertical, horizontal, or both.
 */
export default function ScrollAreaIsland({
  scrollAreaHeight = '400px',
  scrollOrientation = 'vertical',
  childrenHtml,
  className,
  id,
  'data-testid': testId,
}: ScrollAreaIslandProps): ReactElement {
  const rootStyle = useMemo(() => ({ maxHeight: scrollAreaHeight }), [scrollAreaHeight])
  // The Viewport itself carries the height constraint so Base UI can measure
  // overflow. `h-full` alone resolves against the Root's `max-height` (not a
  // concrete `height`), so the viewport would grow to the content size and Base
  // UI would never detect an overflow — leaving the scrollbar unmounted. Pinning
  // `maxHeight` directly on the scrollable viewport restores reliable overflow
  // detection on the CI runner.
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
            // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- preserves SSR skeleton HTML on initial paint
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
