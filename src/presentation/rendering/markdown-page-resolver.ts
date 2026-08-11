/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { stat } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import {
  filterTocHeadings,
  splitFrontmatter,
  type MarkdownHeading,
  type RenderedMarkdown,
} from '@/domain/services/markdown/markdown-renderer'
import { buildContentDirEditUrl } from '@/domain/utils/content-dir/content-dir-edit-url'
import { matchesContentDirFilter } from '@/domain/utils/content-dir/content-dir-filter'
import { type ContentDirSeoMeta } from '@/domain/utils/content-dir/content-dir-seo-meta'
import { deriveContentDirSlugFromRouteParams } from '@/domain/utils/content-dir/content-dir-slug'
import { sanitizeRichTextHTML } from '@/domain/utils/html-sanitization'
import { renderMarkdownToHtml } from '@/infrastructure/markdown/markdown-it-renderer'
import { highlightCodeBlocks } from '@/infrastructure/markdown/shiki-highlighter'
import { getContentBaseDir } from '@/presentation/rendering/content-base-dir'
import { listContentDir, type CollectionNavData } from '@/presentation/rendering/content-dir-lister'
import { buildContentDirSeo } from '@/presentation/rendering/content-dir-structured-data-synthesis'
import { spliceMarkdownCodeFrames } from '@/presentation/rendering/markdown-code-frames'
import { spliceMarkdownDirectives } from '@/presentation/rendering/markdown-directives'
import { resolveMarkdownTranslations } from '@/presentation/rendering/markdown-i18n'
import {
  resolveDocsRootCrumb,
  type DocsRootCrumb,
} from '@/presentation/ui/pages/markdown/DocsRootCrumb'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'
import type { ContentDir } from '@/domain/models/app/pages/content-dir'
import type { Markdown } from '@/domain/models/app/pages/markdown'

/**
 * Pre-render resolver for `page.markdown`.
 *
 * Loads the markdown source either from `markdown.content` (inline) or from
 * `markdown.file` (filesystem, relative to the project root) and renders it
 * to HTML. Returns `undefined` for pages that do not declare `markdown`.
 *
 * Why this is async and lives in the presentation layer (not the domain
 * layer): file I/O is a side effect, and the pure renderer in
 * `domain/services/markdown-renderer.ts` is intentionally I/O-free. The
 * resolver mirrors `custom-html-resolver.ts`'s pattern: it reads the file
 * with `Bun.file()` and gracefully degrades on missing files (we render an
 * empty article rather than 500-ing the page, matching the leniency of the
 * `htmlSrc` pipeline).
 *
 * The resolver does NOT mutate the page; it returns a freshly rendered
 * payload that the renderer hands to `DynamicPage` as a separate prop.
 */

/**
 * Resolved markdown payload attached to a page that declared `markdown`.
 *
 * `tocHeadings` is intentionally pre-filtered so the SSR renderer is
 * presentational only — it does not need to know about `toc.maxDepth`.
 */
