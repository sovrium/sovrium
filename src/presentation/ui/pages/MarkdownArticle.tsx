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
  COPY_MARKDOWN_SCRIPT_HTML,
  DOCS_PROSE_PATCH_HTML,
  TOC_SCROLLSPY_SCRIPT_HTML,
  TOC_SCROLLSPY_STYLE_HTML,
} from '@/presentation/ui/pages/markdown/MarkdownArticleEnhancements'
import type { ResolvedMarkdownPage } from '@/presentation/rendering/markdown-page-resolver'

/**
 * SSR component that renders a page's resolved markdown payload
 *.
 *
 * Layout modes:
 *   - `'prose'` (default): single-column article with prose typography.
 *   - `'docs'`: three-column layout (collection sidebar + article + right-rail
 *     TOC) backed by `collectionNav` from `contentDir.nav.enabled: true`;
 *     prev/next chrome renders at the foot of the article (cluster 5).
 *   - `'full'`: full-width article without prose constraints.
 *   - `'none'`: raw markdown HTML with no article wrapper or prose styling —
 *     emits only `<div data-component="markdown" data-layout="none">` so
 *     authors can embed the rendered HTML in custom chrome (cluster 5).
 *
 * The wrapper carries `data-component="markdown"` so spec tests have a
 * stable selector (`page.locator('article, [data-component="markdown"]')`).
 */
const ARTICLE_LAYOUT_CLASSES: Readonly<
  Record<Exclude<ResolvedMarkdownPage['layout'], 'none'>, string>
