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

The numbers themselves are a practice rather than a search-engine rule: Google states no length limit for either, and truncates what it shows by pixel width, not by character count. Sixty and 160 are the lengths that usually survive that truncation on a desktop result, which is why Sovrium enforces them — a shorter title is never penalised, a longer one is simply cut.

**`noindex` wins over `robots`.** A page with `noindex: true` says `noindex` in its robots tag whatever else its `robots` string asks: `robots: follow` beside it renders `noindex, follow`. The tag, the sitemap and the `X-Robots-Tag` of a Markdown twin read the same rule, so a page the sitemap leaves out never tells crawlers to index it. A `robots` string that asks for indexing (`index`, or `all`) beside `noindex: true` says two opposite things, and `sovrium validate` refuses it, naming both keys.

**A canonical names one address per language.** A page whose path names no language (`/about`) is served at `/en/about` and `/fr/about`, and each must declare its own address, or search engines read the other languages as duplicates. Write the canonical as a `$t:` key followed by the rest of the address — `canonical: '$t:seo.base/about'`, with `seo.base` translated to `https://example.com/en` and `https://example.com/fr` — and each language renders its own. A key missing in one language follows the usual fallback (`fallback`, then `default`); the key itself is never printed. In an app with more than one language and `BASE_URL` set, such a page with no canonical at all names its own address in each language: `/fr/about` declares `https://example.com/fr/about`.

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

Open Graph metadata for rich social previews, where `determiner` is the word preceding the title in a sentence. `siteName` renders `og:site_name`, which tells a platform the page belongs to a larger site; the flat `og:site_name` key on `meta` is a shorthand for the same tag. In an app that declares more than one language, a page with `openGraph` also lists every other language as an `og:locale:alternate` in `language_TERRITORY` form (`fr_FR`), read from each language's `locale`, so a platform can offer the share in its reader's language; the page's own `og:locale` is never repeated, and a language declared without a territory is left out.

**The sharing image is the part platforms are strictest about.** Use a PNG or JPEG of 1200 by 630 pixels — a 1.91:1 ratio, under 8 MB. WebP is acceptable, since every major platform has rendered it since late 2024. **Never AVIF**: X, LinkedIn, Slack and iMessage all fail to render it, and the link then shares with no image at all, so `sovrium validate` refuses an `openGraph.image` or `twitter.image` whose path ends in `.avif`. Only the path is read, so a query string such as `og.avif?v=2` is refused too. This is the one place the rule for committed images is reversed — imagery on the page itself should be AVIF or WebP, but a sharing card should not. `imageAlt` renders `og:image:alt`; Sovrium does not yet emit the image's width and height, so a platform fetches the image before it can draw the first preview. The refusal covers the two sharing images only: a favicon and an image named in structured data are read by search engines, which render AVIF, so neither is checked.

`openGraph.image` also takes a `$t:` key, for a card per language, and a path starting with `/`; either is emitted as a full address on the host the request arrived on. `openGraph.url` takes a `$t:` key the same way as `canonical`, so each language shares its own address.

**Descriptions agree.** `openGraph.description` resolves exactly as `meta.description` does, a `$record` value behind a `$t:` key included. When a page declares `openGraph` without a `description`, `og:description` takes the page's resolved `meta.description`; a page that declares no `openGraph` gains no tag.

**Addresses from a record are checked.** A `canonical` or `openGraph.url` that resolves from a `$record` value is emitted only when it is an `http:` or `https:` address; anything else, such as a `javascript:` value an editor typed, leaves the tag out and the rest of the head unchanged.

## `twitter`

<!-- sovrium:options TwitterCardSchema depth=2 -->

Social-card metadata, where `card` is the only required property. The image rules above apply unchanged: `summary_large_image` crops to 2:1, so keep the subject away from the top and bottom edges of a 1200 by 630 image. The limits here are tighter than the core `title` and `description` limits, which is why they are separate properties rather than inherited ones. When a page declares `twitter` without a `description`, `twitter:description` takes the resolved `openGraph.description` — what X reads in its absence — and otherwise the resolved `meta.description`.

## Elsewhere

JSON-LD, favicons and the resource hints — `preload`, `dnsPrefetch` and `customElements` — are all `meta` properties too, documented in **Structured Data & Favicons**.

## Related reading

- **Structured Data & Favicons** — JSON-LD, icons, resource hints.
- **Pages Overview** — `sitemap` and `rss`, which complement `meta`.
- **Collection & Markdown Pages** — per-record and per-article metadata.
- **Languages** — the language codes `i18n` is keyed by.
- **Media Components** — the images these tags reference.
