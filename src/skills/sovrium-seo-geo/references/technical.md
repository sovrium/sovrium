# Technical SEO rules

## Contents

- The origin
- Canonical URLs
- Redirects
- Indexing controls
- robots.txt
- Sitemaps
- Multilingual pages and hreflang
- Rendering
- Images and performance
- Submitting to engines
- Rule ids

Tags in brackets point to `sources.md`. Each rule says what Sovrium does and what you write.

## The origin

| Rule                                                                   | Threshold | Sovrium                                                                                                                                                                     |
| ---------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One public origin, `https`, one host (with or without `www`, not both) | —         | Set `BASE_URL` on the server, `SOVRIUM_BASE_URL` for `sovrium build`                                                                                                        |
| Every advertised URL absolute                                          | —         | Without `BASE_URL`, sitemap and robots use the request's `Host` (or `X-Forwarded-Host`); hreflang falls back to the origin of an absolute `meta.canonical`, else is omitted |

Behind a reverse proxy that does not forward the host, an unset `BASE_URL` advertises the internal address. Always set it in production. [S8]

## Canonical URLs

- One canonical per page, absolute, pointing at itself for the preferred version. [S10]
- Canonical = the sitemap `<loc>` = `og:url` = the internal links you write. Mismatches split signals.
- Sovrium writes `<link rel="canonical">` only from `meta.canonical`; content-dir pages synthesise one from their resolved URL. Collection and record pages need it too.
- Do not canonicalise paginated or filtered pages to page one unless the content is the same.
- A language version's canonical points to itself, not to the default language.

## Redirects

| Case                                   | Status     | Sovrium                                                                         |
| -------------------------------------- | ---------- | ------------------------------------------------------------------------------- |
| Permanent move                         | 301 or 308 | `redirects` rule; 301 is the default when `status` is omitted                   |
| Temporary                              | 302 or 307 | `redirects` rule with `status`                                                  |
| Trailing slash                         | 301        | Automatic: `/docs/` → `/docs` (a bare language root `/en/` keeps its slash)     |
| Unprefixed path on a multilingual site | 302        | Automatic, negotiated from the visitor's language, with `Vary: Accept-Language` |

No chains: a redirect's target answers 200 directly. After restructuring, update internal links and the canonical rather than relying on the redirect. Manual: `sovrium docs app-schema/redirects`. [S11]

## Indexing controls

| Want                                          | Use                                                                            | Not                                                             |
| --------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| Keep a page out of results                    | `meta.noindex: true` or `meta.robots: noindex`                                 | A `robots.txt` `Disallow` (the crawler never reads the noindex) |
| Keep a non-HTML file out                      | `X-Robots-Tag: noindex` header                                                 | A meta tag (it has no head)                                     |
| Keep a page private                           | `access` rules on the page (a denied visitor gets 404)                         | noindex or robots                                               |
| Keep a passage out of snippets and AI answers | `data-nosnippet` on the element, `max-snippet` or `nosnippet` in `meta.robots` | Blocking the crawler                                            |

**Sovrium**: `robots.txt` disallows only `/_` pages — never a noindex page, so its tag stays readable — and both Markdown forms of an article on a noindex page answer with `X-Robots-Tag: noindex`. [S4][S5]

## robots.txt

- Served at `/robots.txt`, generated: `User-agent: *`, `Allow: /`, one `Disallow` per `/_` page, then `Sitemap: <origin>/sitemap.xml`. Manual: `sovrium docs pages-seo/seo-crawlers`.
- Limit: 500 KiB; Google ignores the rest. [S5]
- `Disallow` stops crawling, not indexing; a disallowed URL linked from elsewhere can appear in results without a snippet.
- AI crawler rules are an operator policy; see `crawlers.md`. Sovrium generates one `User-agent: *` group today.

## Sitemaps

