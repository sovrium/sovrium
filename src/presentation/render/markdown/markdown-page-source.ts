/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { stat } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import { splitFrontmatter } from '@/domain/kernel/markdown/markdown-renderer'
import { matchesContentDirFilter } from '@/domain/models/app/pages/content-dir-filter'
import { deriveContentDirSlugFromRouteParams } from '@/domain/models/app/pages/content-dir-slug'
import { getContentBaseDir } from '@/presentation/render/resolve/content-base-dir'
import type { Page } from '@/domain/models/app/pages'
import type { ContentDir } from '@/domain/models/app/pages/content-dir'
import type { Markdown } from '@/domain/models/app/pages/markdown'

/**
 * Where a markdown page's source comes from: an inline `markdown.content`, a
 * file under the project root, or the entry of a content directory the route
 * params select.
 */

/**
 * Read a markdown source from disk under the project root.
 *
 * Returns `undefined` on any I/O failure — callers gracefully degrade to an
 * empty article (the page must not 500 because a markdown file has gone
 * since the schema was authored). Mirrors `custom-html-resolver.readHtmlFile`.
 */
const readMarkdownFile = async (path: string): Promise<string | undefined> => {
  try {
    const absolutePath = isAbsolute(path) ? path : resolve(getContentBaseDir(), path)
    const file = Bun.file(absolutePath)
    if (!(await file.exists())) return undefined
    return await file.text()
  } catch {
    return undefined
  }
}

/**
 * `true` when the contentDir's backing directory exists on disk.
 *
 * Used to distinguish two missing-file cases that must NOT behave the same:
 *   - directory exists but the requested slug file is missing → the
 *     collection is real but this entry does not exist → a genuine 404.
 *   - directory itself is missing → the collection has not been provisioned
 *     yet (authoring a route before adding any content) → graceful-degrade
 *     to an empty article so the page does not 404/500.
 *
 * Resolved against the same content base-dir as `readMarkdownFile` so both
 * observe the `SOVRIUM_CONTENT_DIR` anchor. Returns `false` on any I/O error.
 */
const contentDirExists = async (directory: string): Promise<boolean> => {
  const absolutePath = isAbsolute(directory) ? directory : resolve(getContentBaseDir(), directory)
  return stat(absolutePath)
    .then((stats) => stats.isDirectory())
    .catch(() => false)
}

/**
 * Load the markdown source string for a page declaration. Inline `content`
 * wins over `file` per the schema's optional-pair shape (the cross-validator
 * may later make these mutually exclusive, but for
 * now `content` is preferred when both are set).
 *
 * `pageSourceFile` is the page-level `source.file` fallback used when
 * `markdown.content` and `markdown.file` are both absent (file-based
 * markdown). The page-level `source.file` is a
 * lower-priority source than `markdown.{content,file}` so authors can
 * override the default file source per page (or per environment) by setting
 * `markdown` properties without removing `source`.
 */
const loadMarkdownSource = async (
  markdown: Markdown,
  pageSourceFile: string | undefined
): Promise<string> => {
  if (typeof markdown.content === 'string') return markdown.content
  if (typeof markdown.file === 'string') {
    const fileContent = await readMarkdownFile(markdown.file)
    return fileContent ?? ''
  }
  if (typeof pageSourceFile === 'string') {
    const fileContent = await readMarkdownFile(pageSourceFile)
    return fileContent ?? ''
  }
  return ''
}

/**
 * `.md`-extension predicate used by the page-level `source.file` shortcut so
 * non-markdown source files (e.g. `.html` for `htmlSrc` integrations) do not
 * spuriously trigger the markdown article wrapper.
 */
const isMarkdownFile = (path: string): boolean => path.toLowerCase().endsWith('.md')

/**
 * Predicate identifying a contentDir page that has opted into a frontmatter
 * filter (`filter.draft: false`, etc). When `true`, the resolver enforces
 * "match-or-not-found" semantics — a missing file or filter mismatch returns
 * `undefined` so the route does not render an empty article (which would be
 * indistinguishable from a real published page in the spec assertions).
 *
 * When `false`, the resolver gracefully degrades to an empty article on
 * missing files so authoring a route declaration before adding the
 * corresponding `.md` file does not crash the page (mirrors the leniency of
 * `markdown.file` and `source.file`).
 */
const hasContentDirFilter = (contentDir: ContentDir): boolean =>
  contentDir.filter !== undefined && Object.keys(contentDir.filter).length > 0

