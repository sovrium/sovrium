/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import type { CollectionPrevNext } from '@/presentation/rendering/content-dir-lister'

interface DocsPrevNextProps {
  readonly previous: CollectionPrevNext | undefined
  readonly next: CollectionPrevNext | undefined
}

export function DocsPrevNext({
  previous,
  next,
}: DocsPrevNextProps): Readonly<ReactElement> | undefined {
  if (previous === undefined && next === undefined) return undefined
  const cardClass =
    'group flex flex-col gap-1 rounded-xl border border-neutral-800 bg-neutral-900/40 px-4 py-3 no-underline transition-colors duration-150 hover:border-warmth-border hover:bg-neutral-900'
  return (
    <div
      data-component="docs-prev-next"
      className="mt-12 grid grid-cols-1 gap-4 border-t border-neutral-800 pt-8 text-sm sm:grid-cols-2"
    >
      {previous ? (
        <a
          href={previous.href}
          rel="prev"
          className={`${cardClass} items-start text-left`}
        >
          <span className="text-xs text-neutral-500">{'← Previous'}</span>
          <span className="font-medium text-neutral-200 group-hover:text-neutral-50">
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
          <span className="text-xs text-neutral-500">{'Next →'}</span>
          <span className="font-medium text-neutral-200 group-hover:text-neutral-50">
            {next.label}
          </span>
        </a>
      ) : (
        <span />
      )}
    </div>
  )
}
