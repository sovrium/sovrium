# Audit report template

## Contents

- Per-URL table
- Grades
- Findings
- Summary
- Example

Write one report per audit, in this shape. Keep it to what you checked; say what you could not check.

## Per-URL table

| URL        | Status | Title (chars)      | Description (chars) | Canonical        | hreflang        | OG image       | JSON-LD        | Grade |
| ---------- | ------ | ------------------ | ------------------- | ---------------- | --------------- | -------------- | -------------- | ----- |
| `/`        | 200    | ✓ unique (48)      | ✓ (142)             | ✓ self, absolute | ✓ 3 + x-default | ✓ PNG 1200×630 | Organization ✓ | A     |
| `/pricing` | 200    | ✗ duplicate of `/` | ✗ missing           | ✗ missing        | ✓               | ✗ AVIF         | —              | D     |

Status is what `curl -sI` returned. Counts are informative only (see the checklist: no length limit exists).

## Grades

| Grade | Meaning                                                                                          |
| ----- | ------------------------------------------------------------------------------------------------ |
| A     | Indexable, canonical, unique title and description, valid previews, no blocking issue            |
| B     | One minor issue (description long, alt missing on a decorative image)                            |
| C     | One issue that weakens ranking or sharing (missing canonical, missing OG image)                  |
| D     | Several C issues, or a broken preview                                                            |
| E     | Indexing problem (noindex by mistake, blocked by robots, relative hreflang, content not in HTML) |
| F     | Not reachable (4xx/5xx, redirect chain or loop)                                                  |

## Findings

One line per finding, most severe first:

```
<file>:<line>  <rule id>  <what is wrong>  →  <smallest fix>
```

- `file:line` is the config file (or `$ref` partial) where the fix goes.
- The rule id comes from `technical.md`, `structured-data.md` or `social-previews.md`, or the checklist number in `SKILL.md`.
- The fix is the smallest config change that resolves it; if no config change can (a Sovrium limitation), say so and name the workaround.

## Summary

- Pages audited, grade distribution.
- The three fixes with the largest effect.
- Sovrium limitations met (with the "today" notes from the skill).
- What was not checked (field Core Web Vitals, Search Console data, off-site mentions).

## Example

```
config/pages/pricing.yaml:4   T-TITLE   title identical to the home page         →  meta.title: "Pricing — Acme"
config/pages/pricing.yaml:5   T-DESC    no description                           →  meta.description: one sentence on who each plan is for
config/pages/pricing.yaml:3   T-CANON   no canonical                             →  meta.canonical: https://acme.example/pricing
config/pages/pricing.yaml:12  OG-AVIF   og:image is .avif (fails on X, LinkedIn) →  export a 1200×630 PNG, set openGraph.image
.env                          T-ORIGIN  BASE_URL unset; hreflang relative        →  BASE_URL=https://acme.example
app.yaml                      T-NOINDEX /thank-you noindex but linked in nav      →  keep noindex; drop it from the nav and set sitemap: false
```
