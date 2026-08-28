/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import type { Languages } from '@/domain/models/app/languages'
import type { Page } from '@/domain/models/app/pages'
import type { ContentDirSeoMeta } from '@/domain/utils/content-dir/content-dir-seo-meta'

/**
 * SEO `<head>` helpers extracted from `PageHead.tsx` so the head composer stays
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
 *  2. else `BASE_URL` (trailing slash trimmed);
 *  3. else `''` — relative, preserving the prior single-origin-unknown behaviour.
 *
 * The `new URL(...)` parse is guarded so a relative/malformed/absent canonical
 * falls through to the env/relative fallback instead of throwing during SSR.
 */
const resolveHreflangOrigin = (canonical: string | undefined): string => {
  if (canonical && /^https?:\/\//i.test(canonical)) {
    try {
      return new URL(canonical).origin
    } catch {
      // Malformed absolute URL — fall through to env/relative.
    }
  }
  const baseUrl = Bun.env.BASE_URL
  return baseUrl ? baseUrl.replace(/\/$/, '') : ''
}

/**
 * Renders hreflang alternate links for multi-language SEO.
 * Generates <link rel="alternate" hreflang="..."> tags for each supported language.
 *
 * Uses dual-pattern approach:
 * - hreflang attribute: Full locale (e.g., 'en-US', 'fr-FR') for SEO standards
 * - href attribute: ABSOLUTE URL sharing the canonical's origin, short-code path
 *   segment (e.g. `https://example.com/en/products`) for routing
 *
 * TRAILING SLASH — emitted ONLY for the language root. Every alternate
 * carried one until trailing-slash normalization shipped; from then on
 * `/en/products/` 301s to `/en/products`, and Google requires an hreflang
 * alternate to be non-redirecting or it discards the annotation. The language
 * root `/en/` keeps its slash because that IS its canonical form — the one path
 * the normalizer exempts, since `/en` already 301s TO `/en/`.
 *
 * Includes x-default link pointing to the default language for undefined locales.
 */
function HreflangLinks({
  page,
  languages,
}: {
  readonly page: Page
  readonly languages: Languages | undefined
}): ReactElement | undefined {
  if (!languages || languages.supported.length <= 1) {
    return undefined
  }

  // The homepage's alternate is the language ROOT (`/en/`), which is canonical
  // WITH its slash; every other page's alternate is the slash-free canonical
  // form the trailing-slash normalizer redirects to.
  const basePath = page.path === '/' ? '/' : page.path
  const origin = resolveHreflangOrigin(page.meta?.canonical)

  return (
    <>
      {languages.supported.map((lang) => {
        // Use full locale for hreflang attribute (e.g., 'en-US', 'fr-FR')
        // Use short code for the URL path segment (e.g., '/en/', '/fr/'), made
        // absolute with the resolved origin for host-consistency with canonical.
        const hreflang = lang.locale || lang.code
        return (
          <link
            key={lang.code}
            rel="alternate"
            hrefLang={hreflang}
            href={`${origin}/${lang.code}${basePath}`}
          />
        )
      })}
      <link
        key="x-default"
        rel="alternate"
        hrefLang="x-default"
        href={`${origin}/${languages.default}${basePath}`}
      />
    </>
  )
}

/**
 * Renders hreflang alternate links for a content-directory page
 *.
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
 *  - a contentDir page uses its pre-resolved per-file `alternates`
 *;
 *  - any other page falls back to the generic route-pattern block. The generic
 *    block is suppressed for contentDir pages because it would emit broken
 *    `:lang`/`:slug` URLs for the dynamic template path.
 */
export function HreflangSection({
  page,
  languages,
  contentDirSeo,
}: {
  readonly page: Page
  readonly languages: Languages | undefined
  readonly contentDirSeo: ContentDirSeoMeta | undefined
}): ReactElement | undefined {
  if (contentDirSeo?.alternates?.length) {
    return <ContentDirHreflangLinks alternates={contentDirSeo.alternates} />
  }
  return (
    <HreflangLinks
      page={page}
      languages={languages}
    />
  )
}
