# Pages Overview

> What a page is — the server-rendered component tree, every page property, and the smallest config that serves a route.

A page is a route plus a tree of components, rendered on the server. Pages display your tables' records, host forms that write to them, embed interactive islands, and serve public content — all from configuration, with no custom React.

Three properties are required: `name`, `path` and `components`. Everything else layers on top.

```yaml
name: my-app
pages:
  - name: Home
    path: /
    meta:
      title: Welcome
      description: The fastest way to ship internal tools.
    components:
      - type: text
        element: h1
        content: Build apps from config
      - type: container
        children:
          - { type: text, content: 'Get started in minutes.' }
```

## Page properties

<!-- sovrium:options PageSchema depth=1 -->

Each property that carries a shape of its own has its own article: `path` in **Routing & Paths**, `components` in **The Component Model**, `meta` in **SEO & Metadata**, `access` and `layout` in **Layouts, Sidebars & Access**, `dataSource` and `query` in **Data Binding**, `collection`, `markdown`, `contentDir` and `source` in **Collection & Markdown Pages**, and `scripts` in **Scripts**.

```yaml
name: my-app
pages:
  - name: About
    path: /about
    access: all
    meta: { title: 'About Us' }
    viewTransition: { type: fade, duration: 200 }
    components:
      - { type: text, element: h1, content: 'About' }
```

## App variables

`$vars.*` are fixed at author time and `$query.*` reads the URL. Neither can say what app is serving the page — so a page wanting its own product name in the chrome had to hardcode it, and every copy went stale on its own. `$app.*` closes that with six tokens, usable anywhere a string is: content, props, an `href`.

| Token                | Value                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------- |
| `$app.name`          | The config `name` — an npm-style slug, right in a URL or an id.                              |
| `$app.label`         | That name in display form, title-cased, for page chrome.                                     |
| `$app.version`       | The declared `version`, or nothing when none is declared.                                    |
| `$app.origin`        | The scheme and host **this request** arrived on.                                             |
| `$app.basePath`      | The base this app is served at — empty at a site root, `/_admin` for a mounted console.      |
| `$app.engineVersion` | The version of the Sovrium engine running the app, which under a mount is not the app's own. |

```yaml
name: my-app
pages:
  - name: Home
    path: /
    components:
      - { type: text, element: h1, content: $app.label }
      - { type: text, content: 'Version $app.version, served from $app.origin' }
```

The set is closed, exactly as a page's `query` allow-list is. A token outside it — `$app.description` — is left in the output verbatim rather than substituted, which is how you notice the typo; an open path expression over the config would put any config value one keystroke away from a rendered page.

`$app.version` is the one exception, and always resolves: an app that declares no version substitutes the empty string rather than leaving the token behind. Declaring none is a perfectly valid config, so a surviving `$app.version` would fire on correct input and teach you nothing — and inside a structured value, such as a JSON prop handed to an interactive component, the literal would be read downstream as if it were a real version number.

**A page that references `$app.origin` is served fresh, not from the page cache.** It embeds the request host in its HTML, so a cached copy minted behind one hostname would print the wrong address to visitors of another.

## Capability requirements

`requires` names the capabilities the app serving a page must declare. A page whose requirements are not **all** met is not registered at all: the path answers 404, and the page appears in no sitemap, no command-palette listing and no derived navigation. It never renders half-working, because a reachable page with nothing on it is worse than one that is not there.

```yaml
name: my-app
pages:
  - name: api-keys
    path: /api-keys
    requires: [auth.apiKeys]
    components:
      - { type: text, element: h1, content: 'API keys' }
```

The vocabulary is a closed set, so a typo is a startup error naming the accepted values rather than a page that silently never appears: `auth`, `auth.apiKeys`, `auth.twoFactor`, `auth.groups`, `tables`, `forms`, `links`, `automations`, `agents`, `buckets`, `connections`, `analytics`.

A declared-but-empty collection counts as absent — an empty `tables` list is not "this instance has tables", and a page that lists them would have nothing to list.

For a standalone app this is close to a comment: you already know what you declared. It earns its place for an app **embedded in another**, where the pages ship with one config and the capabilities belong to a different one.

## Related reading

- **Routing & Paths** — how a `path` resolves.
- **Data Binding** — `dataSource` and reference substitution.
- **The Component Model** — the shared module system every component composes from.
- **SEO & Metadata** — the document head and social cards.
- **Tables Overview** — the data models pages render.
