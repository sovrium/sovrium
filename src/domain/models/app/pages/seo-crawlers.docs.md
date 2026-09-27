# Crawlers, Sitemaps & Feeds

> The machine-readable files every app serves — `/sitemap.xml`, `/robots.txt`, `/feed.xml` and each article's Markdown twin — what decides their contents, and what `sovrium build` writes.

A search engine, a feed reader and an AI assistant each read an app through a small set of well-known files. Sovrium derives every one of them from the config you already wrote: there is nothing to generate by hand, and nothing to keep in sync.

| Address                       | Served when                             | Contents                                                                  |
| ----------------------------- | --------------------------------------- | ------------------------------------------------------------------------- |
| `/sitemap.xml`                | Always                                  | One `<url>` per indexable page and public record, or an index past 5 000  |
| `/robots.txt`                 | Always                                  | A crawl policy and the absolute address of the sitemap                    |
| `/feed.xml`                   | A public collection page declares `rss` | An RSS 2.0 feed of that collection's newest records                       |
| `<article>.md`                | Every content-directory article         | The article's Markdown, frontmatter removed                               |
| `/llms.txt`, `/llms-full.txt` | The app has a content-directory page    | An index and a concatenation for AI assistants — see **Publish llms.txt** |

## Set `BASE_URL` first

Every URL in these files is absolute, and a crawler trusts the origin it is given. Sovrium takes that origin from the `BASE_URL` environment variable; without it, it falls back to the host the request arrived on, which behind a reverse proxy may be an address nobody outside can reach.

The same variable decides whether a page publishes `hreflang` alternates at all. A page with an absolute `canonical` takes its origin from that URL; otherwise `BASE_URL` supplies it (`SOVRIUM_BASE_URL` during `sovrium build`); and with neither, the page emits **no** alternates, because search engines reject relative ones. A multi-language app started without `BASE_URL` prints one boot warning saying so — set it.

## `/sitemap.xml`

A page is listed when it is anonymously readable, not `noindex`, not opted out with `sitemap: false`, and not under a path starting with `/_`. A content-directory page fans out to one entry per Markdown file, and a multi-language app lists each page once per language, with `hreflang` alternates and an `x-default` pointing at the default language.

```yaml
name: my-site
pages:
  - name: Home
    path: /
    sitemap: { priority: 1.0, changefreq: weekly }
    components:
      - { type: text, element: h1, content: 'Home' }
  - name: Thank you
    path: /thanks
    sitemap: false
    components:
      - { type: text, element: h1, content: 'Thanks for signing up' }
```

**`priority` and `changefreq` are hints Google ignores.** They are kept because other engines still read them, but they do not change how often Google crawls or how it ranks a page. What Google does use is `lastmod` — and only from a site whose dates it has found to be accurate — so Sovrium writes one only when it knows it: a content-directory article carries its Markdown file's modification time, as a full ISO 8601 timestamp such as `2026-03-14T09:26:53Z`. A page declared in config has no date the engine could know, so its entry carries no `lastmod` at all rather than a false one.

A collection page such as `/blog/:slug` fans out to one entry per record, at the record's resolved slug — but only when an anonymous visitor could read the record: its table must declare `permissions: { read: all }` and no row-level read rule, the field the address is built from must be readable by everyone too (a `permissions.fields` entry restricting it keeps every record out), deleted records are left out, and the page's own `collection.filter` applies. Records are read in pages of 5 001 rows, at most ten pages per collection. A record's `lastmod` is its `updated-at` field, when the table has one. A collection over a table that needs a session contributes nothing, because a crawler would be answered 404. A `sovrium build` lists the same records, read from the database it is pointed at — see below.

**The sitemap is cached for 60 seconds.** Every `/sitemap.xml` and `/sitemap-N.xml` answer is computed once and served unchanged for a minute, so a record added or deleted appears at most a minute later; restarting or reloading the app starts a fresh cache.

Past 5 000 URLs, `/sitemap.xml` becomes a `<sitemapindex>` naming `/sitemap-1.xml`, `/sitemap-2.xml` and so on by absolute address, each holding at most 5 000 entries. The protocol allows 50 000; the lower split keeps each response small.

## `/robots.txt`

```text
User-agent: *
Allow: /
Disallow: /_preview
Sitemap: https://example.com/sitemap.xml
```

Every crawler is allowed everywhere, with one `Disallow` line per page whose path starts with `/_`, followed by the absolute sitemap address.

**A `noindex` page is deliberately not Disallowed.** A page refused in `robots.txt` is never fetched, so a crawler would never see its `noindex` tag — and a URL it already knows from a link could stay in the index, shown without a description. Leaving the page crawlable is what lets the tag take effect, so marking a page `noindex` is enough to keep it out of search results.

