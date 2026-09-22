/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import { computeListLoadMoreClasses } from '@/presentation/design/list-default-classes'
import type { ReactElement } from 'react'

// Both recipes are pure and resolved once at module load: the footer re-renders
// on every page the reader loads, and neither string depends on anything.
const FOOTER_CLASSES = computeListLoadMoreClasses()
const BUTTON_CLASSES = computeButtonDefaultClasses({ variant: 'secondary', size: 'sm' })

/**
 * The control a list renders under its items when `listDisplay.loadMore` asks
 * for a button and more records exist behind the page already shown.
 *
 * It spends the same two recipes as the SSR pagination footer
 * (`renderLoadMoreUI` in `special-components.tsx`) and as the gallery's own
 * control, so all three are one button rather than three approximations. The
 * accessible name is the visible label — no `aria-label` overriding it with a
 * different casing of the same words.
 *
 * The label does NOT change while a page is in flight. A control that renames
 * itself is a control a reader has to re-find, and the name is what anyone
 * looking for this button — a screen-reader user or a test — asks for; the
 * disabled state carries the "in progress" meaning instead.
 */
export function ListLoadMore({
  onClick,
  isLoading,
}: {
  readonly onClick: () => void
  /**
   * The page THIS control asked for is in flight — the caller's `isLoadingMore`,
   * never its `isLoading`, which describes the first page and is already false
   * by the time this control renders at all. The control stays mounted while it
   * is true, so the layout holds still.
   */
  readonly isLoading: boolean
}): ReactElement {
  return (
    <div className={FOOTER_CLASSES}>
      <button
        type="button"
        onClick={onClick}
        disabled={isLoading}
        aria-busy={isLoading}
        className={BUTTON_CLASSES}
      >
        Load More
      </button>
    </div>
  )
}
