/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { DocsArticleBreadcrumb } from '@/presentation/ui/pages/markdown/DocsArticleBreadcrumb'
import {
  getDocsChromeLabels,
  type DocsChromeLabels,
} from '@/presentation/ui/pages/markdown/DocsChromeLabels'
import { DocsContributionFooter } from '@/presentation/ui/pages/markdown/DocsContributionFooter'
import { DocsPrevNext } from '@/presentation/ui/pages/markdown/DocsPrevNext'
import { DocsSidebarNav } from '@/presentation/ui/pages/markdown/DocsSidebarNav'
import {
  CODE_COPY_SCRIPT_HTML,
  CODE_COPY_STYLE_HTML,
  COPY_MARKDOWN_SCRIPT_HTML,
  DOCS_PROSE_PATCH_HTML,
  TOC_SCROLLSPY_SCRIPT_HTML,
  TOC_SCROLLSPY_STYLE_HTML,
} from '@/presentation/ui/pages/markdown/MarkdownArticleEnhancements'
import type { ResolvedMarkdownPage } from '@/presentation/rendering/markdown-page-resolver'

const ARTICLE_LAYOUT_CLASSES: Readonly<
  Record<Exclude<ResolvedMarkdownPage['layout'], 'none'>, string>
> = {
  prose: 'mx-auto max-w-3xl px-4 py-12',
  docs: 'prose dark:prose-invert max-w-none min-w-0 flex-1 px-8 py-12',
  full: 'w-full px-4 py-12',
} as const

interface MarkdownArticleProps {
  readonly markdown: ResolvedMarkdownPage
}

const buildHtmlContainer = (html: string): { readonly __html: string } => ({ __html: html })

const tocIndentClass = (level: number): string => {
  if (level <= 2) return ''
  if (level === 3) return 'pl-3'
  return 'pl-6'
}

