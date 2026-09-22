/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Prestyled-by-default class computers for typography rendered IN CHROME
 * — i.e. headings, paragraphs, inline code, code blocks,
 * blockquotes, and lists as they appear next to real component chrome
 * (cards, layouts, surrounding surfaces). Companion to the bare-token
 * swatches that `foundations.spec.ts` exercises: foundations tests the
 * typography tokens themselves (font-family / line-height / letter-
 * spacing); this slice tests how those tokens compose into a populated
 * prose surface that a schema author would actually render.
 *
 * Each helper paints the COLOR / FONT-WEIGHT / DECORATION classes through
 * {@link withVarFallback} so `app.design.*` overrides still win at the CSS
 * cascade layer (`var(--sv-X)` resolves the override first, falling back
 * to the inline OKLCH literal). The type rungs (`text-base`, `text-xl`,
 * `text-3xl`) and structural-spacing classes (`mb-3`, `mt-4`, `pl-4`) stay raw
 * — a rung is a Tailwind utility backed by `--text-*`, which the platform theme
 * layer declares, so an override already wins at the variable and cascading it
 * a second time here would be redundant. That is true as of 2026-09-09 and was
 * NOT true before it: the ladder emitted `--font-size-*`, a namespace no utility
 * reads, so this paragraph described a cascade that did not exist.
 *
 * The Sovrium typographic identity is value-driven (IBM Plex Sans +
 * JetBrains Mono — two families, since [internal ref] amendment A2 withdrew the
 * serif grace note), so the helpers'
 * job is mostly to BAKE IN the color / weight / decoration / tracking
 * defaults — the font-family + size cascade already lives in the theme
 * layer's `@theme` block. Once authors write `{ type: 'text', element:
 * 'h1', text: '…' }` they get the full Sovrium type identity without
 * spelling out any `text-foreground tracking-tight font-bold` recipe.
 *
 * Subparts covered:
 *
 *   - HEADING (level 1..6)   — page titles + section labels. Each level
 *                              gets a size + weight + tracking pairing
 *                              that mirrors a traditional editorial scale
 *                              (h1 = display, h2/h3 = section). All levels
 *                              share `text-fg` color so they read as
 *                              focal content on the active surface.
 *   - BODY (default)         — neutral paragraph copy on `text-fg` at the
 *                              body rung, whose own leading carries the
 *                              long-form reading comfort. The workhorse style.
 *   - BODY (lead)            — larger introductory paragraph (`text-xl` +
 *                              `fg-muted` tone) used as a subtitle right
 *                              under a page title to set the scene before
 *                              the body copy.
 *   - BODY (muted)           — smaller secondary paragraph (`text-sm` +
 *                              `fg-muted`) for captions / footnotes /
 *                              "this is chrome, not focal content" prose.
 *   - INLINE CODE            — the `<code>` inside a sentence ("call
 *                              `compileCSS(app)`"). Mono font + subtle
 *                              background + sm radius + tight padding so
 *                              the inline token reads as a chip without
 *                              breaking the paragraph's line-height.
 *   - CODE BLOCK (container) — the `<pre>`-or-`<div>` block that wraps a
 *                              multi-line code sample. Subtle bg + border +
 *                              radius + p-4 + mono font + overflow-x-auto
 *                              so wide samples scroll horizontally without
 *                              pushing the page's layout.
 *   - BLOCKQUOTE (wrapper)   — the `<blockquote>`-or-`<div>` wrapper for a
 *                              pulled quotation. Left-border accent rule
 *                              + italic + fg-muted tone so the quote
 *                              visually steps back from body copy.
 *   - BLOCKQUOTE (emphasis)  — the optional inner line lifted back OUT of
 *                              the wrapper's muted tone: `italic` plus the
 *                              full-strength `fg` role, so one line of a
 *                              quotation can carry the weight while the
 *                              rest of it stays stepped back. Italic is
 *                              the whole inflection; there is no second
 *                              type family behind it (A2).
 *   - LIST (container)       — the outer wrapper for both bullet (UL) and
 *                              ordered (OL) lists. Flex column + gap-1 so
 *                              items have a tight vertical rhythm; no
 *                              border / bg of its own — the list
 *                              container is a structural primitive that
 *                              inherits surface tone from its parent.
 *   - LIST (item)            — an individual `<li>`-or-`<span>` row inside
 *                              a list. Body-text size + neutral `text-fg`
 *                              color so the item reads as content, not
 *                              chrome. Bullet / number markers are baked
 *                              into the content string in the fixture
 *                              (the `'• '` / `'1. '` prefix) rather than
 *                              relying on `list-disc` / `list-decimal`,
 *                              because the fixture renders lists as
 *                              `<container><span>…</span></container>`
 *                              to keep ARIA flat. The helper still ships
 *                              the same token recipe so the painted item
 *                              tracks the body tone consistently.
 *
 * Intentionally NOT covered (this slice scopes to what the `ui-kit-
 * typography-in-chrome` cluster snapshot actually showcases — bare token
 * swatches living in `foundations.spec.ts` and structural typography
 * primitives like font-family registration are out of scope):
 *
 *   - FONT-FAMILY DECLARATIONS — IBM Plex Sans / JetBrains Mono are
 *                              registered as `--font-sans` /
 *                              `--font-mono` in the theme
 *                              layer (see `TOKENS.fontSans` /
 *                              `TOKENS.fontMono`). The
 *                              `font-sans` / `font-mono`
 *                              Tailwind utilities resolve through that
 *                              cascade automatically — emitting them as
 *                              `font-[var(--font-sans,…)]` here would only
 *                              duplicate what Tailwind v4 already does.
 *   - TYPE-SCALE SIZE TOKENS  — `text-xs` / `text-base` / `text-3xl` are
 *                              Tailwind v4 utilities backed by `--text-*`,
 *                              which the platform theme layer declares. They
 *                              flow through the same `@theme` cascade as
 *                              colours, so a tenant overriding the ladder
 *                              already wins — a helper would add nothing
 *                              beyond the raw utility name. (Until 2026-09-09
 *                              this named `--font-size-*`, which no utility
 *                              read, so the claim was false in the one
 *                              direction that mattered.)
 *   - LINK MARK               — the inline `<a>` rendered by the `link`
 *                              component-type lives inside the
 *                              interactive-renderers + `interactive`
 *                              cluster (`computeLinkClasses` is its
 *                              future helper). The typography-in-chrome
 *                              cluster fixture does not currently render
 *                              an inline link, so a link-mark helper would
 *                              ship ahead of its consumer. Tracked
 *                              separately.
 *   - CAPTION / SMALL-PRINT   — covered by `body({ variant: 'muted' })`
 *                              (small + fg-muted is the canonical caption
 *                              recipe). A dedicated `<figcaption>` /
 *                              `<small>` helper would only proxy the same
 *                              two tokens.
 *
 * Helper file lives in `src/presentation/ui/sections/renderers/element-
 * renderers/` (alongside the renderers that consume it) because typography
 * is rendered as part of the SSR pass — the `presentation-component →
 * presentation-island` layer boundary does not apply since this is purely
 * a same-layer helper. Mirrors the location chosen for
 * `button-default-classes.ts`, `input-default-classes.ts`,
 * `feedback-default-classes.ts`, `navigation-default-classes.ts`,
 * `layout-default-classes.ts`, `forms-default-classes.ts`, and
 * `data-default-classes.ts`.
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/design/css-var'

// ──────────────────────────────────────────────────────────────────────────────
// HEADING — levels 1..6 with editorial scale
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Heading level vocabulary mirroring HTML's `<h1>..<h6>` semantics.
 */
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

/**
 * Per-level size + weight + tracking recipe, on the canvas' heading ladder:
 * h1 30 · h2 24 · h3 20 · h4 16 · h5 13 · h6 12. Every level stays on the same
 * `text-fg` colour so they read as one focal-content hierarchy.
 *
 * The rungs moved twice here and only once visibly. The platform ladder shifted
 * into `--text-*` on 2026-09-09, so the SAME class name now names a smaller
 * size; each level below is therefore re-picked to the px the canvas draws
 * rather than left on its old class. The one real change is h2, which the
 * canvas puts at 24 where this was 20 — h1 and h2 sat one step apart and read
 * as the same weight of announcement.
 *
 * - h1: page title, bold, tight tracking.
 * - h2: major section, semibold.
 * - h3: minor section / sub-heading, semibold.
 * - h4..h6: progressively smaller, semibold — rare in business UI; defaults
 *   exist so authors who reach for them don't get unstyled text. h5/h6 keep the
 *   uppercase eyebrow treatment, which is what those levels are used for.
 */
const HEADING_LEVEL_TYPE: Record<HeadingLevel, string> = {
  1: 'text-4xl font-bold tracking-tight',
  2: 'text-3xl font-semibold tracking-tight',
  3: 'text-2xl font-semibold',
  4: 'text-lg font-semibold',
  5: 'text-base font-semibold uppercase tracking-wider',
  6: 'text-sm font-semibold uppercase tracking-wider',
}

const HEADING_COLOR = `text-[${v('sv-fg', T.fg)}]`

/**
 * Compute the default className for a heading element (`<h1>`..`<h6>`)
 * rendered inside the typography-in-chrome cluster. Paints the per-level
 * size + weight + tracking recipe in the central `sv-fg` tone so all
 * headings track the active foreground color (light mode: near-black;
 * dark mode: near-white) without spelling out the chrome.
 *
 * Layout / spacing (`mb-3`, `mt-4`) stays the consumer's responsibility
 * because the rhythm between a heading and its surrounding content varies
 * by context (h1 at the top of a page wants more breathing room than an
 * h3 inside a card). The helper only ships the type identity.
 */
export const computeHeadingClasses = ({ level }: { readonly level: HeadingLevel }): string =>
  [HEADING_LEVEL_TYPE[level], HEADING_COLOR].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// BODY — paragraph variants (default / lead / muted)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Paragraph variant vocabulary aligned with editorial body-copy roles:
 *   - `'default'` — workhorse body paragraph (`text-md` 14px + `text-fg`).
 *     The default that 90% of paragraphs land on.
 *   - `'lead'`    — larger introductory paragraph (`text-xl` 18px + `fg-muted`)
 *     used as a subtitle right under a page title to set the scene.
 *   - `'muted'`   — smaller secondary paragraph (`text-sm` 12px + `fg-muted`)
 *     for captions / footnotes / chrome copy.
 */
export type BodyVariant = 'default' | 'lead' | 'muted'

// Body 14/1.57 · lead 18/1.4 · caption 12/1.5 — the canvas' `body`, `lead` and
// `caption` steps.
//
// None of the three carries a `leading-*` class any more, and that is the point
// of the ladder rather than an omission: each rung now emits its own
// `--text-{rung}--line-height`, snapped to the 4px grid at that size, so the
// leading arrives with the size and cannot drift away from it. A `leading-*`
// class here would also have WON the tailwind-merge conflict and replaced the
// rung's own leading — which is how `leading-relaxed` (1.625) came to sit on a
// step the canvas draws at 1.55.
const BODY_VARIANT: Record<BodyVariant, string> = {
  default: [`text-[${v('sv-fg', T.fg)}]`, 'text-md'].join(' '),
  lead: [`text-[${v('sv-fg-muted', T.fgMuted)}]`, 'text-xl'].join(' '),
  muted: [`text-[${v('sv-fg-muted', T.fgMuted)}]`, 'text-sm'].join(' '),
}

/**
 * Compute the default className for a paragraph (`<p>`) rendered inside
 * the typography-in-chrome cluster. The `variant` parameter routes through
 * the body palette (`default` / `lead` / `muted`), each painting size +
 * leading + color so the role is legible at a glance.
 *
 * Layout (`mb-3`, etc.) stays the consumer's responsibility — the
 * vertical rhythm between paragraphs depends on the surrounding
 * composition. The helper only ships the type role.
 */
export const computeBodyClasses = ({
  variant = 'default',
}: {
  readonly variant?: BodyVariant
} = {}): string => BODY_VARIANT[variant]

// ──────────────────────────────────────────────────────────────────────────────
// INLINE CODE — the `<code>` mark inside a sentence
// ──────────────────────────────────────────────────────────────────────────────

const INLINE_CODE = [
  // 12px — the canvas sets an inline `<code>` one rung under the prose it
  // interrupts, so the mono face does not out-measure the sentence around it.
  'font-mono text-sm',
  'px-1 py-0.5',
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
  `rounded-[${v('radius-sm', T.radiusSm)}]`,
].join(' ')

/**
 * Compute the default className for an inline `<code>` mark — the
 * code-as-chip pattern inside a sentence ("call `compileCSS(app)` to
 * build"). Paints a subtle background (`sv-bg-subtle`) so the inline
 * token reads as a distinct chip without overwhelming the sentence;
 * small radius (`radius-sm`) clips the chip tight to its glyphs so it
 * rides inside the line rather than sitting on it — the same 2px step a
 * status badge uses, because both are labels that are read rather than
 * pressed, and neither should read as a control; mono font + slightly smaller
 * size (`text-sm` inside a `text-md` paragraph) signals "this is code".
 *
 * Padding is intentionally TIGHT (`px-1 py-0.5`) so the inline chip
 * doesn't break the surrounding line-height — the paragraph reads as a
 * single visual line, with the code mark riding on top.
 */
export const computeInlineCodeClasses = (): string => INLINE_CODE

// ──────────────────────────────────────────────────────────────────────────────
// CODE BLOCK — multi-line code sample container
// ──────────────────────────────────────────────────────────────────────────────

const CODE_BLOCK = [
  'p-4 overflow-x-auto',
  // 12px, matching the canvas `.code` well and the inline mark above it: a
  // sample that changes size between running text and its own block reads as
  // two different languages.
  'font-mono text-sm',
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `rounded-[${v('radius-md', T.radiusMd)}]`,
].join(' ')

/**
 * Compute the default className for a code-block container — a `<pre>` or
 * `<div>` wrapping a multi-line code sample. Paints the same subtle
 * background as inline code (`sv-bg-subtle`) so inline + block code share
 * a tone; adds a border + `radius-md` to give the block a definite
 * boundary; and sets the SAME `text-sm` as inline code, because a sample that
 * changes size between running text and its own block reads as two different
 * languages. It used to sit a step smaller, on the argument that a framed block
 * need not track the parent paragraph's line-height — true, and an argument for
 * leaving the LEADING alone rather than for shrinking the type.
 *
 * `overflow-x-auto` is critical for long lines — without it, a wide code
 * sample would push the page's layout. The horizontal scrollbar lives
 * inside the block, never affecting the surrounding flow.
 */
export const computeCodeBlockClasses = (): string => CODE_BLOCK

// ──────────────────────────────────────────────────────────────────────────────
// BLOCKQUOTE — pulled-quote wrapper + emphasis inner line
// ──────────────────────────────────────────────────────────────────────────────

const BLOCKQUOTE_WRAPPER = [
  'border-l-4 pl-4 italic',
  `border-[${v('sv-border', T.border)}]`,
  `text-[${v('sv-fg-muted', T.fgMuted)}]`,
].join(' ')

/**
 * Compute the default className for a blockquote wrapper — the visual
 * frame around a pulled quotation. Paints a left-border accent rule
 * (`border-l-4`) so the quote reads as a distinct callout; italic +
 * `fg-muted` step the quote BACK from body copy (a quote is reflective,
 * not load-bearing). The `pl-4` opens up the gap between the accent rule
 * and the quoted text.
 *
 * The wrapper carries the `italic` mark so a plain `<p>` inside (without
 * its own `italic` className) inherits the italic style — which is what
 * lets the inner emphasis line differ from it by TONE alone, via
 * `computeBlockquoteEmphasisClasses`.
 */
export const computeBlockquoteClasses = (): string => BLOCKQUOTE_WRAPPER

const BLOCKQUOTE_EMPHASIS = ['italic', `text-[${v('sv-fg', T.fg)}]`].join(' ')

/**
 * Compute the default className for the inner emphasis line of a
 * blockquote — one line of a quotation lifted back to full strength while
 * the rest of it stays stepped back.
 *
 * The emphasis is carried by TONE ALONE: the wrapper already paints
 * `italic` + `fg-muted`, and this helper re-states `italic` (so the line
 * stands on its own outside that wrapper) and swaps the muted tone for
 * the workhorse `fg` role. Nothing else changes, which is why the two
 * recipes differ by a single token.
 *
 * ─── WHAT THIS DELIBERATELY NO LONGER DOES ────────────────────────────
 *
 * It was once a "grace note" in Source Serif 4 italic on a warm
 * `sv-fg-humane` brown. [internal ref] amendment A2 withdrew BOTH: the serif
 * family (no `--font-serif`, no Source Serif face) and the `fg-humane`
 * role. Neither has been emitted by the theme layer since, so this helper
 * has painted plain `italic` + `fg` throughout — the prose here described
 * an identity the runtime had already dropped.
 */
export const computeBlockquoteEmphasisClasses = (): string => BLOCKQUOTE_EMPHASIS

// ──────────────────────────────────────────────────────────────────────────────
// LIST — container + item
// ──────────────────────────────────────────────────────────────────────────────

const LIST_CONTAINER = 'flex flex-col gap-1'

/**
 * Compute the default className for a list container (UL / OL / the
 * fixture's flat-flex `<container>`-of-`<span>` rendering). Pure
 * structural rhythm — flex column + small gap so items stack with a
 * tight vertical cadence. No border / bg of its own; the container is a
 * structural primitive that inherits surface tone from its parent.
 *
 * Layout-only helper: returns the same class string regardless of
 * variant (ordered vs unordered), because the visual difference between
 * the two lives in the LEADING MARKER (`'• '` vs `'1. '`) baked into
 * each item's content string by the fixture, not in any container-level
 * style. If a future cluster opts into native `list-disc` / `list-decimal`
 * markers, this helper can grow a `variant` parameter at that point.
 */
export const computeListClasses = (): string => LIST_CONTAINER

// A list item is prose, so it sits on the body step rather than a step of its own.
const LIST_ITEM = [`text-[${v('sv-fg', T.fg)}]`, 'text-md'].join(' ')

/**
 * Compute the default className for an individual list item. Body-text
 * size + neutral `sv-fg` color so the item reads as content (not chrome),
 * tracking the same tone as a default body paragraph. The fixture
 * renders list items as `<span>` children of a flex container (rather
 * than `<li>`) to keep the ARIA tree flat, so the marker glyph ('•' / '1.')
 * is part of the content string — the helper still ships the same type
 * recipe so the painted item is consistent across both rendering shapes.
 */
export const computeListItemClasses = (): string => LIST_ITEM
