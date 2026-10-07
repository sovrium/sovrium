/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { cn } from '@/presentation/design/class-merge'
import { DOCS_TOC_FRAME_CLASSES } from './docs-frame'
import type { DocsChromeLabels } from './docs-chrome-labels'
import type { ResolvedMarkdownPage } from './markdown-page-resolver'
import type { ReactElement } from 'react'

/**
 * Indent a TOC entry by its heading level so nested headings (h3 under h2)
 * read as a hierarchy in the right rail. Level 2 = flush, each deeper level
 * adds left padding.
 */
const tocIndentClass = (level: number): string => {
  if (level <= 2) return ''
  if (level === 3) return 'pl-3'
  return 'pl-6'
}

export const renderToc = (
  markdown: ResolvedMarkdownPage,
  labels: DocsChromeLabels
): Readonly<ReactElement> | undefined => {
  if (markdown.tocHeadings === undefined || markdown.tocHeadings.length === 0) return undefined
  const sidebar = markdown.tocPosition === 'sidebar'
  return (
    <nav
      data-component="markdown-toc"
      data-component-type="toc"
      data-position={markdown.tocPosition ?? 'top'}
      aria-label="Table of contents"
      className={cn(
        sidebar
          ? // The offset clears the two-row docs header (6.5rem) unless `frame.stickyOffset` says otherwise.
            `text-md ${DOCS_TOC_FRAME_CLASSES} hidden shrink-0 self-start overflow-y-auto py-12 pr-4 xl:block`
          : 'text-md mb-6',
        markdown.parts?.['toc']
      )}
    >
      <p className="text-foreground-subtle mb-3 text-sm font-semibold tracking-wide uppercase">
        {labels.onThisPage}
      </p>
      <ol className="border-border space-y-2 border-l">
        {markdown.tocHeadings.map((heading) => (
          <li
            key={heading.id}
            data-toc-level={heading.level}
            className={tocIndentClass(heading.level)}
          >
            <a
              href={`#${heading.id}`}
              data-toc-link={heading.id}
              className="sv-toc-link hover:border-border-strong text-foreground-muted hover:text-foreground -ml-px block border-l border-transparent pl-3 transition-colors duration-150"
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
