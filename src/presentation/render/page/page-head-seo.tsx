/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement, useContext } from 'react'
import { PageLanguageAlternatesContext } from './page-alternates'
import type { Languages } from '@/domain/models/app/languages'
import type { Page } from '@/domain/models/app/pages'
import type { ContentDirSeoMeta } from '@/domain/models/app/pages/content-dir-seo-meta'

/**
 * SEO `<head>` helpers extracted from `page-head.tsx` so the head composer stays
 * under its max-lines cap. Covers hreflang alternate-link rendering (generic
 * route-pattern + content-directory) and the content-directory Open Graph
 * merge.
 */

/**
 * Resolve the base ORIGIN used to make generic hreflang alternates absolute.
 *
 * Google/Lighthouse reject relative hreflang alternates and require the hreflang
 * host to match the canonical host, so the alternates must be absolute and
 * origin-consistent with the page's canonical. Fallback chain (origin only —
 * never grafts the canonical's path):
 *  1. the ORIGIN of an absolute `page.meta.canonical` (e.g.
 *     `https://example.com/products` → `https://example.com`);
 *  2. else `BASE_URL`, or `SOVRIUM_BASE_URL` during `sovrium build` (trailing
 *     slash trimmed);
 *  3. else `undefined` — no absolute origin is known, and the caller emits no
 *     alternates at all: search engines reject relative ones, so a relative
 *     cluster is worse than none. The server warns at boot when a
 *     multi-language app runs without `BASE_URL`.
 *
 * The `new URL(...)` parse is guarded so a relative/malformed/absent canonical
 * falls through to the env fallback instead of throwing during SSR.
 */
const resolveHreflangOrigin = (canonical: string | undefined): string | undefined => {
  if (canonical && /^https?:\/\//i.test(canonical)) {
    try {
      return new URL(canonical).origin
    } catch {
      // Malformed absolute URL — fall through to env/relative.
    }
  }
  const baseUrl = Bun.env.BASE_URL || Bun.env.SOVRIUM_BASE_URL
  return baseUrl ? baseUrl.replace(/\/$/, '') : undefined
}

/**
 * Renders hreflang alternate links for multi-language SEO: one
 * `<link rel="alternate" hreflang="...">` per language the page exists in, plus
 * `x-default` naming its default-language address.
 *
 * The addresses are the page's {@link PageLanguageAlternatesContext} — the
 * domain's one reading of page paths, which the sitemap reads too — so the two
 * never contradict each other: a page whose path already names its language
 * (`/fr/pricing`) is paired with its twins rather than prefixed a second time,
 * a twin no page serves is never advertised, and a page with a path per
 * language names each translated slug. No alternate at all is emitted for a
 * page that exists in a single language.
 *
 * Dual pattern: `hreflang` carries the full locale (`fr-FR`), the `href` the
 * short-code address made ABSOLUTE on the canonical's origin. The language root
 * `/en/` keeps its trailing slash, the one address the trailing-slash
 * normalizer exempts; every other alternate is slash-free, because Google
 * discards an alternate that redirects.
 */
function HreflangLinks({
  canonical,
  languages,
}: {
  readonly canonical: string | undefined
  readonly languages: Languages | undefined
}): ReactElement | undefined {
  const alternates = useContext(PageLanguageAlternatesContext)
  if (!languages || alternates.length === 0) return undefined
  const origin = resolveHreflangOrigin(canonical)
  if (origin === undefined) return undefined
  const localeOf = (code: string): string =>
    languages.supported.find((lang) => lang.code === code)?.locale || code
  const xDefault = alternates.find((alternate) => alternate.language === languages.default)

  return (
    <>
      {alternates.map((alternate) => (
        <link
          key={alternate.language}
          rel="alternate"
          hrefLang={localeOf(alternate.language)}
          href={`${origin}${alternate.path}`}
        />
      ))}
      {xDefault !== undefined && (
        <link
          key="x-default"
          rel="alternate"
          hrefLang="x-default"
          href={`${origin}${xDefault.path}`}
        />
      )}
    </>
  )
}

