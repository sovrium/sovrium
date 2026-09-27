---
name: sovrium-seo-geo
description: Use when a Sovrium app's public pages need to be found, shared or cited — search engine optimisation, titles and meta descriptions, canonical URLs, redirects, hreflang and multilingual pages, sitemap.xml, robots.txt, noindex, structured data and JSON-LD, Open Graph and social share previews, llms.txt and markdown twins, AI crawlers (GPTBot, ClaudeBot, Google-Extended), AI Overviews and generative engine optimisation (GEO), Core Web Vitals, or an SEO audit of a Sovrium site.
license: BSL-1.1
metadata:
  author: sovrium
  version: '1.0.0'
---

# Sovrium SEO and GEO

A bare agent repeats SEO folklore: keyword meta tags, "Google cuts titles at 60 characters", `priority` values that matter, FAQ markup for rich results, `llms.txt` as a ranking lever, AVIF share images, `Disallow` to hide a page. Worse, it audits the config instead of the HTML a crawler receives, and forgets that Sovrium writes a canonical only when you set one and writes relative links when `BASE_URL` is unset. This skill separates what search engines and social platforms document from what is merely repeated, and says plainly what Sovrium does today.

Run the core loop from `sovrium-app` underneath this skill. Manual: `sovrium docs pages-seo/seo-meta`, `sovrium docs pages-seo/seo-structured-data`, `sovrium docs app-schema/llms-txt`, `sovrium docs app-schema/redirects`, `sovrium docs app-schema/languages`, `sovrium docs pages/pages-collections`.

## Scope

**What the config expresses**: per-page `meta` (`title`, `description`, `canonical`, `robots`, `noindex`, `openGraph`, `twitter`, `schema`, `customElements`, `i18n`); per-page `sitemap` (`false`, or `priority` and `changefreq`); `rss` on collection pages; `contentDir` markdown collections; the top-level `llms`, `languages` and `redirects`; image `props` on `image` components. Look each one up with `sovrium docs config pages[].meta.<key>`.

**What the binary serves**: `/sitemap.xml` (and `/sitemap-N.xml` past 5 000 URLs), `/robots.txt`, `/llms.txt` and `/llms-full.txt` (also per language, `/<code>/llms.txt`), `/feed.xml` for pages with `rss`, and for content-dir pages a `.md` twin at `<page-url>.md` plus the same body on `Accept: text/markdown`; `sovrium build` writes those twins beside the HTML. Manual: `sovrium docs pages-seo/seo-crawlers`.

**Environment**: `BASE_URL` (running server) and `SOVRIUM_BASE_URL` (`sovrium build`) set the absolute origin. Without `BASE_URL`, the sitemap and robots fall back to the request's `Host` header, and hreflang links fall back to the origin of an absolute `meta.canonical` — or are **omitted** altogether, since search engines reject relative ones; a multi-language app started without `BASE_URL` prints a boot warning saying so.

## Survey → Implement → Evaluate

**Survey** (one batched pass, per important URL):

```
- [ ] Rendered HTML as a crawler gets it: curl -s <url> (and the browser MCP snapshot for what users see)
- [ ] chrome-devtools:lighthouse_audit when the DevTools MCP is present (SEO, performance, accessibility)
- [ ] curl -s <base>/sitemap.xml  <base>/robots.txt  <base>/llms.txt  <base>/feed.xml
- [ ] curl -sI -H 'Accept: text/markdown' <content-dir page>
- [ ] Head tags: grep '<title>|name="description"|rel="canonical"|hreflang|og:|twitter:|application/ld\+json|name="robots"'
- [ ] Structured data: validator.schema.org first, then Google's Rich Results Test
- [ ] Share preview: Facebook Sharing Debugger, LinkedIn Post Inspector (X has no public validator)
```

**Implement**: config edits only, then `sovrium validate`.

**Evaluate**: re-run the same survey once; grade each page A–F with `references/report-template.md`; report findings as `file:line`, the rule id below, and the smallest fix.

## The checklist

Tags in brackets point to `references/sources.md`.

**Origin and URLs**

1. `BASE_URL` set to the public `https` origin in production (`SOVRIUM_BASE_URL` for `sovrium build`). Without it, pages with no absolute `meta.canonical` publish no hreflang alternates at all. [S8]
2. Every indexable page sets an absolute `meta.canonical` pointing at itself. Sovrium writes `<link rel="canonical">` only when you set it (content-dir pages synthesise theirs). Canonical = the URL in the sitemap = `og:url`. [S10]
3. Moved pages get a `redirects` rule: 301 or 308 for permanent moves (Sovrium defaults to 301), 302 or 307 for temporary ones, no chains. Trailing slashes are already 301-normalised by Sovrium. [S11]