export interface ResolvedMarkdownPage {
  /** Rendered HTML body (escaped + emphasis tags) ready for `dangerouslySetInnerHTML`. */
  readonly html: string
  /** Layout mode chosen by the schema (defaults to `'prose'`). */
  readonly layout: 'prose' | 'docs' | 'full' | 'none'
  /** TOC headings if `markdown.toc` is enabled, otherwise undefined. */
  readonly tocHeadings?: readonly MarkdownHeading[]
  /** TOC position when TOC is enabled. Defaults to `'top'`. */
  readonly tocPosition?: 'top' | 'sidebar'
  /** Frontmatter scalars exposed for `$frontmatter.*` resolution. */
  readonly frontmatter: Readonly<Record<string, string>>
  /**
   * Collection navigation derived from `contentDir.nav`. Populated only when the page declares
   * `contentDir.nav.enabled: true`; consumed by `DocsSidebarNav` to render
   * the docs-layout sidebar.
   */
  readonly collectionNav?: CollectionNavData
  /**
   * SEO `<head>` meta synthesised for a `contentDir` page: canonical link, per-locale hreflang alternates, and
   * Open Graph values derived from the file's frontmatter. Populated ONLY for
   * contentDir-resolved pages — declared pages author their SEO meta in
   * `page.meta` directly, so this stays `undefined` for them.
   */
  readonly seo?: ContentDirSeoMeta
  /**
   * Human "Last updated" stamp for a `docs`-layout article. Source precedence (no-maintenance, honest): an explicit
   * `updated` (or `date`) frontmatter field WINS; otherwise it falls back to the
   * content file's modification time read at serve time. Populated only for the
   * `docs` layout (the renderer stamps it at the article foot); `undefined`
   * otherwise or when no date can be resolved.
   */
  readonly lastUpdated?: string
  /**
   * "Edit this page" href for a `docs`-layout article. Populated ONLY when the page's `contentDir.editUrl` template is
   * set AND the article slug resolves; the template's `{slug}` / `{path}` /
   * `{lang}` placeholders are interpolated here (the resolver holds the derived
   * slug and the active `currentLang`). `undefined` ⇒ no "Edit this page" link
   * renders (opt-in per collection, default off).
   */
  readonly editUrl?: string
  /**
   * "Report an issue" href for a `docs`-layout article's contribution footer (A2).
   * Populated when the page's `contentDir.issueUrl` template is set AND the slug
   * resolves; interpolated by the SAME `buildContentDirEditUrl` helper as
   * {@link editUrl}, but its `{slug}` / `{path}` / `{lang}` placeholders are
   * OPTIONAL (a bare tracker URL passes through verbatim). `undefined` ⇒ no issue
   * link (opt-in per collection, default off).
   */
  readonly issueUrl?: string
  /**
   * Raw per-locale contribution note for the `docs`-layout contribution footer
   * (A2), taken verbatim from `contentDir.contributionNote` (NOT interpolated).
   * `undefined` ⇒ no note rendered (opt-in per collection, default off).
   */
  readonly contributionNote?: string
  /**
   * Docs-article breadcrumb ROOT crumb for a ZONED Sovrium-docs collection (A1):
   * the active zone tab (name + landing href), resolved from the collection nav.
   * `undefined` for non-zoned / generic docs (the breadcrumb then falls back to
   * the historical "Home" root). Consumed by `DocsArticleBreadcrumb` and threaded
   * into the synthesised BreadcrumbList JSON-LD.
   */
  readonly docsRootCrumb?: DocsRootCrumb
  /**
   * Active request language, taken from the
   * resolver's `currentLang` (the `/:lang/` prefix). Drives the per-locale docs-
   * chrome labels; `undefined` ⇒ the label getter falls back to English.
   */
  readonly lang?: string
}

const DEFAULT_LAYOUT = 'prose' as const
const DEFAULT_TOC_MAX_DEPTH = 3
const DEFAULT_TOC_POSITION = 'top' as const

/**
 * Read a markdown source from disk under the project root.
 *
 * Returns `undefined` on any I/O failure — callers gracefully degrade to an
 * empty article (the page must not 500 because a markdown file was deleted
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
 * Used to distinguish two missing-file cases that must NOT behave the same
 * ([internal ref] vs [internal ref]):
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
 * may later make these mutually exclusive — [internal ref] — but for
 * now `content` is preferred when both are set).
 *
 * `pageSourceFile` is the page-level `source.file` fallback used when
 * `markdown.content` and `markdown.file` are both absent ([internal ref] file-based markdown). The page-level `source.file` is a
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
 * Build the TOC payload from a rendered markdown's headings, honouring the
 * schema's `toc.maxDepth` and `toc.position` knobs. Returns `undefined` when
 * the page did not opt into a TOC at all so the renderer can skip the slot.
 */
const buildToc = (
  rendered: RenderedMarkdown,
  toc: Markdown['toc']
): { headings: readonly MarkdownHeading[]; position: 'top' | 'sidebar' } | undefined => {
  if (toc === undefined) return undefined
  const maxDepth = toc.maxDepth ?? DEFAULT_TOC_MAX_DEPTH
  const position = toc.position ?? DEFAULT_TOC_POSITION
  return { headings: filterTocHeadings(rendered.headings, maxDepth), position }
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
 * not-found page, not a stale empty 200 shell.
 *  - `'excluded'` — the slug could not be derived but the page should still
 *    render an (empty) shell rather than 404 (defensive; legacy leniency).
 *  - `'source'` — carries the loaded markdown body to feed into
 *    `renderMarkdownToHtml`. An empty `body` here is the graceful-degrade case
 *    for a route declared before its backing directory exists
 *.
 */
type ContentDirOutcome =
  | { readonly kind: 'no-source' }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'excluded' }
  | { readonly kind: 'source'; readonly body: string }

/**
 * Build the markdown source string for a `contentDir` page. See
 * {@link ContentDirOutcome} for the meaning of each returned kind.
 */
