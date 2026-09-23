# SEO & Metadata

> The page `meta` block — title, description and canonical URL, plus Open Graph and social-card metadata for sharing.

A page's `meta` property controls everything rendered into the document head. Values support `$record.*` and `$frontmatter.*` substitution, so collection and markdown pages produce per-record SEO without a second configuration pass.

```yaml
name: my-blog
tables:
  - name: posts
    fields:
      - { name: title, type: single-line-text }
      - { name: slug, type: single-line-text }
      - { name: excerpt, type: long-text }
      - { name: cover, type: url }
pages:
  - name: Blog Post
    path: /blog/:slug
    collection: { table: posts, slugField: slug }
    meta:
      title: '$record.title'
      description: '$record.excerpt'
      canonical: 'https://example.com/blog/$record.slug'
      openGraph: { type: article, image: '$record.cover' }
      twitter: { card: summary_large_image }
    components:
      - { type: text, element: h1, content: '$record.title' }
```

## Core metadata

<!-- sovrium:options MetaSchema depth=1 -->

**The character limits are schema constraints, not advice.** A `title` over 60 characters, or a `description` over 160, fails `sovrium validate`. This catches a runaway `$record.title` binding offline rather than in a search result.

Localized metadata is keyed by language, and each entry carries the same limits:

```yaml
name: my-app
languages:
  supported: [{ code: en }, { code: fr }]
pages:
  - name: Pricing
    path: /pricing
    meta:
      title: 'Pricing'
      i18n:
        fr: { title: 'Tarifs', description: 'Des tarifs simples et transparents.' }
    components:
      - { type: text, element: h1, content: 'Pricing' }
```

Either spelling works as a key — the short code, `fr`, or the full locale, `fr-FR`. The exact tag is matched first, then the primary subtag, so a page resolved to `fr-FR` still finds an `fr` entry, while a deliberate `pt-BR` entry is never shadowed by a `pt` one. Which spelling a page is resolved to is covered in **Languages**.

## `openGraph`

<!-- sovrium:options OpenGraphSchema depth=2 -->

Open Graph metadata for rich social previews. A sharing image of 1200 by 630 pixels is the safe size, and `determiner` is the word preceding the title in a sentence.

## `twitter`

<!-- sovrium:options TwitterCardSchema depth=2 -->

Social-card metadata, where `card` is the only required property. The limits here are tighter than the core `title` and `description` limits, which is why they are separate properties rather than inherited ones.

## Elsewhere

JSON-LD, favicons and the resource hints — `preload`, `dnsPrefetch` and `customElements` — are all `meta` properties too, documented in **Structured Data & Favicons**.

## Related reading

- **Structured Data & Favicons** — JSON-LD, icons, resource hints.
- **Pages Overview** — `sitemap` and `rss`, which complement `meta`.
- **Collection & Markdown Pages** — per-record and per-article metadata.
- **Languages** — the language codes `i18n` is keyed by.
- **Media Components** — the images these tags reference.