**Titles, descriptions, headings** 4. A unique `<title>` per page, the brand as a delimited suffix (`Pricing — Acme`). [S2] 5. A unique description per page, written for the person choosing a result. [S3] 6. Length: ~60 characters for a title and ~155 for a description is **truncation practice, not a rule** — Google states no limit. Sovrium's validator enforces 60 and 160 as a house practice. [S2][S3] 7. One visible `h1` per page that says what the page is. [S1]

**Indexing** 8. `noindex` (`meta.noindex` or `meta.robots`) keeps a page out of results; the page must stay crawlable so the directive can be read. Sovrium never adds a `Disallow` line for a noindex page (only `/_` pages are disallowed), so the tag is always readable. [S4][S5] 9. Non-HTML resources are noindexed with an `X-Robots-Tag` header, not a meta tag. Sovrium sends `X-Robots-Tag: noindex` on both Markdown forms (`.md` and `Accept: text/markdown`) of an article on a noindex page; a static host cannot send that header, so keep a withheld collection off a static build. [S4] 10. `robots.txt` stays under 500 KiB and ends with an absolute `Sitemap:` line (Sovrium writes it from the base origin). [S5] 11. `robots.txt` is not a privacy tool: a disallowed URL can still be indexed from links. Private pages use `access` rules and answer 404. [S5]

