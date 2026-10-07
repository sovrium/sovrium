/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { cn } from '@/presentation/design/class-merge'
import { DocsArticleBreadcrumb } from './docs-article-breadcrumb'
import { DOCS_CONTENT_MEASURE_CLASSES } from './docs-frame'
import type { DocsChromeLabels } from './docs-chrome-labels'
import type { ResolvedMarkdownPage } from './markdown-page-resolver'
import type { ReactElement } from 'react'

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
  labels: DocsChromeLabels,
  parts: ResolvedMarkdownPage['parts']
): Readonly<ReactElement> => {
  const affordanceClass =
    'text-foreground-subtle hover:text-foreground inline-flex items-center gap-1.5 no-underline transition-colors duration-150'
  return (
    <div className={cn('flex shrink-0 items-center gap-3 text-sm', parts?.['articleActions'])}>
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
        className={cn(affordanceClass, parts?.['articleLinks'])}
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
export const renderDocsArticleHeader = (
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
      className={cn(
        'mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between',
        DOCS_CONTENT_MEASURE_CLASSES,
        markdown.parts?.['articleHeader']
      )}
    >
      <DocsArticleBreadcrumb
        current={current}
        rootCrumb={markdown.docsRootCrumb}
        homeLabel={labels.home}
      />
      {markdown.frame?.articleActions !== false &&
        renderDocsMarkdownAffordances(markdownHref, labels, markdown.parts)}
    </div>
  )
}
