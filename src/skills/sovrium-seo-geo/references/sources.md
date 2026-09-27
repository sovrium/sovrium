# Sources

## Contents

- Google Search Central (S1–S21)
- Standards and web.dev (S22–S24)
- Bing and IndexNow (S25–S28)
- Social platforms (S29–S37)
- llms.txt and agents (S38–S42, S48–S50)
- GEO research (S43–S47, S61, S72)
- Crawlers and content signals (S51–S60)
- Feeds and tooling (S62–S67)
- Skills this one learned from (S68–S71)
- Copy for search and answer engines

Each entry: title — organisation or author — URL — date — licence where known. "Lifted" is a paraphrase; nothing is copied verbatim. URLs were fetched or returned by search on 2026-09-24; entries still marked "not recorded" had no verified URL.

## Google Search Central (S1–S21)

- **S1 Search Essentials** — Google — https://developers.google.com/search/docs/essentials — 2025-12-10. Lifted: pages must be crawlable, indexable, useful; one clear main heading.
- **S2 Influencing title links** — Google — https://developers.google.com/search/docs/appearance/title-link — 2025-12-10. Lifted: unique, descriptive titles; brand as a delimited suffix; no documented length limit.
- **S3 Meta descriptions and snippets** — Google — https://developers.google.com/search/docs/appearance/snippet — date not recorded. Lifted: unique descriptions; no documented length limit; snippet controls.
- **S4 Block indexing with noindex** — Google — https://developers.google.com/search/docs/crawling-indexing/block-indexing — date not recorded. Lifted: noindex must be crawlable to be read; `X-Robots-Tag` for non-HTML files.
- **S5 Introduction to robots.txt; robots.txt specification** — Google — https://developers.google.com/search/docs/crawling-indexing/robots/intro and https://developers.google.com/search/docs/crawling-indexing/robots/robots_txt — date not recorded. Lifted: robots controls crawling, not indexing; 500 KiB limit; `Sitemap:` line.
- **S6 Build and submit a sitemap** — Google — https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap — date not recorded. Lifted: 50 000 URLs / 50 MB; `lastmod` only when accurate; `priority` and `changefreq` ignored.
- **S7 Sitemaps ping endpoint deprecation** — Google Search Central blog — https://developers.google.com/search/blog/2023/06/sitemaps-lastmod-ping — 2023-06-26. Lifted: the ping endpoint is retired; submit via Search Console.
- **S8 Localized versions of your pages** — Google — https://developers.google.com/search/docs/specialty/international/localized-versions — date not recorded. Lifted: hreflang absolute, bidirectional, self-referencing.
- **S9 x-default hreflang** — Google Search Central blog — https://developers.google.com/search/blog/2023/05/x-default — 2023-05. Lifted: `x-default` for the fallback version.
- **S10 Consolidate duplicate URLs** — Google — https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls — date not recorded. Lifted: absolute self-canonical, consistent with sitemap and links.
- **S11 Redirects and Google Search** — Google — https://developers.google.com/search/docs/crawling-indexing/301-redirects — date not recorded. Lifted: 301/308 permanent, 302/307 temporary, avoid chains.
- **S12 JavaScript SEO basics; lazy-loaded content** — Google — https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics and https://developers.google.com/search/docs/crawling-indexing/javascript/lazy-loading — date not recorded. Lifted: content in the initial HTML is safest; lazy loading must not hide content.
- **S13 Google Images SEO best practices** — Google — https://developers.google.com/search/docs/appearance/google-images — date not recorded. Lifted: descriptive alt text, dimensions, supported formats.
- **S14 Structured data general policies** — Google — https://developers.google.com/search/docs/appearance/structured-data/sd-policies (introduction: https://developers.google.com/search/docs/appearance/structured-data) — 2026-07-10. Lifted: mark up only visible, accurate content.
- **S15 Search gallery** — Google — https://developers.google.com/search/docs/appearance/structured-data/search-gallery — date not recorded. Lifted: only gallery types produce rich results.
- **S16 Search Central updates** — Google — https://developers.google.com/search/updates — FAQ rich result retirement announced 2026-05-08 (effective 2026-05-07), documentation removal 2026-06-15, llms.txt note. Lifted: FAQPage and HowTo earn no rich result.
- **S17 Organization structured data** — Google — https://developers.google.com/search/docs/appearance/structured-data/organization — date not recorded. Lifted: one Organization block; logo at least 112 × 112 px.
- **S18 Rich Results Test; Schema Markup Validator** — Google; schema.org — https://search.google.com/test/rich-results, https://validator.schema.org/ — date not recorded. Lifted: validate schema first, eligibility second.
- **S19 AI features and your website** — Google — https://developers.google.com/search/docs/appearance/ai-features — 2025-12-10. Lifted: no special markup needed for AI features; snippet controls apply.
- **S20 Optimizing for generative AI features** — Google — https://developers.google.com/search/docs/fundamentals/ai-optimization-guide — 2026-05-15, updated 2026-07-10. Lifted: llms.txt and markdown files not needed for Search.
- **S21 Google common crawlers (Google-Extended)** — Google — https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers — date not recorded. Lifted: Google-Extended is a training control token, not the AI Overviews crawler.