**Sitemap** 12. At most 50 000 URLs and 50 MB per sitemap. [S6][S22] 13. `lastmod` only when it is the real last change. Sovrium writes it only when it knows it — a content-dir article's file modification time, a record's `updated-at` field — as a full ISO 8601 timestamp, and omits it on pages declared in config. [S6] 14. Google ignores `priority` and `changefreq`; Sovrium emits them (`sitemap.priority`, `sitemap.changefreq`), which is harmless and may help other engines. Spend no time tuning them. [S6] 15. A collection page (`/blog/:slug`) lists one URL per record only when an anonymous visitor could read it: the table has `permissions.read: all` and no row-level read rule, the field the address is built from is readable by everyone, and the record is not deleted (a deleted record's own page answers 404). Records are read in pages, at most 5 000 URLs per sitemap file, and the sitemap is cached for 60 seconds, so a new record appears within a minute. Link records from indexable listing pages as well. [S6] 16. `sitemap: false` on utility pages you do not want listed. The sitemap ping endpoint is gone; submit in Search Console and Bing Webmaster Tools. [S7]

**Languages** 17. hreflang comes from `languages` (there is no per-page alternates key): each page lists every language version, itself included, plus `x-default`, all absolute. Each language version's canonical points to itself, never to another language. [S8][S9] 18. `og:locale` per language via `openGraph.locale` (`fr_FR`); in a multi-language app Sovrium also lists every other language as `og:locale:alternate`, read from each language's `locale`. [S29]

**Rendering and images** 19. Content is in the initial HTML. Sovrium renders pages on the server and mounts interactive islands afterwards: confirm with `curl` that the text you want indexed is in the raw HTML. [S12] 20. The largest above-the-fold image loads eagerly with high fetch priority; every other image is lazy. Sovrium does this by default: an `image` with no `props.loading` renders `loading="lazy"`, and `variant: hero` renders `loading="eager"` with `fetchpriority="high"`. An explicit `props.loading` wins, so give a hero pushed below the fold `loading: lazy`. Check the rendered `<img>`. [S12][S24] 21. Every image has `width` and `height` (no layout shift) and an `alt`: descriptive for content, empty for decoration. WebP is fine; AVIF is not produced by the runtime image transform. [S13] 22. Core Web Vitals at the 75th percentile, field data preferred: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1. [S23]

**Structured data** 23. JSON-LD only for content visible on the page, and only types in Google's search gallery (Organization, LocalBusiness, Product, Article, BreadcrumbList, Event …). Never FAQPage (rich result retired 2026-05-07) or HowTo (retired 2023) for rich results; Sovrium's `faqPage` shorthand still emits valid markup that simply earns nothing. [S14][S15][S16] 24. One Organization block site-wide, with a logo of at least 112 × 112 px. `meta.schema` is **not checked** by `sovrium validate`; run the Schema Markup Validator, then the Rich Results Test. [S17][S18]

**Social previews** 25. Open Graph: `og:title`, `og:type`, `og:image`, `og:url` at minimum, plus `og:description` (2–4 sentences), `og:site_name`, `og:image:alt` (Sovrium emits it from `openGraph.imageAlt`). Image 1200 × 630 (1.91:1), under 8 MB, JPEG or PNG (WebP renders almost everywhere since late 2024) — **never AVIF**, which fails on X, LinkedIn, Slack and iMessage; `sovrium validate` refuses an `openGraph.image` or `twitter.image` path ending in `.avif`. Sovrium does not emit `og:image:width` or `height` today. [S29][S30][S36] 26. `twitter.card: summary_large_image`; the preview crops to 2:1 around the centre, so keep text away from the edges. [S33]

**Feeds, agents and AI** 27. Pages with `rss` get a feed at `/feed.xml`, and the page the feed is built from announces it with `<link rel="alternate" type="application/rss+xml">`; every content-dir article announces its Markdown twin with `<link rel="alternate" type="text/markdown">`. Check the rendered head rather than adding either by hand. [S62][S49] 28. `llms.txt` (H1, a blockquote summary, then H2 sections of links) and `llms-full.txt` (a convention, not part of the proposal) are conveniences for agents. They have no measured search effect and Google does not read them. The only levers over Google's AI features are the ordinary snippet controls: `max-snippet`, `nosnippet`, `data-nosnippet`. AI-crawler access is the app operator's policy decision — see `references/crawlers.md`. [S38][S39][S19][S20]

## GEO: measured versus unproven

**Measured** (with the caveats that come with them):

- In the original generative-engine study, adding quotations with attribution (about +41 %), sourced statistics (about +33 %), fluent prose (about +29 %) and citations raised visibility; keyword stuffing lowered it (about −9 %). One synthetic engine; later replications are weaker. [S43]
- Ranking in the top ten explains about 38 % of AI Overview citations (March 2026 revision of a 76 % figure from July 2025). [S46]
- Off-site brand mentions correlate with AI visibility at 0.66, backlinks at 0.22 — a correlation, not a cause. [S45]
- Being mentioned and being cited are separate outcomes; track both. [S44]
- 97 % of `llms.txt` files were never fetched in the study period. [S39]
- Microsoft's guidance for being cited: depth, clear headings and tables, evidence, freshness. [S72]

**Unproven**: `.md` twins raising citations; `llms-full.txt`; `ai.txt`; answer-first paragraphs as a citation lever; structured data raising AI citations (one test found no significant effect, known only through secondary reporting). [S47][S49][S60]

The three edits worth making: cite sources and quote named people; put numbers with their source on the page; write fluent, specific prose with clear headings. Details: `references/geo.md`.

## Must not claim

1. Google reads `llms.txt`.
2. The meta keywords tag matters.
3. AVIF share images work.
4. Google has a title or description character limit.
5. Sitemap `priority` or `changefreq` matter to Google.
6. Blocking `Google-Extended` removes a site from AI Overviews.
7. FAQPage or HowTo markup earns rich results.
8. Structured data is required for, or raises, AI citations.
9. IndexNow reaches Google, or the sitemap ping still works.
10. A web app manifest is an SEO factor.
11. `robots.txt` hides a page from search results.
12. `.md` twins raise search visibility.
13. AIPREF or `Content-Usage` is a published standard.
14. User-initiated AI fetchers honour `robots.txt`.
15. The 2024 GEO gains transfer to production AI search engines.

## References

- [references/technical.md](references/technical.md) — read for crawl, index, canonical, redirect, hreflang, sitemap and robots rules with their thresholds, and how each maps to Sovrium config.
- [references/structured-data.md](references/structured-data.md) — read before adding JSON-LD: allowed types, the Organization block, Sovrium shorthand versus raw objects, validators.
- [references/social-previews.md](references/social-previews.md) — read before setting Open Graph or Twitter tags: per-platform rules, the image format matrix, cache refresh tools.
- [references/geo.md](references/geo.md) — read before promising anything about AI visibility: the evidence, the three edits, off-site presence, the vocabulary.
- [references/crawlers.md](references/crawlers.md) — read when the operator asks about AI bots: user agents, what each honours, the `Content-Signal` line.
- [references/report-template.md](references/report-template.md) — read before writing an audit report.
- [references/copy-for-search.md](references/copy-for-search.md) — read when writing the words: titles, descriptions, headings and passages.
- [references/seo-options.generated.md](references/seo-options.generated.md) — read for every SEO-related option of the binary you run; generated from it.
- [references/sources.md](references/sources.md) — the sources behind every tag above.
