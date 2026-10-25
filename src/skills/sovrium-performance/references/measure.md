# Measure

Measure before advising, and again after. Field data shows whether real visitors are affected; lab data and response headers explain why; reading the config only suggests a cause. Keep the conditions identical between the before and the after, or the comparison means nothing. [S2][S3]

## Contents

- [Headers: what the server did](#headers-what-the-server-did)
- [Size and time with curl](#size-and-time-with-curl)
- [In the browser](#in-the-browser)
- [Field data](#field-data)
- [The database](#the-database)
- [The page record](#the-page-record)

## Headers: what the server did

Anonymously, twice, so the second request can hit the cache:

```bash
curl -sI https://app.example.com/pricing | grep -iE 'x-render-cache|cache-control|etag|x-eco-index'
curl -sI https://app.example.com/pricing | grep -iE 'x-render-cache|cache-control|etag|x-eco-index'
```

| You see                                                    | It means                                                                        |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `miss` then `hit`, `public, max-age=300`                   | A cached page; slowness is elsewhere (images, islands, the network)             |
| `bypass`, `public, no-cache` and an `ETag`                 | Reads table data or differs by reader; rendered per request — look at the query |
| `bypass`, `public, max-age=60, stale-while-revalidate=300` | A dynamic page that reads no table (a `:param` route, presence)                 |
| `bypass`, `private, no-cache`                              | A signed-in or preview render, or the operator switched the cache off           |
| `X-Eco-Index: <letter>`                                    | The grade of this response's transfer size, A to G, when the operator has it on |

Repeat a revalidated page with its tag: an empty `304` means a repeat visit is cheap until a record changes.

```bash
etag=$(curl -sI https://app.example.com/products | awk -F': ' 'tolower($1)=="etag"{print $2}' | tr -d '\r')
curl -s -o /dev/null -w '%{http_code}\n' -H "If-None-Match: $etag" https://app.example.com/products
```

As a signed-in user, pass the session cookie from the browser (`-H 'Cookie: …'`); expect `bypass` and `private, no-cache` on every page.

## Size and time with curl

```bash
curl -s -o /dev/null -H 'Accept-Encoding: gzip, br' \
  -w 'status %{http_code}  bytes %{size_download}  ttfb %{time_starttransfer}s  total %{time_total}s\n' \
  https://app.example.com/products
```

- Run it a few times and keep the median; a first request may include a cold render.
- For an image, compare the original with the variant the page asks for: `?format=origin` against no format with `-H 'Accept: image/webp'`, and against `?width=<slot width>`.
- Against a local server, use `127.0.0.1` and the port `sovrium start` printed.

## In the browser

With a browser MCP or DevTools open on the page:

- **Network panel**, cache disabled for the first load and enabled for the second: total transferred bytes, request count, the largest requests, and which come from islands after the HTML.
- **Performance panel trace**: the LCP element and when it painted, long tasks on the main thread, layout shifts and what caused them.
- **Lighthouse** (DevTools, or the Chrome DevTools MCP's audit when present) for a lab run under stated throttling. A score is a guardrail, not a goal; read the diagnostics it lists. [S11]
- Check the rendered `<img>` tags: `loading`, `fetchpriority`, `width`, `height` and the URL each one requests.

## Field data

For a public origin with enough traffic:

- **PageSpeed Insights** shows the Chrome UX Report's field data for the page or the origin beside a lab run. [S12]
- **Chrome UX Report** directly, for history. [S5]

Field data lags: after a fix, say "field data pending" with the date to look again. Never compare one lab value with a field percentile as if they were the same measurement. Core Web Vitals thresholds are `sovrium-seo-geo`'s.

## The database

Reproduce the slow request's query on the records API (`/api/tables/<table>/records?filter=…&sort=…&limit=…`) and time it with the curl line above. To see whether an index is used, run the query plan on the database itself — `EXPLAIN` on PostgreSQL, `EXPLAIN QUERY PLAN` on SQLite — against a copy of production data, never against production during peak hours.

## The page record

One block per page in the report; the page verdict is yours, A to F, and is not the server's `X-Eco-Index` letter.

```markdown
### <route> — verdict <A–F>

Visitor: anonymous | signed in as <role> · Conditions: <device, throttling, origin>
Cache: <miss→hit | bypass + no-cache/ETag | bypass + max-age=60 | private> — because <signal>
Transfer: <bytes> · Requests: <n> · TTFB: <s> · X-Eco-Index: <letter or "off">
LCP element: <element> (<eager/lazy>, <format>) · Islands on the page: <list>
Bindings: <table, pagination or limit, filter fields, index present yes/no>
Findings: <rule ids, most costly first>
After: <same lines, re-measured> · Field data: <value, or "pending until <date>">
```

Verdict scale, judged from the measurements: **A** nothing worth changing · **B** one small lever left · **C** a HIGH finding · **D** a CRITICAL finding · **E** several CRITICAL findings · **F** the page fails its job for some visitors.