/**
 * Renders hreflang alternate links for a content-directory page.
 *
 * Unlike the generic {@link HreflangLinks} (which keys off the static route
 * pattern and uses the longer `locale`), these alternates are pre-resolved per
 * file by the markdown resolver: the `:lang` segment is substituted with each
 * configured language `code` and the slug is already concrete. The hreflang
 * value is the language `code` (e.g. `en`, `fr`) — the URL-prefix segment.
 */
function ContentDirHreflangLinks({
  alternates,
}: {
  readonly alternates: ContentDirSeoMeta['alternates']
}): ReactElement | undefined {
  if (alternates.length === 0) return undefined
  return (
    <>
      {alternates.map((alt) => (
        <link
          key={alt.hreflang}
          rel="alternate"
          hrefLang={alt.hreflang}
          href={alt.href}
        />
      ))}
    </>
  )
}

/**
 * Renders the hreflang alternates for a page, choosing the right source:
 *  - a contentDir page uses its pre-resolved per-file `alternates`;
 *  - any other page falls back to the generic route-pattern block. The generic
 *    block is suppressed for contentDir pages because it would emit broken
 *    `:lang`/`:slug` URLs for the dynamic template path.
 */
export function HreflangSection({
  page,
  canonical,
  languages,
  contentDirSeo,
}: {
  readonly page: Page
  /** The page's canonical as rendered (a `$t:` key resolved); its origin hosts the alternates. */
  readonly canonical?: string
  readonly languages: Languages | undefined
  readonly contentDirSeo: ContentDirSeoMeta | undefined
}): ReactElement | undefined {
  if (contentDirSeo?.alternates?.length) {
    return <ContentDirHreflangLinks alternates={contentDirSeo.alternates} />
  }
  return (
    <HreflangLinks
      canonical={canonical ?? page.meta?.canonical}
      languages={languages}
    />
  )
}

/**
 * The page's other representations, announced for discovery:
 *  - `application/rss+xml` → `/feed.xml`, on the page the feed is built from,
 *    titled like the feed's channel (RSS autodiscovery);
 *  - `text/markdown` → the article's `.md` twin, on a content-directory
 *    article (the llmstxt.org convention). The twin is derived from the
 *    article's canonical URL, so it always names this article.
 */
function AlternateRepresentationLinks({
  feedTitle,
  markdownCanonical,
}: {
  readonly feedTitle: string | undefined
  readonly markdownCanonical: string | undefined
}): ReactElement | undefined {
  if (feedTitle === undefined && markdownCanonical === undefined) return undefined
  return (
    <>
      {feedTitle !== undefined && (
        <link
          rel="alternate"
          type="application/rss+xml"
          title={feedTitle}
          href="/feed.xml"
        />
      )}
      {markdownCanonical !== undefined && (
        <link
          rel="alternate"
          type="text/markdown"
          href={`${markdownCanonical.replace(/\/+$/, '')}.md`}
        />
      )}
    </>
  )
}

/**
 * Every `<link rel="alternate">` in the head: the language cluster, then the
 * feed and Markdown representations. `feedTitle` is the title of the feed this
 * page publishes at `/feed.xml`, or `undefined` when it publishes none.
 */
export function HeadAlternateLinks({
  page,
  canonical,
  languages,
  contentDirSeo,
  feedTitle,
}: {
  readonly page: Page
  readonly canonical?: string
  readonly languages?: Languages
  readonly contentDirSeo?: ContentDirSeoMeta
  readonly feedTitle?: string
}): ReactElement {
  return (
    <>
      <HreflangSection
        page={page}
        canonical={canonical}
        languages={languages}
        contentDirSeo={contentDirSeo}
      />
      <AlternateRepresentationLinks
        feedTitle={feedTitle}
        markdownCanonical={contentDirSeo?.canonical}
      />
    </>
  )
}
