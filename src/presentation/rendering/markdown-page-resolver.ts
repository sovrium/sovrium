/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isAbsolute, resolve } from 'node:path'
import {
  filterTocHeadings,
  renderMarkdownToHtml,
  type MarkdownHeading,
  type RenderedMarkdown,
} from '@/domain/services/markdown-renderer'
import type { Page } from '@/domain/models/app/pages'
import type { ContentDir } from '@/domain/models/app/pages/content-dir'
import type { Markdown } from '@/domain/models/app/pages/markdown'

/**
 * Pre-render resolver for `page.markdown` (US-PAGES-LAYOUT-MARKDOWN-PAGES-002).
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
  /** Layout mode chosen by the schema (defaults to `'prose'` per APP-PAGES-MARKDOWN-014). */
  readonly layout: 'prose' | 'docs' | 'full'
  /** TOC headings if `markdown.toc` is enabled, otherwise undefined. */
  readonly tocHeadings?: readonly MarkdownHeading[]
  /** TOC position when TOC is enabled. Defaults to `'top'`. */
  readonly tocPosition?: 'top' | 'sidebar'
  /** Frontmatter scalars exposed for `$frontmatter.*` resolution. */
  readonly frontmatter: Readonly<Record<string, string>>
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
    const absolutePath = isAbsolute(path) ? path : resolve(process.cwd(), path)
    const file = Bun.file(absolutePath)
    if (!(await file.exists())) return undefined
    return await file.text()
  } catch {
    return undefined
  }
}

/**
 * Load the markdown source string for a page declaration. Inline `content`
 * wins over `file` per the schema's optional-pair shape (the cross-validator
 * may later make these mutually exclusive — APP-PAGES-MARKDOWN-008 — but for
 * now `content` is preferred when both are set).
 *
 * `pageSourceFile` is the page-level `source.file` fallback used when
 * `markdown.content` and `markdown.file` are both absent (US-PAGES-LAYOUT-
 * MARKDOWN-PAGES-001 file-based markdown). The page-level `source.file` is a
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
 * Trim a leading `/` from an extracted slug so `${directory}/${slug}.md` does
 * not collapse into an absolute path on disk when the route param happens to
 * start with one (defensive — current route-matcher captures already strip
 * the slash, but keep the resolver self-contained).
 */
const stripLeadingSlash = (value: string): string =>
  value.startsWith('/') ? value.slice(1) : value

/**
 * Derive a file-relative slug from the route params for a contentDir page.
 *
 * `slugFrom: 'filename'` (default) returns the first dynamic-segment value
 * verbatim — typical for `/blog/:slug` shapes where one column captures the
 * filename without `.md`.
 *
 * `slugFrom: 'filepath'` joins all dynamic-segment values with `/` so nested
 * directory shapes like `/docs/:section/:page` map to
 * `${directory}/${section}/${page}.md`. The route-matcher only captures one
 * non-slash chunk per `:` segment today, but the join semantics keep the
 * resolver future-proof for richer wildcard syntax (eg. `:path*` once the
 * matcher learns to consume multi-segment paths).
 */
const deriveContentDirSlug = (
  contentDir: ContentDir,
  routeParams: Readonly<Record<string, string>>
): string | undefined => {
  const values = Object.values(routeParams).filter((v) => typeof v === 'string' && v.length > 0)
  if (values.length === 0) return undefined
  if (contentDir.slugFrom === 'filepath') {
    return stripLeadingSlash(values.join('/'))
  }
  // `filename` mode: take the first available dynamic segment.
  const first = values[0]
  return first === undefined ? undefined : stripLeadingSlash(first)
}

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
 * Apply a contentDir.filter against the parsed frontmatter of a loaded
 * markdown file. Returns `true` when the file should be rendered, `false`
 * when it should be excluded.
 *
 * Currently honours boolean filters (`draft: false` excludes files whose
 * frontmatter has `draft: true`). Other shapes pass through to a string-
 * equality comparison against the frontmatter scalar (the renderer already
 * coerces all scalars to strings).
 */