| Rule                     | Threshold                                       | Sovrium                                                                                                                    |
| ------------------------ | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Size                     | ≤ 50 000 URLs and ≤ 50 MB uncompressed per file | `/sitemap.xml`; past 5 000 URLs an index over `/sitemap-N.xml`, each ≤ 5 000                                               |
| Contents                 | Only canonical, indexable, 200 URLs             | Public pages minus noindex, `/_*`, `sitemap: false`                                                                        |
| `lastmod`                | The real last significant change, W3C datetime  | Only when known (file modification time, record `updated-at`), ISO 8601 with time; absent otherwise                        |
| `priority`, `changefreq` | Ignored by Google                               | Emitted (defaults 0.5, monthly); per page via `sitemap`                                                                    |
| Record detail pages      | Should be listed when public                    | Listed when anonymously readable (table `read: all`, no row rule, address field readable by all, not deleted); cached 60 s |

The sitemap ping endpoint was retired in 2023; submit the sitemap in Search Console and Bing Webmaster Tools, and keep the `Sitemap:` line in robots. [S6][S7][S22]

## Multilingual pages and hreflang

- Declare languages once in `languages` (`default`, `supported` with each language's `code` and `locale`). Sovrium derives hreflang for every page; there is no per-page alternates key. Manual: `sovrium docs app-schema/languages`.
- Each page lists all its language versions, **itself included**, plus `x-default`. [S8][S9]
- Every hreflang URL is absolute and on the canonical's host: set `BASE_URL` or an absolute `meta.canonical`.
- Alternates point at non-redirecting URLs. Sovrium emits the slash-free form except for the language root, which keeps its slash because that is its canonical form.
- Translate `title` and `description` per language with `meta.i18n`.
- Content-dir pages carry per-file alternates resolved from their language folders.

## Rendering

- Search engines render JavaScript, but later and not always; the text you want indexed belongs in the initial HTML. [S12]
- Sovrium renders pages on the server; interactive islands (tables, calendars, forms) mount afterwards. A data table's rows may load client-side: check with `curl` whether the rows you want indexed are in the HTML, and prefer server-rendered components (lists, cards bound to data) for indexable content.
- Links are real `<a href>` elements; buttons that navigate are not crawled.

## Images and performance

| Rule                            | Threshold                                                                                                             |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| LCP (largest contentful paint)  | ≤ 2.5 s at the 75th percentile [S23]                                                                                  |
| INP (interaction to next paint) | ≤ 200 ms at p75 [S23]                                                                                                 |
| CLS (cumulative layout shift)   | ≤ 0.1 at p75 [S23]                                                                                                    |
| Hero image                      | `variant: hero` renders `loading="eager"` and `fetchpriority="high"` by default [S24]                                 |
| Other images                    | `loading="lazy"` by default; an explicit `props.loading` wins [S24]                                                   |
| Dimensions                      | `width` and `height` on every image [S13]                                                                             |
| `alt`                           | Descriptive for content, empty for decoration [S13]                                                                   |
| Format                          | WebP from the runtime transform is fine; committed assets may be AVIF, except share images (see `social-previews.md`) |

Prefer field data (Chrome UX Report, PageSpeed Insights) over a single lab run. [S66]

## Submitting to engines

- Google: Search Console, sitemap submission, URL inspection. No IndexNow.
- Bing and Yandex: Webmaster Tools; IndexNow is optional and reaches the participating engines only, never Google. [S27]
- Bing's guidance leans on sitemaps with accurate `lastmod` for AI-powered search too — another reason Sovrium writes `lastmod` only when it knows it. [S26]

## Rule ids

Use these ids in audit findings (see `report-template.md`):

| Id         | Rule                                                    |
| ---------- | ------------------------------------------------------- |
| T-ORIGIN   | `BASE_URL` set, absolute URLs everywhere                |
| T-CANON    | Absolute self-canonical, matching sitemap and `og:url`  |
| T-REDIRECT | 301/308 for moves, no chains                            |
| T-NOINDEX  | noindex readable (not blocked), `X-Robots-Tag` on twins |
| T-ROBOTS   | robots under 500 KiB, absolute `Sitemap:`               |
| T-SITEMAP  | Only canonical 200 URLs, real `lastmod`, size limits    |
| T-HREFLANG | Complete, absolute, self-referencing, `x-default`       |
| T-RENDER   | Indexable text in the initial HTML                      |
| T-IMG      | Eager hero, lazy rest, dimensions, alt                  |
| T-CWV      | LCP, INP, CLS within thresholds                         |
| T-TITLE    | Unique title, brand suffix                              |
| T-DESC     | Unique description                                      |
| T-H1       | One visible h1                                          |
