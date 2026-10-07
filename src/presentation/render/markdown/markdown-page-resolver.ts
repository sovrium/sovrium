/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type MarkdownHeading } from '@/domain/kernel/markdown/markdown-renderer'
import { sanitizeRichTextHTML } from '@/domain/kernel/sanitize/html-sanitization'
import { type ContentDirSeoMeta } from '@/domain/models/app/pages/content-dir-seo-meta'
import { deriveContentDirSlugFromRouteParams } from '@/domain/models/app/pages/content-dir-slug'
import { renderMarkdownToHtml } from '@/infrastructure/markdown/markdown-it-renderer'
import { highlightCodeBlocks } from '@/infrastructure/markdown/shiki-highlighter'
import { docsFrameOf, type DocsFrame } from '@/presentation/render/markdown/docs-frame'
import { type DocsRootCrumb } from '@/presentation/render/markdown/docs-root-crumb'
import { spliceMarkdownCodeFrames } from '@/presentation/render/markdown/markdown-code-frames'
import { spliceMarkdownDirectives } from '@/presentation/render/markdown/markdown-directives'
import { resolveMarkdownTranslations } from '@/presentation/render/markdown/markdown-i18n'
import { buildToc } from '@/presentation/render/markdown/markdown-toc'
import {
  listContentDir,
  type CollectionNavData,
} from '@/presentation/render/resolve/content-dir-lister'
import { buildContentDirSeo } from '@/presentation/render/resolve/content-dir-structured-data-synthesis'
import {
  buildDocsRootCrumb,
  resolveEditUrl,
  resolveIssueUrl,
  resolveLastUpdated,
} from './markdown-page-meta'
import {
  derivePageSourceFile,
  loadContentDirSource,
  pickMarkdownSource,
} from './markdown-page-source'
import type { ContentDirOutcome } from './markdown-page-source'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'
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
export interface ResolvedMarkdownPage extends DocsFrame {
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
  const codeBlockTheme = app?.design?.codeBlock?.theme
  const highlightedHtml = await highlightCodeBlocks(
    rendered.html,
    rendered.codeBlocks,
    codeBlockTheme,
    app?.design?.codeBlock?.darkTheme
  )
  const sanitizedHtml = sanitizeRichTextHTML(highlightedHtml)
  const withDirectives = spliceMarkdownDirectives(sanitizedHtml, rendered.directives, app?.design)
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
  routeParams: Readonly<Record<string, string>>,
  isArticleReadable: ((frontmatter: Readonly<Record<string, string>>) => boolean) | undefined
): Promise<CollectionNavData | undefined> => {
  const { contentDir } = page
  if (contentDir === undefined) return undefined
  if (contentDir.nav?.enabled !== true) return undefined
  const currentSlug = deriveContentDirSlugFromRouteParams(contentDir, routeParams)
  return listContentDir(contentDir, page.path, currentSlug, isArticleReadable)
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

// eslint-disable-next-line max-params -- the index base-path pattern is threaded through the existing resolver
export async function resolveMarkdownPage(
  page: Page,
  routeParams: Readonly<Record<string, string>> = {},
  app?: App,
  currentLang?: string,
  /**
   * The base-path PATTERN when this render serves a `contentDir.index`
   * article at the collection base path (`/docs/:slug` → `/docs`,
   * `/:lang/docs/:slug` → `/:lang/docs`). When set, the synthesised SEO meta
   * (canonical + hreflang alternates) is built against this base-path pattern so
   * the single canonical URL is the base path itself, never the index article's
   * slugged URL. `undefined` for ordinary slugged article renders.
   */
  indexBasePathPattern?: string,
  /**
   * Which articles the reader may open, by their front matter
   * `access`: the sidebar and the previous/next links list only those. Absent
   * lists every article, as before.
   */
  isArticleReadable?: (frontmatter: Readonly<Record<string, string>>) => boolean
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
  const collectionNav = await buildCollectionNav(page, routeParams, isArticleReadable)
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
    ...docsFrameOf(markdown),
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
 * graceful-degrading to an empty 200 article, a pages markdown spec).
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