const loadContentDirSource = async (
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
    // File missing. Three distinct cases ([internal ref] vs
    // -020/-029):
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
 * — inline content, file-based
 *     content, layout, and TOC all live here.
 *   - `page.source.file` (for `.md` files) is a lighter-weight shortcut
 * used by file-based-markdown
 *     specs that just want to render an article from a markdown file
 *     without nesting under `markdown.`. Defaults to the `prose` layout.
 * - `page.contentDir` declares a
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
const derivePageSourceFile = (page: Page): string | undefined =>
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
const pickMarkdownSource = async (
  contentDirOutcome: ContentDirOutcome,
  markdown: Markdown,
  pageSourceFile: string | undefined
): Promise<string> => {
  if (contentDirOutcome.kind === 'source') return contentDirOutcome.body
  return loadMarkdownSource(markdown, pageSourceFile)
}

/**
 * `true` when none of the three trigger paths apply: the page does not
 * declare `markdown`, `source.file` (.md), or `contentDir`. The resolver
 * returns `undefined` so callers fall through to the standard page
 * rendering pipeline.
 */
const hasNoMarkdownTrigger = (
  contentDirOutcome: ContentDirOutcome,
  page: Page,
  pageSourceFile: string | undefined
): boolean =>
  contentDirOutcome.kind === 'no-source' && !page.markdown && pageSourceFile === undefined

/**
 * Compose the final HTML from a `RenderedMarkdown` payload by walking the
 * full presentation-layer pipeline:
 *
 *   1. Splice Shiki-highlighted markup into `<pre><code data-md-code="N">`
 *      placeholders (cluster 2 — class-based, no inline `style`).
 *   2. Sanitise the whole composed HTML via the canonical
 *      `sanitizeRichTextHTML` (security rule S2 — one sanitiser, no widening).
 *   3. Splice directive component HTML (alert, button, icon shell, code-block
 *      chrome) into the `<div class="md-directive md-directive-N">`
 *      placeholders the domain renderer emitted (cluster 3). Runs AFTER the
 *      sanitiser so the component chrome's `role`/`data-component`/`<button>`/
 *      `<svg>` survives — placeholders are sanitiser-safe (only `class`,
 *      which the allowlist keeps), so they pass through step 2 untouched.
 *      See `markdown-directives.ts` module header for the boundary rationale.
 *   4. Wrap every fence in the shared code-block frame — a header naming the
 *      block plus a server-rendered copy button — so a docs fence and a config
 *      `code` component are the same artifact in the markup, not merely to the
 *      eye. Post-sanitiser for the same reason as step 3, and AFTER step 3
 *      because directive placeholders are matched non-greedily to their first
 *      `</div>`.
 */
const composeMarkdownHtml = async (
  rendered: ReturnType<typeof renderMarkdownToHtml>,
  app: App | undefined
): Promise<string> => {
  const codeBlockTheme = app?.theme?.codeBlock?.theme
  const highlightedHtml = await highlightCodeBlocks(
    rendered.html,
    rendered.codeBlocks,
    codeBlockTheme
  )
  const sanitizedHtml = sanitizeRichTextHTML(highlightedHtml)
  const withDirectives = spliceMarkdownDirectives(sanitizedHtml, rendered.directives, app?.theme)
  return spliceMarkdownCodeFrames(withDirectives, rendered.codeBlocks)
}

/**
 * Inline `$t:key` substitution runs
 * BEFORE block parsing so tokens nested in emphasis / list items / etc.
 * resolve correctly. Frontmatter is captured from the RAW source by the
 * domain renderer downstream — the substitution intentionally targets the
 * body. When `currentLang` is unset (URL has no `/:lang/` prefix), fall
 * back to `app.languages.default` so plain `/docs` still localises.
 */
const localiseMarkdownSource = (
  source: string,
  app: App | undefined,
  currentLang: string | undefined
): string =>
  resolveMarkdownTranslations(source, currentLang ?? app?.languages?.default, app?.languages)

/**
 * Build the collection-nav payload for `contentDir.nav.enabled: true` pages.
 * Returns `undefined` when navigation is not requested (so the resolver does
 * not allocate empty sidebar data for plain `contentDir` blog routes).
 */
const buildCollectionNav = async (
  page: Page,
  routeParams: Readonly<Record<string, string>>
): Promise<CollectionNavData | undefined> => {
  const { contentDir } = page
  if (contentDir === undefined) return undefined
  if (contentDir.nav?.enabled !== true) return undefined
  const currentSlug = deriveContentDirSlugFromRouteParams(contentDir, routeParams)
  return listContentDir(contentDir, page.path, currentSlug)
}

/**
 * Format a date (ISO string or `Date`) as a human long-form stamp localized to
 * `lang` (e.g. `July 11, 2026` for `en`, `11 juillet 2026` for `fr`) using UTC
 * so the rendered value is deterministic across server timezones. Defaults to
 * English when no locale is active, and falls back to English on a malformed
 * locale tag (a `RangeError` from `Intl.DateTimeFormat`). Returns `undefined`
 * for an unparseable input.
 */
const formatHumanDate = (input: string | Date, lang?: string): string | undefined => {
  const date = typeof input === 'string' ? new Date(input) : input
  if (Number.isNaN(date.getTime())) return undefined
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }
  try {
    return new Intl.DateTimeFormat(lang ?? 'en', options).format(date)
  } catch {
    // Malformed locale tag (RangeError) — fall back to the default English form.
    return new Intl.DateTimeFormat('en', options).format(date)
  }
}