## Standards and web.dev (S22–S24)

- **S22 Sitemaps protocol** — sitemaps.org — https://www.sitemaps.org/protocol.html — date not recorded — CC BY-SA. Lifted: file limits and element definitions.
- **S23 Core Web Vitals** — web.dev (Google) — https://web.dev/articles/vitals — 2024-10-31 — CC BY 4.0. Lifted: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 at p75.
- **S24 Browser-level image lazy loading** — web.dev (Google) — https://web.dev/articles/browser-level-image-lazy-loading — 2024-08-13 — CC BY 4.0. Lifted: never lazy-load the LCP image; lazy-load the rest.

## Bing and IndexNow (S25–S28)

- **S25 Bing Webmaster Guidelines (JavaScript rendering)** — Microsoft Bing — https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a — date not recorded. _Unverified: the JavaScript-rendering point was read through a Botify summary, not on this page._ Lifted: server-rendered content is safest for Bing too.
- **S26 Keeping content discoverable with sitemaps in AI-powered search** — Microsoft Bing — https://blogs.bing.com/webmaster/July-2025/Keeping-Content-Discoverable-with-Sitemaps-in-AI-Powered-Search — 2025-07-31. Lifted: accurate `lastmod` matters for AI-powered search.
- **S27 IndexNow documentation and participants** — IndexNow — https://www.indexnow.org/documentation — date not recorded. Lifted: participating engines only; Google is not one.
- **S28 AI Performance report** — Microsoft Bing Webmaster Tools — https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview — 2026-02-10. Lifted: citation reporting for Microsoft surfaces.

## Social platforms (S29–S37)

- **S29 The Open Graph protocol** — ogp.me — https://ogp.me/ — date not recorded. Lifted: the four required properties; `og:locale`.
- **S30 Sharing images best practices** — Meta for Developers — https://developers.facebook.com/docs/sharing/webmasters/images/ (overview: https://developers.facebook.com/docs/sharing/webmasters/) — date not recorded. Lifted: 1200 × 630, 1.91:1, size limit.
- **S31 Sharing Debugger** — Meta — https://developers.facebook.com/tools/debug/ — date not recorded. Lifted: inspect and refresh a cached preview.
- **S32 Meta web crawlers** — Meta for Developers — https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/ — date not recorded. Lifted: Meta's crawler user agents.
- **S33 Cards markup** — X — https://developer.x.com/en/docs/x-for-websites/cards/overview/markup — date not recorded. _The official page was unreachable during research; content from secondary references._ Lifted: `summary_large_image`, fallback to Open Graph, 2:1 crop.
- **S34 Card Validator removal** — X developer community thread — https://devcommunity.x.com/t/card-validator-preview-removal/175006 — 2022. Lifted: no public validator.
- **S35 Post Inspector** — LinkedIn Help — https://www.linkedin.com/help/linkedin/answer/a6233775 — date not recorded. Lifted: inspect and refresh LinkedIn previews.
- **S36 Can I safely use AVIF or WebP share images?** — Joost de Valk — https://joost.blog/use-avif-webp-share-images/ — December 2024 test. Lifted: WebP renders widely; AVIF fails on X, LinkedIn, Slack, iMessage.
- **S37 Unfurling links** — Slack API docs — https://docs.slack.dev/messaging/unfurling-links-in-messages/ — date not recorded. Lifted: Slack reads Open Graph and Twitter tags; previews are cached.

