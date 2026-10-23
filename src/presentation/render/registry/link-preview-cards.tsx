/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ReactElement } from 'react'

/** One card as the bubble draws it. */
export interface LinkPreviewCardView {
  readonly url: string
  readonly title: string | undefined
  readonly description: string | undefined
  readonly siteName: string | undefined
  /** Where the APP serves the page's picture; never the other site's address. */
  readonly imageUrl: string | undefined
}

const isHttp = (url: string): boolean => /^https?:\/\//i.test(url)

/**
 * The cards under a bubble: each a link to the page, its picture served by the
 * app, and its site name, title and description drawn as TEXT — React escapes
 * them, and none of the page's markup was kept to begin with.
 */
export function LinkPreviewCards({ cards }: { readonly cards: unknown }): ReactElement | undefined {
  if (!Array.isArray(cards) || cards.length === 0) return undefined
  const drawn = (cards as readonly LinkPreviewCardView[]).filter((card) => isHttp(card.url))
  return (
    <span
      data-slot="link-previews"
      className="mt-2 flex flex-col gap-2"
    >
      {drawn.map((card) => (
        <a
          key={card.url}
          href={card.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          data-slot="link-preview"
          className="border-border bg-background text-foreground hover:bg-muted flex min-w-0 overflow-hidden rounded-md border no-underline"
        >
          {card.imageUrl === undefined ? undefined : (
            <img
              src={card.imageUrl}
              alt=""
              loading="lazy"
              className="h-20 w-20 shrink-0 object-cover"
            />
          )}
          <span className="flex min-w-0 flex-col gap-0.5 p-2">
            {card.siteName === undefined ? undefined : (
              <span className="text-muted-foreground truncate text-xs">{card.siteName}</span>
            )}
            {card.title === undefined ? undefined : (
              <span className="text-sm font-medium">{card.title}</span>
            )}
            {card.description === undefined ? undefined : (
              <span className="text-muted-foreground line-clamp-2 text-xs">{card.description}</span>
            )}
          </span>
        </a>
      ))}
    </span>
  )
}