const renderToc = (
  markdown: ResolvedMarkdownPage,
  labels: DocsChromeLabels
): Readonly<ReactElement> | undefined => {
  if (markdown.tocHeadings === undefined || markdown.tocHeadings.length === 0) return undefined
  const sidebar = markdown.tocPosition === 'sidebar'
  return (
    <nav
      data-component="markdown-toc"
      data-position={markdown.tocPosition ?? 'top'}
      aria-label="Table of contents"
      className={
        sidebar
          ?
            'sticky top-[6.5rem] hidden max-h-[calc(100dvh-6.5rem)] w-56 shrink-0 self-start overflow-y-auto py-12 pr-4 text-sm xl:block'
          : 'mb-6 text-sm'
      }
    >
      <p className="text-foreground-subtle mb-3 text-xs font-semibold tracking-wide uppercase">
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
              className="sv-toc-link hover:border-warmth-border text-foreground-muted hover:text-foreground -ml-px block border-l border-transparent pl-3 transition-colors duration-150"
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}

const renderDocsMarkdownAffordances = (
  markdownHref: string,
  labels: DocsChromeLabels
): Readonly<ReactElement> => {
  const affordanceClass =
    'text-foreground-subtle hover:text-foreground inline-flex items-center gap-1.5 no-underline transition-colors duration-150'
  return (
    <div className="flex shrink-0 items-center gap-3 text-xs">
      <button
        type="button"
        data-copy-markdown
        data-copy-markdown-url={markdownHref}
        aria-label={labels.copyAsMarkdown}
        className={affordanceClass}
      >
        {labels.copyAsMarkdown}
      </button>
      <a
        href={markdownHref}
        className={affordanceClass}
        aria-label={labels.viewAsMarkdown}
      >
        {labels.viewAsMarkdown}
      </a>
    </div>
  )
}

const renderDocsArticleHeader = (
  markdown: ResolvedMarkdownPage,
  labels: DocsChromeLabels
): Readonly<ReactElement> | undefined => {
  const nav = markdown.collectionNav
  if (nav === undefined) return undefined
  const current = nav.sidebar.find((entry) => entry.isCurrent)
  if (current === undefined) return undefined

  const markdownHref = `${current.href}.md`

  return (
    <div
      data-component="docs-article-header"
      className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
    >
      <DocsArticleBreadcrumb
        current={current}
        rootCrumb={markdown.docsRootCrumb}
        homeLabel={labels.home}
      />
      {renderDocsMarkdownAffordances(markdownHref, labels)}
    </div>
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
  layout: Exclude<ResolvedMarkdownPage['layout'], 'none'>,
  labels: DocsChromeLabels
): Readonly<ReactElement> {
  const wrapperClass = ARTICLE_LAYOUT_CLASSES[layout]
  const docsHeader = layout === 'docs' ? renderDocsArticleHeader(markdown, labels) : undefined
  return (
    <article
      data-component="markdown"
      data-layout={layout}
      className={wrapperClass}
    >
      {inlineToc}
      {docsHeader}
      {}
      <div dangerouslySetInnerHTML={buildHtmlContainer(markdown.html)} />
      {layout === 'docs' && markdown.lastUpdated !== undefined && (
        <p
          data-component="docs-last-updated"
          className="text-foreground-subtle mt-10 text-xs"
        >
          {labels.lastUpdated} {markdown.lastUpdated}
        </p>
      )}
      {layout === 'docs' && markdown.collectionNav && (
        <DocsPrevNext
          previous={markdown.collectionNav.previous}
          next={markdown.collectionNav.next}
          previousLabel={labels.previous}
          nextLabel={labels.next}
        />
      )}
      {layout === 'docs' && (
        <DocsContributionFooter
          editUrl={markdown.editUrl}
          issueUrl={markdown.issueUrl}
          contributionNote={markdown.contributionNote}
          labels={labels}
        />
      )}
    </article>
  )
}

function renderDocsLayout(
  markdown: ResolvedMarkdownPage,
  article: Readonly<ReactElement>,
  toc: Readonly<ReactElement> | undefined
): Readonly<ReactElement> {
  if (markdown.collectionNav === undefined) return article
  return (
    <div className="bg-background min-h-[calc(100dvh-6.5rem)]">
      <style dangerouslySetInnerHTML={DOCS_PROSE_PATCH_HTML} />
      <div className="mx-auto flex w-full max-w-7xl items-start gap-4 px-4 lg:gap-8 lg:px-6">
        <DocsSidebarNav nav={markdown.collectionNav} />
        {article}
        {toc}
      </div>
    </div>
  )
}

function renderMarkdownBody(
  markdown: ResolvedMarkdownPage,
  labels: DocsChromeLabels
): Readonly<ReactElement> {
  const tocElement = renderToc(markdown, labels)
  const sidebarToc = markdown.tocPosition === 'sidebar' ? tocElement : undefined
  const inlineToc = markdown.tocPosition === 'sidebar' ? undefined : tocElement
  const article = renderArticle(
    markdown,
    inlineToc,
    markdown.layout as 'prose' | 'docs' | 'full',
    labels
  )
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

export function MarkdownArticle({ markdown }: MarkdownArticleProps): Readonly<ReactElement> {
  if (markdown.layout === 'none') return renderRawMarkdown(markdown)
  const labels = getDocsChromeLabels(markdown.lang)
  const body = renderMarkdownBody(markdown, labels)
  const hasCode = markdown.html.includes('class="shiki')
  const hasToc = markdown.tocHeadings !== undefined && markdown.tocHeadings.length > 0
  const hasDocsHeader = markdown.layout === 'docs' && markdown.collectionNav !== undefined
  if (!hasCode && !hasToc && !hasDocsHeader) return body
  return (
    <>
      {body}
      {hasCode && (
        <>
          <style dangerouslySetInnerHTML={CODE_COPY_STYLE_HTML} />
          <script dangerouslySetInnerHTML={CODE_COPY_SCRIPT_HTML} />
        </>
      )}
      {hasToc && (
        <>
          <style dangerouslySetInnerHTML={TOC_SCROLLSPY_STYLE_HTML} />
          <script dangerouslySetInnerHTML={TOC_SCROLLSPY_SCRIPT_HTML} />
        </>
      )}
      {hasDocsHeader && <script dangerouslySetInnerHTML={COPY_MARKDOWN_SCRIPT_HTML} />}
    </>
  )
}