const matchesContentDirFilter = (
  contentDir: ContentDir,
  frontmatter: Readonly<Record<string, string>>
): boolean => {
  const { filter } = contentDir
  if (filter === undefined) return true
  return Object.entries(filter).every(([key, expected]) => {
    const actual = frontmatter[key]
    if (typeof expected === 'boolean') {
      // `draft: false` filter excludes files whose frontmatter parsed `draft`
      // as the string `'true'`. Strings other than `'true'` are treated as
      // not-true (safe default for `draft: false` exclusion semantics).
      const actualIsTrue = actual === 'true'
      return expected === actualIsTrue
    }
    return actual === String(expected)
  })
}

/**
 * Outcome of the contentDir branch: `'no-source'` means the page is not a
 * contentDir page and the resolver should fall through to the
 * `markdown` / `source.file` paths; `'excluded'` means the page is a
 * contentDir page but the slug failed the filter (resolver returns
 * undefined → empty page renders without an article); `'source'` carries
 * the loaded markdown body to feed into `renderMarkdownToHtml`.
 */
type ContentDirOutcome =
  | { readonly kind: 'no-source' }
  | { readonly kind: 'excluded' }
  | { readonly kind: 'source'; readonly body: string }

/**
 * Build the markdown source string for a `contentDir` page. Returns
 * `'no-source'` when the page does not declare `contentDir`; `'excluded'`
 * when an active `filter` rejected the file (or the file is missing while a
 * filter is configured); otherwise the file body (or empty string when
 * graceful-degrade applies).
 */
const loadContentDirSource = async (
  page: Page,
  routeParams: Readonly<Record<string, string>>
): Promise<ContentDirOutcome> => {
  const { contentDir } = page
  if (contentDir === undefined) return { kind: 'no-source' }

  const slug = deriveContentDirSlug(contentDir, routeParams)
  const filterActive = hasContentDirFilter(contentDir)

  if (slug === undefined) {
    return filterActive ? { kind: 'excluded' } : { kind: 'source', body: '' }
  }

  const filePath = `${contentDir.directory.replace(/\/+$/, '')}/${slug}.md`
  const fileContent = await readMarkdownFile(filePath)

  if (fileContent === undefined) {
    // File missing: graceful-degrade to empty article when no filter is
    // declared (matches `markdown.file` leniency); 404-equivalent when a
    // filter is in play (the page is intentionally restrictive about what
    // it surfaces).
    return filterActive ? { kind: 'excluded' } : { kind: 'source', body: '' }
  }

  if (filterActive) {
    const probe = renderMarkdownToHtml(fileContent)
    if (!matchesContentDirFilter(contentDir, probe.frontmatter)) {
      return { kind: 'excluded' }
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
 *     (US-PAGES-LAYOUT-MARKDOWN-PAGES-002) — inline content, file-based
 *     content, layout, and TOC all live here.
 *   - `page.source.file` (for `.md` files) is a lighter-weight shortcut
 *     (US-PAGES-LAYOUT-MARKDOWN-PAGES-001) used by file-based-markdown
 *     specs that just want to render an article from a markdown file
 *     without nesting under `markdown.`. Defaults to the `prose` layout.
 *   - `page.contentDir` (US-PAGES-LAYOUT-MARKDOWN-PAGES-003) declares a
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

export const resolveMarkdownPage = async (
  page: Page,
  routeParams: Readonly<Record<string, string>> = {}
): Promise<ResolvedMarkdownPage | undefined> => {
  const pageSourceFile = derivePageSourceFile(page)
  const contentDirOutcome = await loadContentDirSource(page, routeParams)
  if (contentDirOutcome.kind === 'excluded') return undefined
  if (hasNoMarkdownTrigger(contentDirOutcome, page, pageSourceFile)) return undefined
  const markdown: Markdown = page.markdown ?? {}
  const source = await pickMarkdownSource(contentDirOutcome, markdown, pageSourceFile)
  const rendered = renderMarkdownToHtml(source)
  const toc = buildToc(rendered, markdown.toc)
  const layout = markdown.layout ?? DEFAULT_LAYOUT
  return {
    html: rendered.html,
    layout,
    ...(toc !== undefined && {
      tocHeadings: toc.headings,
      tocPosition: toc.position,
    }),
    frontmatter: rendered.frontmatter,
  }
}
