/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `.rte` content block — how rich text reads inside the editor and
 * wherever a rich-text value is rendered back out (wave R-E).
 *
 * ## What it replaces, and why that had to happen
 *
 * The editor body carried `prose prose-sm dark:prose-invert
 * prose-strong:text-inherit`. Tailwind Typography is a good stylesheet for an
 * article; it is the wrong one for a field, for three reasons that compound:
 *
 *  - **It pins its own palette.** Typography sets colours from its own scale,
 *    not from `--sv-*`, so a themed app moved every surface around the editor
 *    and none of the text inside it. Two of the four classes above existed
 *    only to claw individual colours back one at a time — `dark:prose-invert`
 *    for the dark ground, `prose-strong:text-inherit` because a bold run was
 *    otherwise painted a fixed near-black that vanished on it.
 *  - **It pins its own type scale.** `prose-sm` is 14px/1.71 with an `em`-based
 *    heading ramp of its own, which is a magazine scale rather than the
 *    platform ladder. Text inside the field was a different size from text in
 *    every field beside it.
 *  - **Its rhythm is built for a page.** Typography's paragraph margins are
 *    sized for an article column; in a 56px-tall control they are most of the
 *    box.
 *
 * The canvas (`variants.mjs:157`, `richEditor`) asks for 13px on 1.6 — the
 * platform body rung — with a rhythm tight enough that three paragraphs fit a
 * field. That is a small, specific stylesheet, so it is written as one rather
 * than configured out of a large one.
 *
 * ## Why plain CSS, and where it goes
 *
 * Composed into `buildSourceCSS` (`infrastructure/css/compiler.ts`) beside
 * `generateCodeBlockStyles`, `generateMarqueeStyles` and
 * `generateCalendarStyles`, for the same two reasons those are there:
 *
 *  - It flows through BOTH compile engines — the native PostCSS path and the
 *    pure-JS engine inside the compiled binary — so it needs no Tailwind
 *    candidate scan to reach the served stylesheet.
 *  - It is not utility-shaped. These are DESCENDANT rules over markup the
 *    author types (`.rte h2`, `.rte ul > li`), which no class on the wrapper
 *    can express and which the candidate-driven compiler could never mint.
 *
 * ## What it does NOT do
 *
 * It does not let the Typography plugin be dropped: `markdown-article.tsx` is
 * still a `prose` consumer, and an article genuinely is the thing Typography
 * is for. Only the FIELD moves.
 */

/** The block's own baseline — size, leading, ink — plus the two edge rules
 * that stop a field's first and last child pushing margin outside the box. */
const RTE_ROOT = `
    /* ── Rich-text content ───────────────────────────────────────────────── */
    .rte {
      font-size: 0.8125rem;
      line-height: 1.6;
      color: var(--sv-fg, oklch(0.14 0 0));
      overflow-wrap: break-word;
    }
    .rte > :first-child { margin-top: 0; }
    .rte > :last-child { margin-bottom: 0; }
`

/** Paragraphs and the heading ramp: the vertical rhythm. */
const RTE_FLOW = `
    /* \`font-size\` and \`line-height\` are restated, not inherited. The base layer
       carries its own \`p { }\` rule at (0,0,1), and an ELEMENT rule beats an
       inherited value however specific the ancestor that set it — so a paragraph
       inside \`.rte\` kept the page's 14px body step while everything around it
       sat at 13px. \`.rte p\` is (0,1,1) and wins. Measured: without this the
       container computed 13px/20.8 and every \`<p>\` inside it 14px/22. */
    .rte p {
      margin: 0 0 0.5em;
      font-size: inherit;
      line-height: inherit;
    }

    /* Headings step DOWN into the field rather than up out of it: the field's
       own label already sits above the box, so a heading inside the content is
       structure within a value, not a title for it. */
    .rte h1, .rte h2, .rte h3, .rte h4, .rte h5, .rte h6 {
      margin: 1em 0 0.35em;
      font-weight: 600;
      line-height: 1.3;
      color: var(--sv-fg, oklch(0.14 0 0));
    }
    .rte h1 { font-size: 1.125rem; }
    .rte h2 { font-size: 1rem; }
    .rte h3 { font-size: 0.875rem; }
    .rte h4, .rte h5, .rte h6 { font-size: 0.8125rem; }
`