**Sovrium has no per-crawler policy.** The file names one user agent, `*`, and there is no option to write another. That matters for AI crawlers, which identify themselves with their own tokens and split into two kinds: crawlers that fetch a page to answer a question in real time (`OAI-SearchBot`, `Claude-SearchBot`, `PerplexityBot`) and crawlers that collect text to train a model (`GPTBot`, `ClaudeBot`, `CCBot`, `Bytespider`, plus the `Google-Extended` and `Applebot-Extended` tokens, which control training use without a separate crawler). Every one of them reads `User-agent: *` today, so a Sovrium app allows all of them. A request for a particular policy is not honoured by every crawler either way: `robots.txt` is a request, not an access control.

## `/feed.xml`

A collection page that declares `rss` publishes its newest records as an RSS 2.0 feed — `rss: true` for the default twenty items, or `rss: { limit: 25 }`. The route answers 404 when no page opts in. The page the feed is built from announces it in its head with `<link rel="alternate" type="application/rss+xml">`, titled like the feed's channel, so a feed reader given the page's address discovers the feed on its own. Other pages announce nothing.

Only a page anyone may open can publish the feed: a page whose `access` requires signing in or a role never builds it, even for a reader who is signed in, because `/feed.xml` is one publicly cached document for every reader. When a public page also declares `rss`, the feed is built from the first one; when none does, the route answers 404, never 403, so the existence of a restricted feed is not revealed.

## Markdown twins

Every content-directory article is also served as Markdown: append `.md` to its address, or request the article itself with `Accept: text/markdown`. The body is the file with its frontmatter removed, and an article the visitor may not read answers 404 in both forms. The Markdown of a public article may be cached by a shared cache for five minutes; the Markdown of an article whose page is restricted by `access` carries the same `private, no-cache` policy as its HTML, so no shared cache can store one reader's copy and serve it to another. Because one URL answers two bodies, both the HTML and the negotiated Markdown carry `Vary: Accept`, so a cache or CDN in front of the app keeps them apart. An article on a `noindex` page answers with `X-Robots-Tag: noindex` in both Markdown forms, since a Markdown body has nowhere to carry the meta tag — a static host cannot send that header, so keep a withheld collection off a static build.

These twins exist for AI assistants and for readers who want the source. They are not a search signal — Google has said it does not need Markdown files or `llms.txt` to index a site — but every article announces its own twin in its head with `<link rel="alternate" type="text/markdown">`, so an agent reading the HTML can find the Markdown without guessing the address.

## What `sovrium build` writes

A static build renders every public page to HTML and, on request, the files around it:

| File                        | Written when                           |
| --------------------------- | -------------------------------------- |
| `sitemap.xml`               | `SOVRIUM_GENERATE_SITEMAP=true`        |
| `sitemap-1.xml`, …          | The sitemap passes 5 000 addresses     |
| `blog/<slug>.html`, …       | A record the sitemap lists             |
| `robots.txt`                | `SOVRIUM_GENERATE_ROBOTS=true`         |
| `llms.txt`, `llms-full.txt` | The app would serve them               |
| `<article>.md`              | Every public content-directory article |

The build takes its origin from `SOVRIUM_BASE_URL`, not `BASE_URL`. Each article's `.md` twin is written beside its HTML, at the address the server answers, so a static host serves `/docs/getting-started.md` as the server does. It does **not** write `feed.xml`, which exists only on a running server.

With the sitemap on, the build reads the records of every collection page from the database it runs against — `DATABASE_URL`, as for `sovrium start` — under the same rules as the served sitemap above: a table everyone may read, no row-level read rule, an address field everyone may read, deleted records left out, the same 5 001-row pages and the same ceiling. It reads them once and uses that one read twice: each record gets a `<url>` in `sitemap.xml`, and each record's page is rendered and written, at the address it is listed at (`/blog/pricing-change` becomes `blog/pricing-change.html`). So every address the built sitemap advertises is a file a static host can answer, and for the same records the built `sitemap.xml` is the document the running server serves, `lastmod` included. Past 5 000 addresses the build writes the index and its `sitemap-N.xml` children beside it. Record pages are written as rendered, without the whitespace formatting applied to declared pages, since a table of thousands of rows would otherwise spend minutes re-indenting them. A collection whose route carries more than one parameter, besides `:lang`, lists no record and writes no record page. Without the sitemap the build reads no record and writes no record page.

## Related reading

- **SEO & Metadata** — `noindex`, `canonical` and the social tags a crawler reads from each page.
- **Publish llms.txt** — the index and corpus files for AI assistants.
- **Languages** — the language codes `hreflang` alternates are built from.
- **Collection & Markdown Pages** — content directories and record pages.
- **Environment variables** — `BASE_URL` and the build variables.
