# Generative engine optimisation (GEO)

## Contents

- What "AI visibility" means
- Measured
- Unproven
- The three edits worth making
- Ranking still matters
- Off-site presence
- What Sovrium adds, and what it does not prove
- Metrics vocabulary
- Honest reporting

Tags point to `sources.md`. Dates matter here: this field moves monthly. Re-check any figure older than a year before quoting it.

## What "AI visibility" means

Answer engines (Google's AI Overviews and AI Mode, ChatGPT search, Perplexity, Copilot, Claude with search) retrieve pages, then write an answer. A site can be **mentioned** (its brand or product named) or **cited** (linked as a source). They are separate outcomes and move independently. [S44]

## Measured

| Finding                                               | Size                                                | Caveat                                                | Source |
| ----------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------- | ------ |
| Quotations with attribution raise visibility          | about +41 %                                         | One synthetic engine, 2024; later replications weaker | [S43]  |
| Statistics with their source raise visibility         | about +33 %                                         | Same study                                            | [S43]  |
| Fluent, well-written prose raises visibility          | about +29 %                                         | Same study                                            | [S43]  |
| Citing sources raises visibility                      | positive                                            | Same study                                            | [S43]  |
| Keyword stuffing lowers visibility                    | about −9 %                                          | Same study                                            | [S43]  |
| Top-10 organic ranking explains AI Overview citations | about 38 % (March 2026 revision; 76 % in July 2025) | Correlational, one vendor's panel                     | [S46]  |
| Off-site brand mentions vs AI visibility              | correlation 0.66 (backlinks 0.22)                   | Correlation, not cause                                | [S45]  |
| `llms.txt` fetched by crawlers                        | 97 % never fetched in the study window              | One study, mid-2026                                   | [S39]  |
| Microsoft's guidance for being cited                  | depth, headings and tables, evidence, freshness     | Vendor guidance, not a measurement                    | [S72]  |

Google's own position for Search: no special optimisation is needed for AI features beyond ordinary good pages; `llms.txt` and markdown files are not needed. [S19][S20][S40][S41]

## Unproven

Treat these as experiments, never as promises:

- `.md` twins or `Accept: text/markdown` raising citations. [S48][S49]
- `llms-full.txt` (a convention some documentation tools adopted; not part of the `llms.txt` proposal). [S38][S50]
- `ai.txt` (a 2023 proposal with no crawler adoption shown). [S60]
- Answer-first paragraphs as a citation lever.
- Structured data raising AI citations — one test found no significant effect, and it is known only from secondary reporting. [S47]
- Agent-readiness scores (for example Lighthouse's agentic-browsing checks) predicting citations; they measure whether an agent can use the page. [S42]

## The three edits worth making

1. **Cite and quote.** Where the page makes a claim, name the source and link it; quote named people with attribution.
2. **Put numbers on the page, with their source and date.** "Orders ship in 2 working days (median over 2026)" beats "fast shipping".
3. **Write fluent, specific prose under clear headings.** One idea per section; tables for comparisons; no keyword repetition.

These are also what makes a page good for people, which is the only reason they are safe to recommend.

## Ranking still matters

Most AI answers draw on pages that already rank. Everything in `technical.md` — crawlable, canonical, fast, server-rendered content — is also the foundation for AI visibility. Do not trade it for AI-specific tricks.

## Off-site presence

Being discussed elsewhere (reviews, comparisons, forums, press, directories) correlates more strongly with AI visibility than backlinks do. This is outside the config: tell the person where their brand is and is not mentioned, and do not promise that on-site edits can replace it. [S45][S44]

## What Sovrium adds, and what it does not prove

| Sovrium serves                                                | Effect                                                                                                                                   |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `/llms.txt`, `/llms-full.txt` (`llms` config)                 | Convenient for agents and IDE assistants that read them; no measured search effect; Google does not read them                            |
| `.md` twins and `Accept: text/markdown` for content-dir pages | Convenient for agents; unproven for citations; announced by `rel="alternate"`, sent with `Vary: Accept`, `X-Robots-Tag` on noindex pages |
| Server-rendered HTML                                          | The real foundation: content is in the first response                                                                                    |

Keep them on for documentation sites where agents are real readers; do not sell them as SEO.

## Metrics vocabulary

Use these terms consistently in reports:

| Term                | Meaning                                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| Mention             | The brand or product is named in an AI answer                                                            |
| Citation            | A page of the site is linked as a source                                                                 |
| Share of voice      | Mentions of the brand divided by mentions of the brand and its named competitors, for a fixed prompt set |
| Prompt set          | The fixed list of questions tested, re-run on a schedule                                                 |
| AI referral traffic | Visits whose referrer is an answer engine, from analytics                                                |

Measure with a fixed prompt set over time, per engine; single screenshots prove nothing. Bing Webmaster Tools reports AI citation performance for Microsoft surfaces. [S28][S61]

## Honest reporting

- State which findings are measured, which are vendor guidance and which are hypotheses.
- Give the date and source of every number.
- Never promise a citation, a rich result or an AI Overview placement.
