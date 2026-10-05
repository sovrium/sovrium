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

### The shorthand form

<!-- sovrium:options StructuredDataSchema depth=1 -->

Instead of one raw object, `structuredData` (or its newer name `schema`) can take a keyed object whose keys are the Schema.org types it emits: `organization`, `person`, `localBusiness`, `product`, `article`, `breadcrumb`, `faqPage` and `educationEvent`. Each key's value is emitted verbatim as its own JSON-LD block, so it carries its own `@context` and `@type`, and each type has its own option table in the reference. The same caveat applies: the object is not decoded against these tables at `sovrium validate` time, and the key names are not checked either, so a mistake reaches the page unchanged.

**Valid markup is not the same as a rich result.** Google retired the FAQ rich result on 7 May 2026 and the HowTo rich result in 2023. A `faqPage` block, or a raw `HowTo` object, is still valid Schema.org and is still read by other consumers, but it no longer earns a special search listing. Emit it when the questions are visible on the page; do not add it to win a listing that no longer exists.

### Auto-synthesised article schema

A content directory can generate JSON-LD per article from frontmatter instead. Supply the object form and the synthesiser takes over: `enabled` must be exactly `true`, `type` chooses between `TechArticle` and `Article`, `breadcrumbs` emits a breadcrumb list alongside the article, and `organization` becomes the article's publisher. These four keys are part of the published schema, so an editor completes them, and `sovrium validate` refuses a mistake: a `type` other than `TechArticle` or `Article`, a `breadcrumbs` that is not a boolean, or an `organization` that is not a string. `structuredData` stays the older name of `schema` for hand-written JSON-LD — an object carrying `enabled` is read as this toggle, anything else as JSON-LD.

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

## `favicons`

<!-- sovrium:options FaviconsConfigSchema depth=2 -->

Favicons accept two shapes. The **object form** above is the short one: a default `icon`, an `appleTouchIcon` for the iOS home screen, and `sizes` for size-specific icons.

A `./` path is read from the root of `public/`, whatever the page's address — on `/fr/` or `/blog/first-evening` as on `/`. The same holds for `meta.favicon`.

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
