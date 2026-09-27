# Social previews

## Contents

- What every shared page needs
- The image
- Format support matrix
- Platform notes
- Refreshing a cached preview
- Sovrium today
- Rule ids

Manual: `sovrium docs pages-seo/seo-meta`. Tags point to `sources.md`.

## What every shared page needs

| Tag              | Config                  | Notes                                             |
| ---------------- | ----------------------- | ------------------------------------------------- |
| `og:title`       | `openGraph.title`       | Can differ from `<title>`; no brand suffix needed |
| `og:type`        | `openGraph.type`        | `website` for most pages, `article` for posts     |
| `og:image`       | `openGraph.image`       | Absolute URL                                      |
| `og:url`         | `openGraph.url`         | The canonical URL                                 |
| `og:description` | `openGraph.description` | 2–4 sentences                                     |
| `og:site_name`   | `openGraph.siteName`    | The app or brand name                             |
| `og:image:alt`   | `openGraph.imageAlt`    | What the image shows                              |
| `og:locale`      | `openGraph.locale`      | `language_TERRITORY`, e.g. `fr_FR`                |
| `twitter:card`   | `twitter.card`          | `summary_large_image` for a large preview         |

The four required by the protocol are title, type, image and url. [S29]

## The image

| Property  | Value                                                                         |
| --------- | ----------------------------------------------------------------------------- |
| Size      | 1200 × 630 px (1.91:1) [S30]                                                  |
| Weight    | Under 8 MB; far less is better for slow crawlers                              |
| Format    | JPEG or PNG; WebP renders on nearly every platform since late 2024 [S36]      |
| Never     | AVIF — fails on X, LinkedIn, Slack and iMessage [S36]                         |
| Safe area | Keep text and faces in the centre: X crops `summary_large_image` to 2:1 [S33] |
| URL       | Absolute, publicly reachable, not behind auth or robots rules                 |
| Stability | A new image gets a new URL (platforms cache by URL)                           |

## Format support matrix

As tested in late 2024 [S36]; re-test before relying on a format not marked yes.

| Platform | JPEG / PNG | WebP | AVIF                    |
| -------- | ---------- | ---- | ----------------------- |
| Facebook | yes        | yes  | not in the test — avoid |
| LinkedIn | yes        | yes  | no                      |
| X        | yes        | yes  | no                      |
| Slack    | yes        | yes  | no                      |
| iMessage | yes        | yes  | no                      |

## Platform notes

- **Facebook / Meta**: reads Open Graph; the Sharing Debugger shows what it scraped and refreshes the cache. Its crawler identifies as `facebookexternalhit` or `meta-externalagent`. [S30][S31][S32]
- **LinkedIn**: reads Open Graph; the Post Inspector refreshes the cache. [S35]
- **X**: reads `twitter:*` first, then falls back to Open Graph. The card validator was removed in 2022; test by composing a post (without sending) in the X composer. The official markup page was unreachable during research. [S33][S34]
- **Slack**: unfurls with Open Graph and `twitter:*`; cached per URL. [S37]
- **iMessage**: reads Open Graph.

## Refreshing a cached preview

Platforms cache the first scrape. After fixing tags: Facebook Sharing Debugger → "Scrape again"; LinkedIn Post Inspector → inspect; X and Slack → change the image URL (a query string such as `?v=2` works) or wait for the cache to expire.

## Sovrium today

- Emits `og:title`, `og:description`, `og:type`, `og:url`, `og:image`, `og:image:alt`, `og:site_name`, `og:locale` from `openGraph` when set. Nothing is inferred: without `openGraph.url` there is no `og:url`.
- Emits `og:locale:alternate` for every other language of a multi-language app, from each language's `locale`.
- Does not emit `og:image:width` or `og:image:height` today. Width and height let a platform render the preview on the first share without fetching the image first.
- `sovrium validate` refuses an `openGraph.image` or `twitter.image` whose path ends in `.avif` (a query string does not hide it). A favicon or a structured-data image is not checked: search engines render AVIF there.
- Content-dir pages merge synthesised Open Graph values with what you set.

## Rule ids

| Id        | Rule                                                |
| --------- | --------------------------------------------------- |
| OG-REQ    | title, type, image, url present                     |
| OG-IMG    | 1200 × 630, ≤ 8 MB, JPEG/PNG/WebP, absolute, public |
| OG-AVIF   | No AVIF share image                                 |
| OG-ALT    | `og:image:alt` set                                  |
| OG-LOCALE | `og:locale` per language                            |
| TW-CARD   | `twitter:card` set; centre-safe image               |
