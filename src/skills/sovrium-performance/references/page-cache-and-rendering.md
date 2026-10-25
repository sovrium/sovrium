# The page cache and rendering

Sovrium renders every page on the server and mounts interactive islands afterwards. For a page whose HTML cannot vary between requests, the render is done once and served from memory to every anonymous visitor after that. Whether a page qualifies is **derived from what it reads, never declared**: there is no key to set. Manual: `sovrium docs operations/database-infrastructure`.

## Contents

- [The three verdicts](#the-three-verdicts)
- [What keeps a page out of the cache](#what-keeps-a-page-out-of-the-cache)
- [The headers, case by case](#the-headers-case-by-case)
- [Splitting a page so most of it caches](#splitting-a-page-so-most-of-it-caches)
- [Islands and the stylesheet](#islands-and-the-stylesheet)
- [Static assets](#static-assets)

## The three verdicts

| Verdict | Meaning                                                                        | Served                                                                              |
| ------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| static  | The rendered HTML cannot vary by request                                       | From memory after the first anonymous render                                        |
| content | Its only input outside the config is a folder of markdown files (`contentDir`) | From memory, keyed also by a checksum of that folder; editing a file invalidates it |
| dynamic | Anything else                                                                  | Rendered on every request; never kept                                               |

- The cache answers **anonymous, non-preview requests only**. A signed-in request is always rendered fresh, so one reader's view can never reach another.
- The check reads the page **as it renders**: every reusable template placed through `$ref` or `component`, at any depth, and every breakpoint's `responsive.<breakpoint>.children`. A binding hidden in a template still makes the page dynamic.
- A template whose only inputs are the vars its reference passes stays cacheable.
- The operator can switch the cache off and size it (`ECO_PAGE_CACHE`, `ECO_PAGE_CACHE_MAX_MB`: see `eco-levers.md`). Switching it off makes every page render per request.

## What keeps a page out of the cache

Any one of these makes a page dynamic:

| Signal                                                                                                               | Why it varies                                               |
| -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| A `dataSource` on the page or on any component it renders                                                            | It reads the database                                       |
| `access` other than everyone                                                                                         | An anonymous request is redirected or refused, not rendered |
| `collection`, `source`, an invitation page                                                                           | Each reads records, a file or the token in the address      |
| A `:param` path with no `contentDir` behind it                                                                       | Nothing can prove the render is the same for every value    |
| `presence: true`                                                                                                     | Real-time presence                                          |
| A data-bound `layout.sidebar`                                                                                        | Its entries come from the database                          |
| A sidebar that remembers its fold                                                                                    | Read back from the reader's cookie                          |
| `$app.origin` anywhere                                                                                               | It prints the host this request arrived on                  |
| `$currentUser.` or `$user.` references, or a visibility rule on being signed in, a role, a capability or a condition | The output depends on the reader                            |
| A form starting from `$query.<name>` or `$now` (its prefill, a field default, or the placing component's prefill)    | The output depends on the request                           |
| A two-step code form                                                                                                 | It reads the waiting sign-in from the cookie                |

A visibility rule that reads only what the config declares, the runtime, or the address's query values does not make a page differ by reader.

## The headers, case by case

Every page response carries `X-Render-Cache` and `Cache-Control`:

| Case                                                                                   | `X-Render-Cache`   | `Cache-Control`                                                                                   |
| -------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------- |
| A static or content page, first anonymous request                                      | `miss`             | `public, max-age=300`                                                                             |
| The same page again                                                                    | `hit` (same bytes) | `public, max-age=300`                                                                             |
| An anonymous render of a page that reads table data, or differs by reader              | `bypass`           | `public, no-cache`, with a weak `ETag`: a repeat visit gets an empty `304` until a record changes |
| An anonymous render of another dynamic page (a `:param` route, presence with no table) | `bypass`           | `public, max-age=60, stale-while-revalidate=300`                                                  |
| An invitation page                                                                     | `bypass`           | `private, no-store`                                                                               |
| A signed-in or preview render                                                          | `bypass`           | `private, no-cache`                                                                               |
| The cache switched off                                                                 | `bypass`           | `private, no-cache`                                                                               |

Read them with `curl -sI <url>` twice, anonymously: a static page goes `miss` then `hit`. A `bypass` is not a fault; it is the verdict, and the table above says why. [S7][S18]

## Splitting a page so most of it caches

- **A landing page with one live widget** (a record count, a latest-items list): the widget's binding makes the whole page dynamic. Move the live part to the page that needs it, or accept the revalidated render — with `no-cache` and an `ETag` a repeat visit costs an empty `304`.
- **A public listing of records** is meant to be fresh: a visitor who just submitted a form sees their entry on the next visit. Make each render cheap (pagination, indexes; `data-and-queries.md`) rather than trying to cache it.
- **Docs and articles** belong in a `contentDir` collection: they cache as content pages and refresh when a file changes.
- **Never print `$app.origin`** on a page that should cache; set the operator's `BASE_URL` so links are absolute without reading the request.

## Islands and the stylesheet

- Server-drawn components (text, cards, a container repeating its children per row, a list without an item template) ship no client code. Interactive components — a data grid, a calendar, a chart, a rich-text or code editor, a chat — mount as islands with their own code and their own data requests.
- A data grid's rows can load after the page; what you want visible at first paint, or indexed by a crawler, belongs in a server-drawn component.
- Heavy editors load lazily. Place an interactive component only where the page's job needs it.
- The app has one compiled stylesheet holding only the component types its pages use and the classes it writes, so moving between pages fetches no second stylesheet. A type the config never places adds nothing to it.

## Static assets

Content-hashed assets (island code, chunks, fonts) are served `public, max-age=31536000, immutable`; a new release changes their names. Transformed images are cached the same way (`images.md`). There is nothing to configure here; check it with `curl -sI` on an asset URL when a cache header looks wrong.