## llms.txt and agents (S38–S42, S48–S50)

- **S38 The llms.txt proposal** — llmstxt.org — https://llmstxt.org/ — modified 2026-08-10. Lifted: H1, blockquote summary, H2 link sections; `llms-full.txt` is not part of the proposal.
- **S39 llms.txt study** — Ahrefs — https://ahrefs.com/blog/llmstxt-study/ — 2026-06-15. Lifted: 97 % of files never fetched in the study window.
- **S40 Google does not endorse llms.txt** — Search Engine Roundtable — https://www.seroundtable.com/google-does-not-endorse-llms-txt-40789.html — 2026-01-20. Lifted: Google's stated position.
- **S41 Google's llms.txt guidance depends on which product you ask** — Search Engine Journal — https://www.searchenginejournal.com/googles-llms-txt-guidance-depends-on-which-product-you-ask/575431/ — 2026-05-20. Lifted: Search versus developer-documentation positions differ.
- **S42 Agentic browsing scoring** — Lighthouse — https://developer.chrome.com/docs/lighthouse/agentic-browsing/scoring — 2026-05-05. Lifted: agent-readiness is a separate question from citations.
- **S48 Markdown for Agents; reference page** — Cloudflare — https://blog.cloudflare.com/markdown-for-agents/ and https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/ — 2026-02-12. Lifted: markdown negotiation with `Accept: text/markdown` and `Vary: Accept`.
- **S49 Markdown and Agent Discovery** — Vercel — https://vercel.com/docs/agent-resources/markdown-access — 2026-09-17. Lifted: `rel="alternate" type="text/markdown"` discovery.
- **S50 llms.txt documentation** — Mintlify — https://www.mintlify.com/docs/ai/llmstxt — date not recorded. Lifted: `llms-full.txt` as a tool convention.

## GEO research (S43–S47, S61, S72)

- **S43 GEO: Generative Engine Optimization** — Aggarwal et al. — https://arxiv.org/abs/2311.09735 — KDD 2024 — CC BY 4.0. Lifted: the measured effects of quotations, statistics, fluency, citations, keyword stuffing.
- **S44 AI Visibility Index 2026** — Semrush — https://www.semrush.com/news/463141-semrush-releases-expanded-2026-ai-visibility-index-analyzing-126-million-ai-search-prompts/ — 2026-06-26. Lifted: mentions and citations are separate outcomes.
- **S45 AI Overview brand correlation study** — Ahrefs — https://ahrefs.com/blog/ai-overview-brand-correlation/ — date not recorded. Lifted: brand mentions 0.66 vs backlinks 0.22 (correlational).
- **S46 AI Overview citations versus top-10 rankings** — Ahrefs — https://ahrefs.com/blog/ai-overview-citations-top-10 — July 2025, revised March 2026. Lifted: 76 % then 38 %.
- **S47 Schema markup and AI citations test** — Ahrefs, known through secondary reporting only — URL not recorded — date not recorded. Lifted: no significant effect found.
- **S61 GEO metrics** — Search Engine Land — https://searchengineland.com/geo-metrics-to-track-476642 — 2026. Lifted: mention, citation, share-of-voice vocabulary.
- **S72 Guidance on being cited in AI answers** — Microsoft Bing — https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview (the same post as S28, where the copy research found this guidance) — 2026-02-10. Lifted: depth, headings and tables, evidence, freshness.

