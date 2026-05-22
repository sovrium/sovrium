/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { DocsPrevNext } from '@/presentation/ui/pages/markdown/DocsPrevNext'
import { DocsSidebarNav } from '@/presentation/ui/pages/markdown/DocsSidebarNav'
import type { ResolvedMarkdownPage } from '@/presentation/rendering/markdown-page-resolver'

const ARTICLE_LAYOUT_CLASSES: Readonly<
  Record<Exclude<ResolvedMarkdownPage['layout'], 'none'>, string>
> = {
  prose: 'prose prose-slate mx-auto max-w-3xl px-4 py-12',
  docs: 'prose prose-slate max-w-none flex-1 px-4 py-12',
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

function renderRawMarkdown(markdown: ResolvedMarkdownPage): Readonly<ReactElement> {
  return (
    <div
      data-component="markdown"
      data-layout="none"
      dangerouslySetInnerHTML={buildHtmlContainer(markdown.html)}
    />
  )
}

function renderArticle(
  markdown: ResolvedMarkdownPage,
  inlineToc: Readonly<ReactElement> | undefined,
  layout: Exclude<ResolvedMarkdownPage['layout'], 'none'>
): Readonly<ReactElement> {
  const wrapperClass = ARTICLE_LAYOUT_CLASSES[layout]
  return (
    <article
      data-component="markdown"
      data-layout={layout}
      className={wrapperClass}
    >
      {inlineToc}
      {}
      <div dangerouslySetInnerHTML={buildHtmlContainer(markdown.html)} />
      {layout === 'docs' && markdown.collectionNav && (
        <DocsPrevNext
          previous={markdown.collectionNav.previous}
          next={markdown.collectionNav.next}
        />
      )}
    </article>
  )
}

function renderDocsLayout(
  markdown: ResolvedMarkdownPage,
  article: Readonly<ReactElement>,
  sidebar: Readonly<ReactElement> | undefined
): Readonly<ReactElement> {
  if (markdown.collectionNav === undefined) return article
  return (
    <div className="mx-auto flex max-w-7xl gap-8 px-4 py-12">
      <DocsSidebarNav nav={markdown.collectionNav} />
      <div className="flex-1">
        {sidebar}
        {article}
      </div>
    </div>
  )
}

export function MarkdownArticle({ markdown }: MarkdownArticleProps): Readonly<ReactElement> {
  if (markdown.layout === 'none') return renderRawMarkdown(markdown)
  const tocElement = renderToc(markdown)
  const sidebarToc = markdown.tocPosition === 'sidebar' ? tocElement : undefined
  const inlineToc = markdown.tocPosition === 'sidebar' ? undefined : tocElement
  const article = renderArticle(markdown, inlineToc, markdown.layout)
  if (markdown.layout === 'docs') {
    return renderDocsLayout(markdown, article, sidebarToc)
  }
  if (sidebarToc !== undefined) {
    return (
      <div className="mx-auto flex max-w-7xl gap-8 px-4 py-12">
        {sidebarToc}
        <div className="flex-1">{article}</div>
      </div>
    )
  }
  return article
}