/**
 * Read the modification time of a content file, resolved against the same
 * content base-dir anchor as {@link readMarkdownFile}. Returns `undefined` on
 * any I/O failure (the last-updated stamp then simply does not render).
 */
const statMtime = async (path: string): Promise<Date | undefined> => {
  try {
    const absolutePath = isAbsolute(path) ? path : resolve(getContentBaseDir(), path)
    const stats = await stat(absolutePath)
    return stats.mtime
  } catch {
    return undefined
  }
}

/**
 * Resolve the on-disk content-file path for the last-updated mtime fallback.
 * Mirrors the source-selection order the resolver uses: a `contentDir` file
 * (`${directory}/${slug}.md`) first, then `markdown.file`, then the page-level
 * `source.file`. Returns `undefined` for inline `markdown.content` (no file).
 */
const resolveContentFilePath = (
  page: Page,
  routeParams: Readonly<Record<string, string>>
): string | undefined => {
  const { contentDir } = page
  if (contentDir !== undefined) {
    const slug = deriveContentDirSlugFromRouteParams(contentDir, routeParams)
    if (slug === undefined) return undefined
    const directory = contentDir.directory.replace(/\/+$/, '')
    return `${directory}/${slug}.md`
  }
  if (typeof page.markdown?.file === 'string') return page.markdown.file
  return derivePageSourceFile(page)
}

/**
 * Resolve the article's "Last updated" stamp.
 * The stamp is a `docs`-layout affordance only, so non-`docs` layouts short-
 * circuit before the mtime `stat`. An explicit `updated` (or `date`) frontmatter
 * field WINS (a no-maintenance, honest override); otherwise it falls back to the
 * content file's modification time read at serve time. Returns `undefined` when
 * the layout is not `docs`, or when neither a frontmatter date nor an mtime is
 * available.
 */
// eslint-disable-next-line max-params -- B2 threads the active currentLang through the existing last-updated resolver
async function resolveLastUpdated(
  page: Page,
  routeParams: Readonly<Record<string, string>>,
  frontmatter: Readonly<Record<string, string>>,
  layout: ResolvedMarkdownPage['layout'],
  currentLang?: string
): Promise<string | undefined> {
  if (layout !== 'docs') return undefined
  const frontmatterDate = frontmatter['updated'] ?? frontmatter['date']
  if (typeof frontmatterDate === 'string' && frontmatterDate.trim().length > 0) {
    return formatHumanDate(frontmatterDate.trim(), currentLang)
  }
  const filePath = resolveContentFilePath(page, routeParams)
  if (filePath === undefined) return undefined
  const mtime = await statMtime(filePath)
  return mtime === undefined ? undefined : formatHumanDate(mtime, currentLang)
}

/**
 * Resolve the article's "Edit this page" href.
 * Returns `undefined` unless the page's `contentDir.editUrl` template is set AND
 * the article slug resolves — the two conditions that make an honest edit target.
 * The `{slug}` / `{path}` / `{lang}` placeholders are interpolated from the
 * derived slug and the active `currentLang` (NOT from any nav href, whose pattern
 * carries no `/:lang/` prefix).
 */
const resolveEditUrl = (
  page: Page,
  routeParams: Readonly<Record<string, string>>,
  currentLang: string | undefined
): string | undefined => {
  const { contentDir } = page
  if (contentDir?.editUrl === undefined) return undefined
  const slug = deriveContentDirSlugFromRouteParams(contentDir, routeParams)
  if (slug === undefined) return undefined
  return buildContentDirEditUrl({ template: contentDir.editUrl, slug, lang: currentLang })
}

