/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  filterTocHeadings,
  type MarkdownHeading,
  type RenderedMarkdown,
} from '@/domain/kernel/markdown/markdown-renderer'
import type { Markdown } from '@/domain/models/app/pages/markdown'

const DEFAULT_TOC_MAX_DEPTH = 3
const DEFAULT_TOC_POSITION = 'top' as const

/**
 * The TOC payload: headings between `toc.minDepth` and `toc.maxDepth`, at
 * `toc.position`; `undefined` when the page asked for no TOC.
 */
export const buildToc = (
  rendered: RenderedMarkdown,
  toc: Markdown['toc']
): { headings: readonly MarkdownHeading[]; position: 'top' | 'sidebar' } | undefined => {
  if (toc === undefined) return undefined
  const maxDepth = toc.maxDepth ?? DEFAULT_TOC_MAX_DEPTH
  const minDepth = toc.minDepth ?? 1
  const position = toc.position ?? DEFAULT_TOC_POSITION
  const headings = filterTocHeadings(rendered.headings, maxDepth).filter(
    (heading) => heading.level >= minDepth
  )
  return { headings, position }
}