/** Inline marks — emphasis, strike, underline, links. */
const RTE_MARKS = `
    /* Emphasis is a WEIGHT, not a colour. A bold run takes the same ink as the
       paragraph around it and stands out by being heavier — which keeps every
       character in the body on one token, so a themed app moves all of it at
       once. Typography painted it a fixed near-black instead, which is why the
       editor needed a per-element override to undo. */
    .rte strong, .rte b { font-weight: 600; color: inherit; }
    .rte em, .rte i { font-style: italic; }
    .rte s, .rte del { text-decoration: line-through; }
    .rte u { text-decoration: underline; text-underline-offset: 2px; }

    .rte a {
      color: inherit;
      text-decoration: underline;
      text-underline-offset: 2px;
    }
`

/** Lists and quotations. */
const RTE_LISTS = `
    .rte ul, .rte ol { margin: 0 0 0.5em; padding-left: 1.25em; }
    .rte ul { list-style: disc; }
    .rte ol { list-style: decimal; }
    .rte li { margin: 0.15em 0; }
    .rte li > ul, .rte li > ol { margin: 0.15em 0 0; }

    /* A quote is marked by a rule and an indent, never by a tint: colour is
       reserved for consequence, and a quotation is not one. */
    .rte blockquote {
      margin: 0.5em 0;
      padding-left: 0.75em;
      border-left: 2px solid var(--sv-border, oklch(0.92 0 0));
      color: var(--sv-fg-muted, oklch(0.445 0 0));
    }
`

/** Code, inline and in a block. */
const RTE_CODE = `
    .rte code {
      font-family: var(--font-mono, ui-monospace, monospace);
      font-size: 0.9em;
      padding: 0.1em 0.3em;
      border-radius: var(--radius-sm, 2px);
      background: var(--sv-bg-subtle, oklch(0.965 0 0));
    }
    .rte pre {
      margin: 0.5em 0;
      padding: 0.75em 1em;
      overflow-x: auto;
      border: 1px solid var(--sv-border, oklch(0.92 0 0));
      border-radius: var(--radius-md, 6px);
      background: var(--sv-bg-subtle, oklch(0.965 0 0));
      font-family: var(--font-mono, ui-monospace, monospace);
      font-size: 0.75rem;
      line-height: 1.7;
    }
    /* A code block already has a ground and a border; the inline chip's own
       would be a box inside a box. */
    .rte pre code { padding: 0; background: none; font-size: inherit; }
`

/** Rules, images and tables. */
const RTE_FIGURES = `
    .rte hr {
      margin: 0.75em 0;
      border: 0;
      border-top: 1px solid var(--sv-border, oklch(0.92 0 0));
    }

    .rte img {
      max-width: 100%;
      height: auto;
      border-radius: var(--radius-base, 4px);
    }

    /* Same 11px header / 12px body split the data views use, so a table typed
       into a rich-text field reads like a table rendered by the platform. */
    .rte table {
      width: 100%;
      margin: 0.5em 0;
      border-collapse: collapse;
    }
    .rte th, .rte td {
      padding: 0.3em 0.5em;
      text-align: left;
      vertical-align: top;
      border-bottom: 1px solid var(--sv-border, oklch(0.92 0 0));
    }
    .rte th {
      font-size: 0.6875rem;
      font-weight: 500;
      color: var(--sv-fg-subtle, oklch(0.54 0 0));
      border-bottom-color: var(--sv-border-strong, oklch(0.87 0 0));
    }
    .rte td { font-size: 0.75rem; }
`

/** Tiptap's own editable root, which takes its focus ring from the frame. */
const RTE_EDITOR = `
    /* Tiptap's editable root fills the box it was given and takes its focus
       ring from the frame, not from itself. */
    .rte .ProseMirror { outline: none; }
    .rte .ProseMirror-selectednode {
      outline: 2px solid var(--sv-focus-ring, oklch(0.205 0 0));
      outline-offset: 1px;
    }
`

/**
 * Emit the `.rte` block.
 *
 * Every colour is a `--sv-*` read with the design-system default as its
 * fallback, so a theme override wins at the cascade and an unthemed app still
 * paints correctly. Sizes are the platform ladder's rungs spelled as `rem`
 * rather than as `--text-*` reads, because these rules are emitted outside the
 * utility layer where those variables are not guaranteed to be in scope.
 *
 * Composed from named blocks rather than one template literal, the way
 * `calendar-styles.ts` and `command-palette-styles.ts` are: a stylesheet this
 * size reads better as named sections than as one wall, and each name says
 * what its rules are for.
 */
export function generateRichTextStyles(): string {
  return [RTE_ROOT, RTE_FLOW, RTE_MARKS, RTE_LISTS, RTE_CODE, RTE_FIGURES, RTE_EDITOR].join('\n\n')
}