/**
 * Resolve the article's "Report an issue" href (A2). Mirrors {@link resolveEditUrl}
 * — the SAME `buildContentDirEditUrl` interpolation — but reads `contentDir.issueUrl`,
 * whose placeholders are OPTIONAL (a bare tracker URL passes through verbatim).
 * Returns `undefined` unless the template is set AND the slug resolves.
 */
const resolveIssueUrl = (
  page: Page,
  routeParams: Readonly<Record<string, string>>,
  currentLang: string | undefined
): string | undefined => {
  const { contentDir } = page
  if (contentDir?.issueUrl === undefined) return undefined
  const slug = deriveContentDirSlugFromRouteParams(contentDir, routeParams)
  if (slug === undefined) return undefined
  return buildContentDirEditUrl({ template: contentDir.issueUrl, slug, lang: currentLang })
}

/**
 * Resolve the docs-article breadcrumb ROOT crumb (A1) from an already-built
 * collection nav. Returns `undefined` for a non-zoned sidebar (the breadcrumb then
 * keeps its "Home" root). The active entry is the sidebar's `isCurrent` entry.
 */
const buildDocsRootCrumb = (
  collectionNav: CollectionNavData | undefined
): DocsRootCrumb | undefined => {
  if (collectionNav === undefined) return undefined
  const current = collectionNav.sidebar.find((entry) => entry.isCurrent)
  if (current === undefined) return undefined
  return resolveDocsRootCrumb(collectionNav.sidebar, current, collectionNav.tabs)
}

/**
 * Assemble every OPTIONAL field of the resolved payload (each emitted only when it
 * has a value) into a single spread object. Extracted so `resolveMarkdownPage`
 * stays within its cyclomatic-complexity + line budgets — all the "spread when
 * present" branches live here instead of inline in the return literal.
 */
const buildOptionalPageFields = (input: {
  readonly toc: ReturnType<typeof buildToc>
  readonly collectionNav: CollectionNavData | undefined
  readonly seo: ContentDirSeoMeta | undefined
  readonly lastUpdated: string | undefined
  readonly editUrl: string | undefined
  readonly issueUrl: string | undefined
  readonly contributionNote: string | undefined
  readonly docsRootCrumb: DocsRootCrumb | undefined
  readonly currentLang: string | undefined
}): Partial<ResolvedMarkdownPage> => ({
  ...(input.toc !== undefined && {
    tocHeadings: input.toc.headings,
    tocPosition: input.toc.position,
  }),
  ...(input.collectionNav !== undefined && { collectionNav: input.collectionNav }),
  ...(input.seo !== undefined && { seo: input.seo }),
  ...(input.lastUpdated !== undefined && { lastUpdated: input.lastUpdated }),
  ...(input.editUrl !== undefined && { editUrl: input.editUrl }),
  ...(input.issueUrl !== undefined && { issueUrl: input.issueUrl }),
  ...(input.contributionNote !== undefined && { contributionNote: input.contributionNote }),
  ...(input.docsRootCrumb !== undefined && { docsRootCrumb: input.docsRootCrumb }),
  ...(input.currentLang !== undefined && { lang: input.currentLang }),
})

/**
 * `true` when a contentDir outcome yields no renderable markdown payload — the
 * slug was filtered out (`excluded`) or genuinely does not exist (`not-found`).
 * The route layer distinguishes the two via `isContentDirSlugNotFound`
 * (`not-found` → real 404, `excluded` → empty 200 shell); the resolver treats
 * both as "no payload".
 */
const isNonRenderableOutcome = (outcome: ContentDirOutcome): boolean =>
  outcome.kind === 'excluded' || outcome.kind === 'not-found'

/**
 * Resolve the docs-chrome + SEO fields for a page in one pass: the A1 zone-tab
 * breadcrumb root, the synthesised SEO/JSON-LD meta (threaded with that root),
 * the last-updated stamp, and the contribution affordances (edit / issue /
 * note). Extracted so `resolveMarkdownPage` stays within its line budget.
 */
