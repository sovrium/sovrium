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

Every page opens with a skip link, the first stop of the keyboard: hidden until it takes focus, it moves the focus past the header and the navigation to the page's main content. It reads "Skip to main content" in the language the page declares — "Aller au contenu principal" in French, renamed under `sovrium.page.skipToContent` — and wears the app's `primary` colours.

## App variables

`$vars.*` are fixed at author time and `$query.*` reads the URL. Neither can say what app is serving the page — so a page wanting its own product name in the chrome had to hardcode it, and every copy went stale on its own. `$app.*` closes that with seven tokens, usable anywhere a string is: content, props, an `href` — including inside a component template, which resolves them for the page it is placed on exactly as a component written inline does. They resolve in a page's `meta.title` and `meta.description` too, and inside the translation a `$t:` title names, in every language the page is read in — so `title: $app.label — Records` names the app in the browser tab, in the command palette, and after the reader switches language.

| Token                | Value                                                                                                             |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `$app.name`          | The config `name` — an npm-style slug, right in a URL or an id.                                                   |
| `$app.label`         | The name people read: `displayName` when declared, else that name title-cased, for page chrome.                   |
| `$app.version`       | The declared `version`, or nothing when none is declared.                                                         |
| `$app.origin`        | The scheme and host **this request** arrived on.                                                                  |
| `$app.basePath`      | The base this app is served at — empty at a site root, `/_admin` for a mounted console.                           |
| `$app.engineVersion` | The version of the Sovrium engine running the app, which under a mount is not the app's own.                      |
| `$app.path`          | The path the visitor asked for, decoded, without the query string (a 404 page can say which address had nothing). |

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

**A page that references `$app.origin` — directly or through a component template it places — is served fresh, not from the page cache.** It embeds the request host in its HTML, so a cached copy minted behind one hostname would print the wrong address to visitors of another.

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

The vocabulary is a closed set, so a typo is a startup error naming the accepted values rather than a page that silently never appears: `auth`, `auth.apiKeys`, `auth.twoFactor`, `auth.groups`, `auth.passkeys`, `auth.magicLink`, `auth.oauth`, `auth.sso`, `auth.signUp`, `auth.passwordReset`, `auth.scopeTables`, `tables`, `forms`, `links`, `automations`, `agents`, `buckets`, `connections`, `analytics`, `decisions`, `pages`, `components`, `assets.templates`, `design.brand`, `design.voice`, `data`.

Four of them read more than one key:

- `assets.templates` holds when at least one `assets` entry is a template — html, svg, partial, text, docx, xlsx or pptx. A font, a picture or a data file renders nothing to preview.
- `design.brand` holds when `design` declares its identity half: a logo, colour roles, imagery, principles or a zone map. Colour, type and radius tokens alone are a theme, not a brand.
- `design.voice` holds when `design.voice` is declared.
- `data` holds when the app stores something whose readers can be granted: at least one table, form or bucket. The list is AND, so this is how one page asks for "any of the three".

The way to a page follows the page. A sidebar entry whose destination is a page the host does not meet is dropped with it, and a sidebar group left with no entry draws no heading, so the navigation never offers a page the app refuses to serve. A link to a path that is no page of the app is left alone.

A declared-but-empty collection counts as absent — an empty `tables` list is not "this instance has tables", and a page that lists them would have nothing to list.

For a standalone app this is close to a comment: you already know what you declared. It earns its place for an app **embedded in another**, where the pages ship with one config and the capabilities belong to a different one.

## Related reading

- **Routing & Paths** — how a `path` resolves.
- **Data Binding** — `dataSource` and reference substitution.
- **The Component Model** — the shared module system every component composes from.
- **SEO & Metadata** — the document head and social cards.
- **Tables Overview** — the data models pages render.
