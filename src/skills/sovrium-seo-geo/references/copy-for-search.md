# Copy for search and answer engines

Search results, social previews and AI answers all quote the page's own words. The agent writes
those words for a person first — the searcher deciding whether to click, the reader deciding
whether to trust — and lets search engines follow. Keyword tricks measurably hurt; clarity,
specificity and evidence help.

## Contents

- [Principles](#principles)
- [Page titles](#page-titles)
- [Meta descriptions](#meta-descriptions)
- [Social preview copy](#social-preview-copy)
- [Image alternative text](#image-alternative-text)
- [Headings that answer the question](#headings-that-answer-the-question)
- [Quotable passages](#quotable-passages)
- [Tone](#tone)
- [Checklist](#checklist)

## Principles

- Write for the person reading the result, then check it describes the page accurately.
- Every page gets its own title and description; duplicates tell search engines the pages are interchangeable.
- Say what the page actually contains. A title or description that promises something the page does not deliver is rewritten by search engines and punished by visitors.
- Never repeat a keyword to rank. Repetition reads as spam to people and, in measured tests of AI answer engines, lowered visibility.
- Copy lives in the page's `meta` block and, for multilingual apps, in its per-language entries: `sovrium docs pages-seo/seo-meta` and `sovrium docs app-schema/languages`.

## Page titles

- Describe the page in plain words, most specific part first: "Invoice templates for freelancers".
- Add the brand as a suffix, set off by a delimiter: "Invoice templates for freelancers · Acme". The home page may lead with the brand.
- Use the same delimiter on every page.
- One title per page, unique across the site; paginated or filtered variants say what differs ("page 2", "Paid invoices").
- No keyword lists ("Invoices, Invoice Software, Free Invoices"), no all-caps, no boilerplate repeated in front of every title.
- Match the page's visible `h1` closely; a title that disagrees with the heading is more likely to be rewritten in results.
- **On length**: Google publishes no character limit; results are truncated by pixel width, so about 60 characters is common practice for a title that shows in full, not a rule. Sovrium's schema currently enforces its own ceiling on `meta.title` and `meta.description` at validation time; check `sovrium docs pages-seo/seo-meta` for the limit your version applies, and write to fit it rather than working around it.

## Meta descriptions

- Summarise what the visitor will find, in one or two complete sentences.
- Include the specifics a searcher compares on: what, for whom, a number, a price model, a location, where relevant.
- Unique per page. For record pages bound to data, build it from the record's own fields rather than one sentence for every record.
- Search engines may show different text from the page when it matches the query better; a good description still wins most often for the query the page targets.
- About 155 characters is common practice before truncation on desktop results; like the title, it is a display estimate, not a published limit.
- No quotation marks around the whole description; no "Welcome to…"; no keyword lists.

## Social preview copy

- `og:title` may differ from the page title: drop the brand suffix (the preview shows the site name) and write for a feed rather than a results page.
- `og:description`: two to four sentences that make a person want to open the link — the concrete payoff, not a slogan.
- Keep the social title and description consistent with the page; a preview that oversells gets clicked once.
- The image's alternative text (`openGraph.imageAlt`, rendered as `og:image:alt`) describes the image, as below.
- Open Graph and Twitter card options: `sovrium docs pages-seo/seo-meta`.

## Image alternative text

- Describe what the image shows that matters in its context: "Invoice list with three overdue rows highlighted", not "screenshot".
- Keep it to a sentence; put long explanations in the page text.
- Never stuff keywords into alternative text; it is read aloud to screen-reader users.
- Decorative images have empty alternative text, so they are skipped.
- Do not start with "Image of" or "Picture of"; assistive technology already announces an image.
- Name files descriptively as well (`overdue-invoices.webp`, not `IMG_0042.webp`).
- Image options: `sovrium docs components/media-components`.

## Headings that answer the question

- Write section headings in the words a searcher types, often as the question itself: "How do refunds work?" rather than "Refund policy details".
- Answer the heading's question in the first one or two sentences below it, then elaborate.
- One `h1` per page stating the page's topic; section headings nested in order without skipped levels.
- A heading describes the section; it never restates the page title or the heading above it.
- Tables and lists for comparisons and steps; engines and readers both extract them more reliably than prose.

## Quotable passages

AI answer engines lift self-contained passages. In one controlled study of generative engines
(Aggarwal et al., KDD 2024), three edits raised a source's visibility in answers — adding
attributed quotations (about +41 %), adding sourced statistics (about +33 %) and citing sources —
while keyword stuffing lowered it (about −9 %). The study used one synthetic engine and later
replications found smaller effects; treat the numbers as direction, not promise.

- Give each key question a **self-contained answer block of about 130–170 words** that makes sense lifted out of the page: name the subject instead of "it", define terms in place.
- Put at least one **sourced statistic** in the passages that matter, with its source and date in the sentence ("According to <publisher> (<year>), …").
- Where an expert or customer said something useful, quote them **with attribution** (name and role, with their consent).
- Cite primary sources with links.
- State facts plainly; hedged, vague sentences are not quoted.
- Keep the passage current and dated when it depends on time ("As of March 2026, …").
- Never fabricate a statistic, a quotation or a source to satisfy this list. No evidence means no claim.
- There is no special markup for AI features; the same helpful, specific, non-commodity content that serves search serves them.

## Tone

- Search copy follows the app's voice (`design.voice`): its pronoun, its `prefer` and `avoid` lines. A results snippet is the first sentence of the app a stranger reads.
- Sentence case, present tense, no exclamation marks, no hype words ("best", "ultimate", "revolutionary") unless the claim is sourced.
- One term per concept, the same term the page uses (see the pages skill's copy reference for the vocabulary table).

## Checklist

- [ ] Every page has a unique title describing it, brand as a delimited suffix, matching its `h1`.
- [ ] Every page has a unique, specific description; record pages build theirs from record fields.
- [ ] Titles and descriptions fit the limit `sovrium validate` applies; the ~60 / ~155 figures are treated as display practice.
- [ ] No keyword repetition in titles, descriptions, headings or alternative text.
- [ ] `og:description` is two to four sentences; `og:image:alt` describes the image.
- [ ] Every meaningful image has descriptive alternative text; decorative images have none.
- [ ] Section headings are phrased as the searcher's question and answered immediately.
- [ ] Key answers are self-contained passages of about 130–170 words with a sourced statistic or an attributed quotation where one genuinely exists.
- [ ] No fabricated numbers, quotations or sources.
- [ ] Every string follows the app's `design.voice`, in every declared language.
