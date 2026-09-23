# Structured Data & Favicons

> Emit Schema.org JSON-LD by hand or synthesise it per article, declare favicons for every device, and add preload and DNS-prefetch resource hints.

Three parts of `meta` are less about words and more about machines: the JSON-LD that describes the page to search engines, the icons that represent it in a browser, and the hints that make it load faster.

## `structuredData`

Emitted as a `application/ld+json` script block. It accepts raw Schema.org JSON-LD verbatim:

```yaml
name: my-blog
pages:
  - name: Article
    path: /articles/:slug
    meta:
      structuredData:
        '@context': https://schema.org
        '@type': Article
        headline: '$record.title'
        author: { '@type': Person, name: '$record.author' }
        image: '$record.cover'
        datePublished: '$record.published_at'
    components:
      - { type: text, element: h1, content: '$record.title' }
```

**Raw JSON-LD is passed through unvalidated.** Unlike the rest of `meta`, a hand-written block's contents are not schema-checked — a malformed `@type` or a misspelled property ships silently. Validate the emitted block with a rich-results testing tool rather than relying on `sovrium validate`.

### Auto-synthesised article schema

<!-- sovrium:options StructuredDataSchema depth=1 -->

A content directory can generate JSON-LD per article from frontmatter instead. Supply the object form and the synthesiser takes over: `enabled` must be exactly `true`, `type` chooses between `TechArticle` and `Article`, `breadcrumbs` emits a breadcrumb list alongside the article, and `organization` becomes the article's publisher.

```yaml
name: my-docs
pages:
  - name: docs
    path: /docs/:slug
    contentDir: { directory: content/docs, slugFrom: filename }
    meta:
      structuredData:
        enabled: true
        type: TechArticle
        breadcrumbs: true
        organization: Sovrium
    components:
      - { type: container, element: main }
```

Headline, description and publication date come from each file's frontmatter, so one declaration covers every article in the directory.

The synthesiser also carries typed schemas for the other Schema.org objects a site commonly emits — an organization, a person, a product, a local business, an FAQ page, an education event and a breadcrumb list — each with its own option table in the reference.

## `favicons`

<!-- sovrium:options FaviconsConfigSchema depth=2 -->

Favicons accept two shapes. The **object form** above is the short one: a default `icon`, an `appleTouchIcon` for the iOS home screen, and `sizes` for size-specific icons.

```yaml
name: my-app
pages:
  - name: Home
    path: /
    meta:
      favicons:
        icon: ./favicon.svg
        appleTouchIcon: ./apple-touch-icon.png
        sizes:
          - { size: '32x32', href: ./favicon-32.png }
          - { size: '16x16', href: ./favicon-16.png }
    components:
      - { type: text, element: h1, content: 'Home' }
```

The **array form** gives one entry per link tag, and is the only way to declare a Safari pinned-tab mask icon:

<!-- sovrium:options FaviconItemSchema depth=2 -->

```yaml
name: my-app
pages:
  - name: Home
    path: /
    meta:
      favicons:
        - { rel: icon, href: ./favicon.svg, type: image/svg+xml }
        - { rel: mask-icon, href: ./mask.svg, color: '#6366f1' }
    components:
      - { type: text, element: h1, content: 'Home' }
```

For a single icon and nothing else, the singular `meta.favicon` takes a bare path.

## Performance hints

<!-- sovrium:options PreloadItemSchema depth=2 -->

`preload` is an array of critical resources to fetch early. Preloading a font is the highest-value case: it removes a round trip from the critical path that would otherwise start only after the stylesheet parses.

`dnsPrefetch` is a plain array of origins to resolve ahead of time — no object wrapper:

```yaml
name: my-app
pages:
  - name: Home
    path: /
    meta:
      preload:
        - { href: /fonts/inter.woff2, as: font, type: font/woff2, crossorigin: anonymous }
      dnsPrefetch:
        - 'https://cdn.example.com'
    components:
      - { type: text, element: h1, content: 'Home' }
```

### `customElements`

<!-- sovrium:options CustomElementSchema depth=2 -->

Anything else the head needs, as an array of tags:

```yaml
name: my-app
pages:
  - name: Home
    path: /
    meta:
      customElements:
        - { type: meta, attrs: { name: theme-color, content: '#0f172a' } }
    components:
      - { type: text, element: h1, content: 'Home' }
```

## Related reading

- **SEO & Metadata** — title, description, Open Graph, social cards.
- **Collection & Markdown Pages** — the content directories synthesis applies to.
- **Scripts** — loading JavaScript, as opposed to hinting at it.
- **Ecoconception** — the footprint case for fewer, earlier requests.
