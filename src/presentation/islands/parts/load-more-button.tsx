/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import type { ReactElement } from 'react'

/** The shared F1 secondary button, resolved once: it depends on nothing. */
const SECONDARY_BUTTON_CLASSES = computeButtonDefaultClasses({ variant: 'secondary', size: 'sm' })

interface LoadMoreButtonProps {
  readonly onClick: () => void
  /**
   * The page THIS control asked for is in flight — never the first page's
   * loading state, which is already over by the time the control renders.
   * The button is disabled, not hidden, so the layout holds still and a second
   * click cannot re-request the page already being fetched.
   */
  readonly isLoading?: boolean
  /** The footer that holds the button — each surface keeps its own pager chrome. */
  readonly footerClassName: string
  /** Defaults to the shared secondary button a gallery and a list both use. */
  readonly buttonClassName?: string
  /** Visible label, which is also the accessible name. */
  readonly label?: string
}

/**
 * The one "Load more" control every data component that loads page by page
 * draws under its rows — the table grid, the gallery and the list.
 *
 * It is rendered only while more rows exist; the caller decides that and
 * renders nothing at the end, because a disabled "Load more" at the end of a
 * list reads as a permission problem rather than as "you have it all".
 *
 * The label does NOT change while a page is in flight. A control that renames
 * itself is a control a reader has to re-find, and the name is what a
 * screen-reader user asks for; `aria-busy` carries the "in progress" meaning.
 */
export function LoadMoreButton({
  onClick,
  isLoading = false,
  footerClassName,
  buttonClassName = SECONDARY_BUTTON_CLASSES,
  label = 'Load More',
}: LoadMoreButtonProps): ReactElement {
  return (
    <div
      data-load-more
      className={footerClassName}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={isLoading}
        aria-busy={isLoading}
        className={buttonClassName}
      >
        {label}
      </button>
    </div>
  )
}
