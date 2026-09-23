# Routing & Paths

> How a page path resolves — static routes, dynamic `:param` segments, record detail routes, wildcards, trailing slashes and the language segment.

A page's `path` is the URL it answers. It is matched literally unless it contains a `:param` or `*` segment, in which case it becomes a pattern.

## Path forms

| Form      | Example             | Matches                                                                   |
| --------- | ------------------- | ------------------------------------------------------------------------- |
| Root      | `/`                 | The home page.                                                            |
| Static    | `/about`            | That exact path, and nothing else.                                        |
| Nested    | `/settings/billing` | Any number of static segments.                                            |
| Dynamic   | `/blog/:slug`       | One segment, captured as `slug`.                                          |
| Catch-all | `/docs/:rest*`      | The remainder of the path, captured as `rest` — must be the last segment. |
| Wildcard  | `/files/*`          | Anything below `/files/`, captured under no name.                         |

A path starts with `/` and allows **only lowercase letters**. `/users/:userId` is rejected — write `/users/:userid`, or better, `/users/:id`.

**A path with no `:` and no `*` is compared as an exact string.** There is no prefix matching: `/about` is not the same route as `/about/`. A request carrying a trailing slash is not lost, though — it is normalized away with a `301` and resolved again, so `/about/` reaches `/about`.

## Dynamic segments

A `:param` segment captures exactly one path segment — it never spans a `/`. `/blog/:slug` matches `/blog/hello` but not `/blog/2026/hello`; use `/blog/:slug*` for the latter.

Dynamic routes are usually paired with a `collection` block, so one page definition generates a route per record:

```yaml
name: my-blog
tables:
  - name: posts
    fields:
      - { name: title, type: single-line-text }
      - { name: slug, type: single-line-text }
pages:
  - name: Blog Post
    path: /blog/:slug
    collection: { table: posts, slugField: slug }
    components:
      - { type: text, element: h1, content: '$record.title' }
```

**Collection & Markdown Pages** documents the `collection` contract.

## Record detail routes

To serve one record at a URL without generating a route per record, pair a dynamic segment with a `single`-mode data source. `param` names the path segment to read the record id from:

```yaml
name: my-app
tables:
  - name: tasks
    fields:
      - { name: title, type: single-line-text }
      - { name: description, type: long-text }
pages:
  - name: Task
    path: /tasks/:id
    dataSource:
      table: tasks
      mode: single
      param: id
    components:
      - { type: text, element: h1, content: '$record.title' }
      - { type: text, content: '$record.description' }
```

A request whose parameter matches no record returns a `404`.

**`$id` is not a path syntax.** `$` is not a legal character in a `path`, so `/tasks/$id` fails validation. The dynamic-segment marker is `:` everywhere; `$record.*` is a _content_ reference, not a route one.

## The language segment

Sovrium never prefixes a path that already resolves. When `languages` is configured, the runtime reads the **first path segment**, and if it matches a configured language code it becomes the active language for `$t:` translation lookups.

Localized routes are therefore authored explicitly — one page per language, each carrying its own segment:

```yaml
name: my-app
pages:
  - { name: home-en, path: /en, components: [{ type: text, content: '$t:home.title' }] }
  - { name: home-fr, path: /fr, components: [{ type: text, content: '$t:home.title' }] }
```

The one place a prefix is _added_ is the 404 branch. An unprefixed path that resolves under no page, but would resolve once prefixed, is answered with a `302` to the prefixed path instead of a `404`. See **Languages**.

## Trailing slashes

Page paths are authored without a trailing slash, and that slash-free form is canonical: it is what every internal link, `hreflang` alternate and sitemap entry the engine emits points at. A request that arrives with a trailing slash is normalized toward it with a `301`, then resolved again.

| Request     | Answer                                                  |
| ----------- | ------------------------------------------------------- |
| `/about/`   | `301` to `/about`                                       |
| `/en/docs/` | `301` to `/en/docs` — the arriving locale is kept       |
| `/docs//`   | `301` to `/docs` — repeated slashes collapse in one hop |
| `/`         | `200` — the root is exempt                              |
| `/en/`      | `200` — the bare language root is exempt                |
| `/nope/`    | `404`, with no `Location`                               |

The incoming query string is carried onto the target byte-identically, so campaign attribution on an inbound link survives the hop.

**The two exemptions are not cosmetic.** `/en` already redirects **to** `/en/`, so stripping `/en/` back to `/en` would bounce the browser between the two forever. Only the _bare_ language root is exempt — `/en/docs/` is normalized like any other path.

**The canonical form must resolve.** A `301` is emitted only when the slash-free path actually answers — directly, or through the unprefixed-path fallback. `/nope/` therefore stays a clean `404` rather than becoming a `301` into a `404`, which burns the redirect, still fails, and walks a crawler into a dead end.

A page may also be authored _with_ a trailing slash: a `path` of `/docs/` is legal, and a request to `/docs/` is then served in place rather than stripped. The config is the authority.

**Canonicalization never reveals a page you cannot read.** A canonicalizing `301` or `302` fires only toward a page an anonymous visitor may open. If `/vault` is role-gated, `/vault/` answers `404` — byte-identical to the answer for a path that was never declared. Redirecting would announce that `/vault` exists, which is exactly the fact its own `404` is there to hide. The cost is that the convenience does not extend to gated pages for anyone, signed in or not: the check runs in the router, which has no session.

## Resolution order

An incoming request is answered by the first of these that matches:

1. A real file in the public directory.
2. A redirect rule.
3. A page path — compared exactly, including a trailing slash the `path` was authored with.
4. Trailing-slash normalization — a `301` to the slash-free path, when that path resolves.
5. The unprefixed-path language fallback — a `302` to the prefixed path, when that one resolves.
6. The 404 catch-all.

Steps 4 and 5 run only where step 3 declined, so every URL that resolves today keeps resolving byte-identically. They also compose: `/docs/` is answered `301` to `/docs`, and the follow-up request is answered `302` to `/en/docs`.

Both are **server mode only**. `sovrium build` emits no redirects of any kind, so a statically hosted site answers `/about/` and `/docs` with whatever its host is configured to do.

## Redirecting to the first object

A collection path whose objects each open onto their own page has nothing useful to put at the bare path: the navigation already lists them, so a picker there is a second copy of it. `redirectToFirst` answers that path with a **302 to the first row** instead.

```yaml
name: my-app
pages:
  - name: products-index
    path: /products
    redirectToFirst:
      hrefTemplate: /products/{name}
    components:
      - type: list
        dataSource:
          system:
            endpoint: /api/tables/products/records
            rowsKey: records
        listDisplay:
          itemTemplate: { title: $record.name }
          emptyMessage: No products yet
  - name: product-detail
    path: /products/:name
    components:
      - { type: text, content: Product detail }
```

The `{field}` placeholders in `hrefTemplate` are filled from that first row, so a first row named `anvil` sends `/products` to `/products/anvil`.

**An empty collection renders the page.** With no row there is no target, so the page is served normally and shows its own empty message. A redirect that fired anyway would either loop or land on a path that does not exist.

The page must declare a list source — a component-level system data source, or a page-level `dataSource` in `list` mode. Without one the redirect could never fire, so it is refused at startup rather than left silently inert. `hrefTemplate` must also be a path carrying at least one `{field}` placeholder: a constant target needs no first row, and therefore no `redirectToFirst`.

## Related reading

- **Pages Overview** — the full page property table.
- **Collection & Markdown Pages** — one route per record.
- **Data Binding** — `single` mode and `param`.
- **Redirects** — retiring a path without breaking links.
- **Languages** — configuring language codes and `$t:` keys.