/**
 * Outcome of the contentDir branch:
 *  - `'no-source'` — the page is not a contentDir page; the resolver falls
 *    through to the `markdown` / `source.file` paths.
 *  - `'not-found'` — the page IS a contentDir page but the requested slug
 *    genuinely does not exist within an EXISTING collection directory (or it
 *    was filtered out). The route must respond with a real HTTP 404 + a
 *    not-found page, not a stale empty 200 shell.
 *  - `'excluded'` — the slug could not be derived but the page should still
 *    render an (empty) shell rather than 404 (defensive; legacy leniency).
 *  - `'source'` — carries the loaded markdown body to feed into
 *    `renderMarkdownToHtml`. An empty `body` here is the graceful-degrade case
 *    for a route declared before its backing directory exists.
 */
export type ContentDirOutcome =
  | { readonly kind: 'no-source' }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'excluded' }
  | { readonly kind: 'source'; readonly body: string }

/**
 * Build the markdown source string for a `contentDir` page. See
 * {@link ContentDirOutcome} for the meaning of each returned kind.
 */
export const loadContentDirSource = async (
  page: Page,
  routeParams: Readonly<Record<string, string>>
): Promise<ContentDirOutcome> => {
  const { contentDir } = page
  if (contentDir === undefined) return { kind: 'no-source' }

  const slug = deriveContentDirSlugFromRouteParams(contentDir, routeParams)
  const filterActive = hasContentDirFilter(contentDir)

  if (slug === undefined) {
    return filterActive ? { kind: 'excluded' } : { kind: 'source', body: '' }
  }

  const directory = contentDir.directory.replace(/\/+$/, '')
  const filePath = `${directory}/${slug}.md`
  const fileContent = await readMarkdownFile(filePath)

  if (fileContent === undefined) {
    // File missing. Three distinct cases:
    //  - A `filter` is in play → the page is intentionally restrictive, so a
    //    missing file is a genuine not-found (real 404).
    //  - No filter, but the backing directory EXISTS → the collection is real
    //    and this slug genuinely does not exist → a real 404.
    //  - No filter and the directory is ALSO missing → the collection has not
    //    been provisioned yet (route declared before content added) →
    //    graceful-degrade to an empty article.
    if (filterActive) return { kind: 'not-found' }
    return (await contentDirExists(directory))
      ? { kind: 'not-found' }
      : { kind: 'source', body: '' }
  }

  if (filterActive) {
    // Inspect frontmatter only: a full markdown-it render here would
    // tokenise + Shiki-prep the entire file just to discard it on a filter
    // mismatch. `splitFrontmatter` is the pure, allocation-cheap path. A
    // filtered-out entry is a genuine not-found (the slug is hidden).
    const { frontmatter } = splitFrontmatter(fileContent)
    if (!matchesContentDirFilter(contentDir.filter, frontmatter)) {
      return { kind: 'not-found' }
    }
  }

  return { kind: 'source', body: fileContent }
}

/**
 * Resolve the markdown payload for a page, or `undefined` if the page does
 * not declare a markdown source. The result is consumed by `DynamicPage`
 * (via `renderPageHtml`) as the article body.
 *
 * Three trigger paths exist:
 *   - `page.markdown` is the canonical "markdown page mode" hook
 *     — inline content, file-based
 *     content, layout, and TOC all live here.
 *   - `page.source.file` (for `.md` files) is a lighter-weight shortcut
 *     used by file-based-markdown
 *     specs that just want to render an article from a markdown file
 *     without nesting under `markdown.`. Defaults to the `prose` layout.
 *   - `page.contentDir` declares a
 *     directory whose markdown files generate one route each. The slug
 *     extracted from `routeParams` selects the file under
 *     `${contentDir.directory}/`. Filter mismatches (e.g.
 *     `filter.draft: false` against a draft frontmatter) return undefined
 *     so the route does not render a stale `<article>` shell.
 *
 * When `markdown` and `contentDir` are both set, `markdown.layout` / `toc`
 * still apply but the source body comes from the contentDir file (so the
 * authoring shape `contentDir + markdown: { layout: 'docs' }` is the
 * recommended pattern for documentation directories).
 */
/**
 * Page-level `source.file` shortcut: returns the path only when it points at
 * a `.md` file so non-markdown source files (e.g. `.html` for `htmlSrc`
 * integrations) do not spuriously trigger the markdown article wrapper.
 */
export const derivePageSourceFile = (page: Page): string | undefined =>
  typeof page.source?.file === 'string' && isMarkdownFile(page.source.file)
    ? page.source.file
    : undefined

/**
 * Pick the markdown source body to feed into the renderer based on the
 * trigger path. `contentDir` (when it produced a body) wins because the
 * collection slug is the most-specific signal — `markdown.layout`/`toc`
 * still apply via `markdown` so authors can pair `contentDir` with
 * `markdown: { layout: 'docs' }`.
 */
export const pickMarkdownSource = async (
  contentDirOutcome: ContentDirOutcome,
  markdown: Markdown,
  pageSourceFile: string | undefined
): Promise<string> => {
  if (contentDirOutcome.kind === 'source') return contentDirOutcome.body
  return loadMarkdownSource(markdown, pageSourceFile)
}