## Crawlers and content signals (S51–S60)

- **S51 OpenAI crawlers** — OpenAI — https://developers.openai.com/api/docs/bots — date not recorded. Lifted: GPTBot, OAI-SearchBot, ChatGPT-User and what each honours.
- **S52 Anthropic crawlers** — Anthropic — https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler — date not recorded. Lifted: ClaudeBot, Claude-SearchBot, Claude-User.
- **S53 Perplexity bots; Cloudflare delisting report** — Perplexity docs; Search Engine Journal — https://docs.perplexity.ai/guides/bots and https://www.searchenginejournal.com/cloudflare-delists-and-blocks-perplexity-from-crawling-websites/552899/ — date not recorded. Lifted: PerplexityBot, Perplexity-User; disputed compliance.
- **S54 About Applebot** — Apple — https://support.apple.com/en-us/119829 — date not recorded. Lifted: Applebot and Applebot-Extended.
- **S55 CCBot** — Common Crawl — https://commoncrawl.org/ccbot — date not recorded. Lifted: user agent and robots compliance.
- **S56 Bytespider** — no official documentation — date not recorded. Lifted: compliance disputed.
- **S57 Pay per crawl; Content Independence Day** — Cloudflare — https://blog.cloudflare.com/introducing-pay-per-crawl/ and https://blog.cloudflare.com/content-independence-day-no-ai-crawl-without-compensation/ — 2025-07-01. Lifted: edge-level crawl control exists outside config.
- **S58 Content Signals Policy** — Cloudflare — https://blog.cloudflare.com/content-signals-policy/ — 2025-09-24 — CC0. Lifted: `search`, `ai-input`, `ai-train` signals; advisory only.
- **S59 AIPREF drafts (vocabulary -08, attachment -05)** — IETF AIPREF working group — https://datatracker.ietf.org/doc/draft-ietf-aipref-vocab/ and https://datatracker.ietf.org/doc/draft-ietf-aipref-attach/ — 2026-09-14 and 2026-08-19. Lifted: no consensus; not a standard.
- **S60 ai.txt** — Spawning — https://spawning.substack.com/p/aitxt-a-new-way-for-websites-to-set — 2023. Lifted: an unadopted proposal.

## Feeds and tooling (S62–S67)

- **S62 RSS autodiscovery** — RSS Advisory Board — https://www.rssboard.org/rss-autodiscovery — date not recorded. Lifted: `<link rel="alternate" type="application/rss+xml">` in the head.
- **S63 Lighthouse 12 removes the PWA category** — Chrome for Developers — URL not recorded — 2024-04-22. Lifted: a manifest is not an SEO factor.
- **S64 Lighthouse CLI** — Google — https://github.com/GoogleChrome/lighthouse — date not recorded. Lifted: scripted audits.
- **S65 Chrome DevTools MCP** — Chrome DevTools team — https://github.com/ChromeDevTools/chrome-devtools-mcp — date not recorded — Apache-2.0. Lifted: `lighthouse_audit` from an agent.
- **S66 PageSpeed Insights API v5** — Google — https://developers.google.com/speed/docs/insights/v5/get-started — date not recorded. Lifted: field data from the Chrome UX Report.
- **S67 Screaming Frog SEO Spider (free tier)** — Screaming Frog — https://www.screamingfrog.co.uk/seo-spider/ — date not recorded. Lifted: crawling up to its free limit for site-wide checks.

## Skills this one learned from (S68–S71)

