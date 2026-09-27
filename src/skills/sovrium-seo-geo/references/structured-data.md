# Structured data

## Contents

- Rules that apply to every block
- Which types to use
- Types not to use for rich results
- The Organization block
- Sovrium shorthand versus raw objects
- Content-dir pages
- Validating
- Rule ids

Manual: `sovrium docs pages-seo/seo-structured-data`. Tags point to `sources.md`.

## Rules that apply to every block

- JSON-LD, in the page head. [S14]
- Describe only what is **visible** on the page. Markup for hidden content is a policy violation. [S14]
- Accurate, current, specific: prices, dates and availability match the page.
- One subject per block; link blocks with `@id` rather than repeating them.
- Structured data makes a page **eligible** for a rich result; it never guarantees one and is not a ranking factor on its own.

## Which types to use

Only types listed in Google's search gallery produce rich results. [S15] The ones a Sovrium app most often needs:

| Page                              | Type                                                        |
| --------------------------------- | ----------------------------------------------------------- |
| Home or about                     | Organization (or LocalBusiness for a place customers visit) |
| Article, post, documentation page | Article (content-dir pages synthesise TechArticle)          |
| Any page below the home           | BreadcrumbList                                              |
| Product or offer page             | Product (with offers and, where true, reviews)              |
| Event page                        | Event                                                       |

## Types not to use for rich results

- **FAQPage**: the rich result was retired on 2026-05-07. [S16]
- **HowTo**: retired in 2023. [S16]

Sovrium's `faqPage` shorthand still emits valid schema.org markup. It is harmless and may help other consumers, but promise no rich result from it, and do not add it to earn one.

## The Organization block

- One per site, on the home page (or every page, identical). [S17]
- `name`, `url`, `logo` (at least 112 × 112 px, crawlable, not blocked by robots), `sameAs` links to official profiles.
- Add `contactPoint` or address details only if they are on the page.

## Sovrium shorthand versus raw objects

`meta.schema` accepts either the shorthand (`organization`, `person`, `localBusiness`, `product`, `article`, `breadcrumb`, `faqPage`, `educationEvent`) or a full schema.org object. `meta.structuredData` is an older alias for the same key.

**`sovrium validate` does not check the contents of `meta.schema`** — any object is accepted. A typo in a property name ships silently. Always validate the rendered page with the tools below.

```yaml
pages:
  - name: home
    path: /
    meta:
      title: Acme — Handmade bindings
      schema:
        '@context': https://schema.org
        '@type': Organization
        name: Acme Bindery
        url: https://acme.example
        logo: https://acme.example/logo-512.png
        sameAs: [https://www.linkedin.com/company/acme-bindery]
```

## Content-dir pages

Markdown collections (`contentDir`) synthesise a canonical and Open Graph values for each page. With `meta.structuredData: { enabled: true }` they also synthesise a TechArticle (or `type: Article`) and, with `breadcrumbs: true`, a BreadcrumbList; `sovrium validate` refuses a mistyped `type`, `breadcrumbs` or `organization`, and a hand-written `meta.schema` wins over the synthesis. Manual: `sovrium docs pages-seo/seo-structured-data`. Check the rendered head of one article before adding your own blocks, so you do not publish two competing ones.

## Validating

1. **Schema Markup Validator** (validator.schema.org): is the markup valid schema.org? [S18]
2. **Rich Results Test**: is the page eligible for a Google rich result, and which? [S18]
3. After deployment, Search Console's enhancement reports show what Google actually parsed.

Validate the rendered HTML (a URL, or the HTML you fetched with `curl`), not the config.

## Rule ids

| Id         | Rule                                               |
| ---------- | -------------------------------------------------- |
| SD-VISIBLE | Only visible content marked up                     |
| SD-GALLERY | Only gallery types expected to earn rich results   |
| SD-RETIRED | No FAQPage or HowTo sold as a rich-result lever    |
| SD-ORG     | One Organization block, logo ≥ 112 px              |
| SD-VALID   | Rendered markup passes both validators             |
| SD-DUP     | No duplicate or conflicting blocks for one subject |
