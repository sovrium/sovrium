/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { FEATURED_WRAPPER_CLASSES } from './featured-card-classes'
import type { KeyboardEvent, ReactElement } from 'react'

/** The link a navigating card wraps its content in: a block, in the card's own colours. */
const GALLERY_CARD_LINK_CLASSES = 'block text-inherit no-underline'

/** Enter or Space on a card that opens a drawer opens it, as a click does. */
function buildDrawerKeyHandler(open: () => void): (e: KeyboardEvent<HTMLDivElement>) => void {
  return (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    open()
  }
}

/** The card's content, wrapped in what its click does: a link, a drawer opener, or nothing. */
export function CardClickTarget({
  navigatePath,
  openDrawer,
  body,
  featured,
}: {
  readonly navigatePath: string | undefined
  readonly openDrawer: (() => void) | undefined
  readonly body: ReactElement
  readonly featured: boolean
}): ReactElement {
  const featuredClasses = featured ? ` ${FEATURED_WRAPPER_CLASSES}` : ''
  if (navigatePath) {
    return (
      <a
        href={navigatePath}
        className={`${GALLERY_CARD_LINK_CLASSES}${featuredClasses}`}
      >
        {body}
      </a>
    )
  }
  if (!openDrawer) return body
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openDrawer}
      onKeyDown={buildDrawerKeyHandler(openDrawer)}
      className={featured ? FEATURED_WRAPPER_CLASSES : undefined}
    >
      {body}
    </div>
  )
}
