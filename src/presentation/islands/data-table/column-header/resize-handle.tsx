/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeTableResizeHandleClasses } from '@/presentation/design/table-default-classes'
import type { DataTableHeader } from '../island/table-features'
import type { ReactElement, SyntheticEvent } from 'react'

/** Stops a synthetic event so a click on the resize handle does not bubble up
 *  to the `<th>` and trigger a column sort. */
const stopEvent = (event: SyntheticEvent) => event.stopPropagation()

/**
 * Resize handle: an absolutely-positioned `<div>` on the right edge of the
 * header cell. It exposes `data-resize-handle` AND the `resize-handle` class so
 * spec locators (`locator('.resize-handle, [data-resize-handle]')`) resolve.
 * `onMouseDown` is wired to TanStack Table's `header.getResizeHandler()` —
 * pointer dragging then drives the controlled `columnSizing` state, which lasts
 * for the reader's visit. Returns `undefined` when the
 * column is not resizable.
 */
export function ResizeHandle({
  header,
}: {
  readonly header: DataTableHeader
}): ReactElement | undefined {
  if (!header.column.getCanResize()) return undefined
  return (
    <div
      data-resize-handle
      // A 4px hit-area on the right edge of the header. Width must be large
      // enough for Playwright's `hover()` visibility check to pass (zero-area
      // divs are treated as invisible); the recipe's `opacity-0` does not
      // affect that check, which reads the box, not the paint.
      className={computeTableResizeHandleClasses()}
      onMouseDown={header.getResizeHandler()}
      onTouchStart={header.getResizeHandler()}
      onClick={stopEvent}
    />
  )
}
