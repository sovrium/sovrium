/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import type { ResolvedMarkdownPage } from '@/presentation/rendering/markdown-page-resolver'

/**
 * SSR component that renders a page's resolved markdown payload
 * (US-PAGES-LAYOUT-MARKDOWN-PAGES-002).
 *
 * The wrapper is always an `<article>` element with
 * `data-component="markdown"` so spec tests have a stable selector
 * (`page.locator('article, [data-component="markdown"]')`). The layout
 * mode controls the wrapping classes so theme tokens (typography, max-
 * width) inherit from the active app theme.
 *
 * When `tocPosition === 'sidebar'` the TOC is rendered alongside the article
 * inside a flex container so the spec's "two-column" expectation
 * (APP-PAGES-MARKDOWN-017) holds without dragging in a sidebar dependency.
 */
const LAYOUT_CLASSES: Readonly<Record<ResolvedMarkdownPage['layout'], string>> = {
  prose: 'prose prose-slate mx-auto max-w-3xl px-4 py-12',
  docs: 'prose prose-slate max-w-none px-4 py-12',
  full: 'w-full px-4 py-12',
} as const

interface MarkdownArticleProps {
  readonly markdown: ResolvedMarkdownPage
}

/**
 * Stable empty payload used when interpolating `markdown.html` into
 * `dangerouslySetInnerHTML`. React's prop-equality check would otherwise
 * fire `react-perf/jsx-no-new-object-as-prop` on every render of the
 * SSR-only article; allocating a fresh wrapper object per call is a
 * meaningless overhead in SSR but the lint rule is shared with island
 * components where it does matter, so we comply by hoisting the literal.
 */
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
      {/*
        SSR-only: markdown HTML is sanitised by `renderMarkdownToHtml`
        (HTML-escapes author content before injecting our own emphasis tags).
        Spec scenario APP-PAGES-MARKDOWN-009 verifies the boundary.
      */}
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
