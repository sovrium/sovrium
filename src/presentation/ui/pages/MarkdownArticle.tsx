/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import type { ResolvedMarkdownPage } from '@/presentation/rendering/markdown-page-resolver'

const LAYOUT_CLASSES: Readonly<Record<ResolvedMarkdownPage['layout'], string>> = {
  prose: 'prose prose-slate mx-auto max-w-3xl px-4 py-12',
  docs: 'prose prose-slate max-w-none px-4 py-12',
  full: 'w-full px-4 py-12',
} as const

interface MarkdownArticleProps {
  readonly markdown: ResolvedMarkdownPage
}

const buildHtmlContainer = (html: string): { readonly __html: string } => ({ __html: html })

const renderToc = (markdown: ResolvedMarkdownPage): Readonly<ReactElement> | undefined => {
  if (markdown.tocHeadings === undefined || markdown.tocHeadings.length === 0) return undefined
  const sidebar = markdown.tocPosition === 'sidebar'
  return (
    <nav
      data-component="markdown-toc"
      data-position={markdown.tocPosition ?? 'top'}
      aria-label="Table of contents"
      className={sidebar ? 'sticky top-4 hidden w-64 shrink-0 lg:block' : 'mb-6'}
    >
      <ol>
        {markdown.tocHeadings.map((heading) => (
          <li
            key={heading.id}
            data-toc-level={heading.level}
          >
            <a href={`#${heading.id}`}>{heading.text}</a>
          </li>
        ))}
      </ol>
    </nav>
  )
}

export function MarkdownArticle({ markdown }: MarkdownArticleProps): Readonly<ReactElement> {
  const wrapperClass = LAYOUT_CLASSES[markdown.layout]
  const tocElement = renderToc(markdown)
  const sidebar = markdown.tocPosition === 'sidebar' ? tocElement : undefined
  const inlineToc = markdown.tocPosition === 'sidebar' ? undefined : tocElement
  const article = (
    <article
      data-component="markdown"
      data-layout={markdown.layout}
      className={wrapperClass}
    >
      {inlineToc}
      {}
      <div dangerouslySetInnerHTML={buildHtmlContainer(markdown.html)} />
    </article>
  )
  if (sidebar !== undefined) {
    return (
      <div className="mx-auto flex max-w-7xl gap-8 px-4 py-12">
        {sidebar}
        <div className="flex-1">{article}</div>
      </div>
    )
  }
  return article
}
