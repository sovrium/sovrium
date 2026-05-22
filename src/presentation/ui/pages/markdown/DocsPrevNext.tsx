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
  return (
    <div
      data-component="docs-prev-next"
      className="mt-8 flex items-center justify-between gap-4 border-t pt-6 text-sm"
    >
      {previous ? (
        <a
          href={previous.href}
          rel="prev"
          className="text-link hover:underline"
        >
          {'← '}
          {previous.label}
        </a>
      ) : (
        <span />
      )}
      {next ? (
        <a
          href={next.href}
          rel="next"
          className="text-link hover:underline"
        >
          {next.label}
          {' →'}
        </a>
      ) : (
        <span />
      )}
    </div>
  )
}
