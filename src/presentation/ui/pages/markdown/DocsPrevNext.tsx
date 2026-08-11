/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import type { CollectionPrevNext } from '@/presentation/rendering/content-dir-lister'

/**
 * SSR previous/next chrome rendered at the foot of a markdown article in
 * the `docs` layout. Either side may be
 * undefined for boundary entries (first entry has no previous; last has no
 * next) — the component still renders the `<div>` wrapper so the
 * `[data-component="docs-prev-next"]` selector stays addressable even when
 * only one neighbour exists.
 */
interface DocsPrevNextProps {
  readonly previous: CollectionPrevNext | undefined
  readonly next: CollectionPrevNext | undefined
  /** Localized "Previous" label; the `←` arrow is prefixed here. */
  readonly previousLabel: string
  /** Localized "Next" label; the `→` arrow is suffixed here. */
  readonly nextLabel: string
}

export function DocsPrevNext({
  previous,
  next,
  previousLabel,
  nextLabel,
}: DocsPrevNextProps): Readonly<ReactElement> | undefined {
  if (previous === undefined && next === undefined) return undefined
  const cardClass =
    'group flex flex-col gap-1 rounded-xl border border-border bg-background-overlay/40 px-4 py-3 no-underline transition-colors duration-150 hover:border-border-strong hover:bg-background-overlay'
  return (
    <div
      data-component="docs-prev-next"
      className="border-border mt-12 grid grid-cols-1 gap-4 border-t pt-8 text-sm sm:grid-cols-2"
    >
      {previous ? (
        <a
          href={previous.href}
          rel="prev"
          className={`${cardClass} items-start text-left`}
        >
          <span className="text-foreground-subtle text-xs">{`← ${previousLabel}`}</span>
          <span className="text-foreground-muted group-hover:text-foreground font-medium">
            {previous.label}
          </span>
        </a>
      ) : (
        <span />
      )}
      {next ? (
        <a
          href={next.href}
          rel="next"
          className={`${cardClass} items-end text-right`}
        >
          <span className="text-foreground-subtle text-xs">{`${nextLabel} →`}</span>
          <span className="text-foreground-muted group-hover:text-foreground font-medium">
            {next.label}
          </span>
        </a>
      ) : (
        <span />
      )}
    </div>
  )
}