const resolvePageChrome = async (input: {
  readonly page: Page
  readonly routeParams: Readonly<Record<string, string>>
  readonly app: App | undefined
  readonly currentLang: string | undefined
  readonly indexBasePathPattern: string | undefined
  readonly frontmatter: Readonly<Record<string, string>>
  readonly layout: ResolvedMarkdownPage['layout']
  readonly collectionNav: CollectionNavData | undefined
}): Promise<{
  readonly seo: ContentDirSeoMeta | undefined
  readonly lastUpdated: string | undefined
  readonly editUrl: string | undefined
  readonly issueUrl: string | undefined
  readonly contributionNote: string | undefined
  readonly docsRootCrumb: DocsRootCrumb | undefined
}> => {
  const { page, routeParams, app, currentLang, indexBasePathPattern, frontmatter } = input
  // A1: the zone-tab breadcrumb root, threaded into BOTH the visible breadcrumb
  // and the synthesised BreadcrumbList JSON-LD.
  const docsRootCrumb = buildDocsRootCrumb(input.collectionNav)
  const seo = buildContentDirSeo(
    page,
    routeParams,
    frontmatter,
    app,
    indexBasePathPattern,
    docsRootCrumb
  )
  // [internal ref]: gated to the `docs` layout inside the resolver (skips the mtime `stat`).
  const lastUpdated = await resolveLastUpdated(
    page,
    routeParams,
    frontmatter,
    input.layout,
    currentLang
  )
  return {
    seo,
    lastUpdated,
    editUrl: resolveEditUrl(page, routeParams, currentLang),
    issueUrl: resolveIssueUrl(page, routeParams, currentLang),
    contributionNote: page.contentDir?.contributionNote,
    docsRootCrumb,
  }
}

// eslint-disable-next-line max-params -- [internal ref] threads the index base-path pattern through the existing resolver
export async function resolveMarkdownPage(
  page: Page,
  routeParams: Readonly<Record<string, string>> = {},
  app?: App,
  currentLang?: string,
  /**
   * [internal ref] — the base-path PATTERN when this render serves a `contentDir.index`
   * article at the collection base path (`/docs/:slug` → `/docs`,
   * `/:lang/docs/:slug` → `/:lang/docs`). When set, the synthesised SEO meta
   * (canonical + hreflang alternates) is built against this base-path pattern so
   * the single canonical URL is the base path itself, never the index article's
   * slugged URL. `undefined` for ordinary slugged article renders.
   */
  indexBasePathPattern?: string
): Promise<ResolvedMarkdownPage | undefined> {
  const pageSourceFile = derivePageSourceFile(page)
  const contentDirOutcome = await loadContentDirSource(page, routeParams)
  // Both `excluded` and `not-found` produce no markdown payload. The route
  // distinguishes them via `isContentDirSlugNotFound`: `not-found` drives a
  // real HTTP 404, while `excluded` still renders an (empty) 200 shell.
  if (isNonRenderableOutcome(contentDirOutcome)) {
    return undefined
  }
  if (hasNoMarkdownTrigger(contentDirOutcome, page, pageSourceFile)) return undefined
  const markdown: Markdown = page.markdown ?? {}
  const source = await pickMarkdownSource(contentDirOutcome, markdown, pageSourceFile)
  const localisedSource = localiseMarkdownSource(source, app, currentLang)
  const rendered = renderMarkdownToHtml(localisedSource)
  const composedHtml = await composeMarkdownHtml(rendered, app)
  const toc = buildToc(rendered, markdown.toc)
  const layout = markdown.layout ?? DEFAULT_LAYOUT
  const collectionNav = await buildCollectionNav(page, routeParams)
  const chrome = await resolvePageChrome({
    page,
    routeParams,
    app,
    currentLang,
    indexBasePathPattern,
    frontmatter: rendered.frontmatter,
    layout,
    collectionNav,
  })
  return {
    html: composedHtml,
    layout,
    frontmatter: rendered.frontmatter,
    ...buildOptionalPageFields({ toc, collectionNav, currentLang, ...chrome }),
  }
}

/**
 * `true` when a contentDir page's requested slug genuinely does not exist and
 * the route must respond with a real HTTP 404.
 *
 * This is the not-found signal the page renderer consumes BEFORE building the
 * (otherwise 200) page HTML: an existing collection directory missing the
 * requested slug — or a slug filtered out by `contentDir.filter` — is a true
 * 404, distinct from a route declared before any content exists (which keeps
 * graceful-degrading to an empty 200 article, [internal ref]).
 *
 * Returns `false` for non-contentDir pages so ordinary pages are untouched.
 */
export const isContentDirSlugNotFound = async (
  page: Page,
  routeParams: Readonly<Record<string, string>> = {}
): Promise<boolean> => {
  if (page.contentDir === undefined) return false
  const outcome = await loadContentDirSource(page, routeParams)
  return outcome.kind === 'not-found'
}