> = {
  prose: 'mx-auto max-w-3xl px-4 py-12',
  // `min-w-0` lets the article shrink inside the flex row so long code blocks
  // and wide tables scroll within the column instead of overflowing it.
  // `prose` mints the markdown typography from the `@tailwindcss/typography`
  // plugin (wired into the CSS compiler); `dark:prose-invert` activates the
  // inverted (light-on-dark) ramp only under the `.dark` scheme. The docs
  // markdown layout now follows the active light/dark scheme (a `theme-toggle`
  // / `theme.colorScheme` sets a reliable `.dark` class on `<html>`), so prose
  // is light in light mode and inverted in dark mode. `max-w-none` lets the
  // article fill the 3-column layout's center column instead of prose's 65ch cap.
  docs: 'prose dark:prose-invert max-w-none min-w-0 flex-1 px-8 py-12',
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
          ? // top-[6.5rem] clears the two-row docs header (104px, measured live);
            // see NAV_WRAPPER_CLASS in DocsSidebarNav for the same Phase-1 coupling.
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

/**
 * The docs-header AI-native affordances: a
 * client-side "Copy as Markdown" button and the no-JS "View as Markdown"
 * fallback link, both pointing at the article's per-page `.md` twin. Split out
 * of `renderDocsArticleHeader` to keep that renderer under its line cap. The
 * button's accessible name is deliberately distinct from the per-code-block
 * "Copy code" buttons so the two never collide.
 *
 * The "Edit this page" affordance is NOT here — for the docs layout the edit link
 * lives EXCLUSIVELY in the contribution footer (`DocsContributionFooter`, A2),
 * beside "Report an issue" + the contribution note, so the header stays a clean
 * Copy/View pair.
 */
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

/**
 * Render the docs-article header: a Home → section → page breadcrumb (for
 * orientation across the many sections), plus a compact pair of AI-native
 * affordances:
 *   1. a "Copy as Markdown" button — client-side, copies THIS article's raw
 *      markdown (its per-page `.md` twin) to the clipboard; and
 *   2. a "View as Markdown" link — repointed from the whole-site
 *      `/llms-full.txt` to the article's own per-page `.md` (the no-JS
 *      graceful-degrade fallback: the link always works without the copy
 *      script).
 * Both reuse the same per-page raw-markdown source. Returns undefined
 * when there is no collection nav (e.g. a non-`docs` layout) so the header only
 * appears in the docs three-column layout.
 *
 * The breadcrumb is a `<nav aria-label="Breadcrumb">` containing an ordered
 * list — it is NOT a heading, and the copy control is a `<button>`, so the
 * single-`<h1>` document-outline invariant is
 * preserved. The button's accessible name (`Copy as Markdown`) is deliberately
 * distinct from the per-code-block "Copy code" buttons so the two never collide.
 */
const renderDocsArticleHeader = (
  markdown: ResolvedMarkdownPage,
  labels: DocsChromeLabels
): Readonly<ReactElement> | undefined => {
  const nav = markdown.collectionNav
  if (nav === undefined) return undefined
  const current = nav.sidebar.find((entry) => entry.isCurrent)
  if (current === undefined) return undefined

  // This article's per-page `.md` twin. Both affordances point here.
  const markdownHref = `${current.href}.md`

  // Mobile (<sm): stack the breadcrumb above the affordance cluster so a third
  // affordance ("Edit this page") does not crowd the ≤375px breadcrumb; from
  // `sm:` up it returns to the single-row justified layout.
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

/**
 * Render the `'none'` layout: the markdown HTML is emitted inside a
 * `<div data-component="markdown" data-layout="none">` container with no
 * `<article>` wrapper and no prose typography classes (cluster 5).
 */
function renderRawMarkdown(markdown: ResolvedMarkdownPage): Readonly<ReactElement> {
  return (
    <div
      data-component="markdown"
      data-layout="none"
      dangerouslySetInnerHTML={buildHtmlContainer(markdown.html)}
    />
  )
}

/**
 * Render the markdown article body (used by every layout other than
 * `'none'`). The container is always `<article data-component="markdown">`
 * so the spec selector stays stable.
 */
function renderArticle(
  markdown: ResolvedMarkdownPage,
  inlineToc: Readonly<ReactElement> | undefined,
  layout: Exclude<ResolvedMarkdownPage['layout'], 'none'>,
  labels: DocsChromeLabels
): Readonly<ReactElement> {
  const wrapperClass = ARTICLE_LAYOUT_CLASSES[layout]
  // Breadcrumb + "View as Markdown" header only in the docs three-column layout
  // (it reads from collectionNav, which only the docs layout provides).
  const docsHeader = layout === 'docs' ? renderDocsArticleHeader(markdown, labels) : undefined
  return (
    <article
      data-component="markdown"
      data-layout={layout}
      className={wrapperClass}
    >
      {inlineToc}
      {docsHeader}
      {/*
        SSR-only: markdown HTML is sanitised by `renderMarkdownToHtml`
        (HTML-escapes author content before injecting our own emphasis tags).
        Spec scenario [internal ref] verifies the boundary.
      */}
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

/**
 * Render the `'docs'` three-column layout: a left collection sidebar, the
 * article body, and the right-rail table of contents (cluster 5 + the
 * sidebar-TOC position). When `collectionNav` is absent — eg. an author
 * picked `layout: 'docs'` but did not set `contentDir.nav.enabled` — we
 * gracefully degrade to the single-column article so the layout name still
 * "works" rather than throwing.
 */
function renderDocsLayout(
  markdown: ResolvedMarkdownPage,
  article: Readonly<ReactElement>,
  toc: Readonly<ReactElement> | undefined
): Readonly<ReactElement> {
  if (markdown.collectionNav === undefined) return article
  // 3-column docs shell: left collection nav | article (min-w-0) | right TOC.
  // The wrapper binds the mode-aware `bg-background` role token so the article
  // area follows the active light/dark scheme (a `theme-toggle` / `colorScheme`
  // can flip it), matching the navbar/landing chrome instead of a hard dark ramp.
  return (
    // min-h subtracts the two-row docs header (6.5rem/104px, measured live) so a
    // short article still fills the viewport below the sticky header.
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

/**
 * Render the layout body for a resolved markdown page (every branch other than
 * the code-copy enhancement, which is appended by the wrapper below).
 */
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
  // Resolve the per-locale docs-chrome labels ONCE from the active language and
  // thread them down through every chrome renderer.
  const labels = getDocsChromeLabels(markdown.lang)
  const body = renderMarkdownBody(markdown, labels)
  // NOTE: there is deliberately no code-copy enhancement here. Every fence is
  // now server-rendered inside a `<figure data-code-frame>` whose header carries
  // an SSR copy button (`markdown-code-frames.ts`), wired to the same delegated
  // `copyCodeScript` the config `code` component uses. The old client-side
  // script that walked `pre.shiki` and APPENDED a button was deleted with that
  // change: left in place it would append a SECOND identical control to every
  // fence, giving docs readers two adjacent buttons and a screen-reader user
  // "Copy, Copy".
  //
  // Emit the TOC scroll-spy only when a TOC is actually rendered (the right-rail
  // / inline "On this page" list has links to track).
  const hasToc = markdown.tocHeadings !== undefined && markdown.tocHeadings.length > 0
  // The Copy-as-Markdown control lives in the docs-layout article header (which
  // only renders when the collection nav is present, [internal ref]).
  const hasDocsHeader = markdown.layout === 'docs' && markdown.collectionNav !== undefined
  if (!hasToc && !hasDocsHeader) return body
  return (
    <>
      {body}
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