- **S68 seo-aeo-best-practices** — Sanity — https://github.com/sanity-io/agent-toolkit/tree/main/skills/seo-aeo-best-practices — date not recorded. Lifted: a hub `SKILL.md` with topic references.
- **S69 claude-seo** — AgriciDaniel — https://github.com/AgriciDaniel/claude-seo — v2.4.0, September 2026 — MIT. Lifted: graded per-page report, checking the rendered page, scepticism about llms.txt, passage-sized sections.
- **S70 seo-geo skills** — aaron-he-zhu — https://github.com/aaron-he-zhu/seo-geo-claude-skills — date not recorded. Lifted: Survey → Implement → Evaluate.
- **S71 web-interface-guidelines** — Vercel — https://github.com/vercel-labs/web-interface-guidelines — date not recorded — MIT. Lifted: findings as `file:line` plus a rule id.

## Copy for search and answer engines

`references/copy-for-search.md` is written in this skill's own words. Google and Microsoft
documentation is paraphrased and attributed; the GEO paper is CC BY 4.0 and its figures are
quoted with attribution; claude-seo is MIT and its answer-block pattern is adapted with
attribution. Figures that depend on a single study are labelled as such in the reference.

| Source                                                                  | Author / org            | URL                                                                                                                                                                          | Date               | Licence                                      | What was lifted (paraphrased)                                                                                                                                                                           |
| ----------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Influencing your title links in search results                          | Google Search Central   | https://developers.google.com/search/docs/appearance/title-link                                                                                                              | updated 2025-12-10 | Paraphrase only (Google documentation terms) | Unique, descriptive titles; brand as a delimited suffix; no keyword stuffing or boilerplate; no published length limit, truncation by display width                                                     |
| Control your snippets in search results (meta descriptions)             | Google Search Central   | https://developers.google.com/search/docs/appearance/snippet                                                                                                                 | updated 2025-12-10 | Paraphrase only                              | Unique, specific descriptions per page; generated per record where pages are templated; Google may show page text instead; no length limit                                                              |
| Google Images SEO best practices                                        | Google Search Central   | https://developers.google.com/search/docs/appearance/google-images                                                                                                           | —                  | Paraphrase only                              | Descriptive alternative text, not stuffed; descriptive file names                                                                                                                                       |
| AI features and your website                                            | Google Search Central   | https://developers.google.com/search/docs/appearance/ai-features                                                                                                             | 2025-12-10         | Paraphrase only                              | No special markup or optimisation for AI features; the same helpful-content practices apply                                                                                                             |
| Top ways to ensure your content performs well in generative AI features | Google Search Central   | https://developers.google.com/search/docs/fundamentals/ai-optimization-guide (the verified URL of Google's generative-AI guidance; the blog post's own URL was not recorded) | 2026-05-15         | Paraphrase only                              | No special optimisation; unique, non-commodity content that satisfies the reader                                                                                                                        |
| Sharing best practices for websites                                     | Meta for Developers     | https://developers.facebook.com/docs/sharing/webmasters/                                                                                                                     | —                  | Paraphrase only                              | `og:description` of two to four sentences; social title distinct from the page title                                                                                                                    |
| GEO: Generative Engine Optimization                                     | Pranjal Aggarwal et al. | https://arxiv.org/abs/2311.09735                                                                                                                                             | KDD 2024           | CC BY 4.0                                    | Measured effects on generative-engine visibility: quotations about +41 %, statistics about +33 %, citing sources positive, keyword stuffing about −9 %; one synthetic engine; later replications weaker |
| claude-seo                                                              | AgriciDaniel            | https://github.com/AgriciDaniel/claude-seo                                                                                                                                   | read 2026-09       | MIT                                          | Self-contained answer blocks of about 130–170 words; question-phrased headings                                                                                                                          |
| Introducing AI Performance                                              | Microsoft Bing          | https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview                                                             | 2026-02-10         | Paraphrase only                              | Depth, clear headings and tables, evidence and freshness as signals for content cited in AI answers                                                                                                     |

### Dropped

- None of the supplied copy sources was dropped.
