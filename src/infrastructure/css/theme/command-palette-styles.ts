/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Command-palette stylesheet (wave R-F, the chrome pass).
 *
 * ## What it replaces: nothing
 *
 * The palette had no styling at all. Its overlay and panel carried a handful of
 * hardcoded inline styles — an `0.5rem` radius, a `0 10px 40px rgba(0,0,0,0.25)`
 * shadow, a `40%` scrim — none of which came from a token; and everything INSIDE
 * the panel was bare DOM. Section headings rendered as browser-default `<h3>`s,
 * results as unpadded `<div role="option">`s, the table badge and the excerpt as
 * undifferentiated runs of text.
 *
 * The visible consequence was worse than untidiness. `highlight()` marks the
 * keyboard-focused row with `data-active="true"` and `aria-selected="true"`, and
 * nothing painted either — so arrowing down a list of results moved a selection
 * the reader could not see. The palette is a keyboard surface first; that is the
 * one thing it could not afford to be missing.
 *
 * ## Why plain CSS rather than utilities
 *
 * Same three reasons as `calendar-styles.ts`, which this file sits beside in
 * `buildSourceCSS`:
 *
 *  - **It flows through BOTH compile engines** — the native PostCSS path and the
 *    pure-JS engine the compiled binary runs — so it needs no Tailwind candidate
 *    scan to reach the served stylesheet.
 *  - **The DOM is built by a runtime string**, not by a renderer. Attaching
 *    classes there would mean adding each one to the candidate corpus by hand
 *    and keeping the two in step forever.
 *  - **Two of the rules are state selectors** (`[data-active="true"]`,
 *    `::placeholder`) on elements created by `document.createElement`. An inline
 *    style cannot express either, which is precisely why the active row was
 *    unpainted.
 *
 * ## The vocabulary is the menu's
 *
 * A palette is a menu that happens to be centred: the reference draws its rows
 * at the same 5px/8px step, the same 4px radius and the same subtle fill as a
 * dropdown item, and its panel at the menu radius under the dialog shadow. So
 * the values here are not invented for this surface — they restate
 * `overlay-default-classes.ts`'s menu block in selector form, and any future
 * move of that block should move these with it.
 */

/**
 * The overlay and its panel.
 *
 * The scrim matches the dialog backdrop's own 50% rather than the 40% the
 * runtime hardcoded: two modal surfaces dimming the page by different amounts
 * reads as one of them being slightly broken.
 */
const PALETTE_SHELL_RULES = `[data-command-palette] {
      background-color: color-mix(in oklab, var(--sv-scrim) 50%, transparent);
    }

    [data-command-palette] > div {
      background-color: var(--sv-bg-raised);
      color: var(--sv-fg);
      border: 1px solid var(--sv-border);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-lg);
    }`

/**
 * The search row.
 *
 * A field at the top of a panel, so it takes the field step (8px/12px at the
 * base rung) and marks its bottom edge with the same hairline every other
 * header row in the system uses. It carries no border of its own and no focus
 * ring: it is the only control in the panel and is focused the instant the
 * palette opens, so a ring around it would be permanent chrome rather than a
 * state.
 */
const PALETTE_INPUT_RULES = `[data-command-palette-input] {
      padding: 8px 12px;
      font-size: var(--text-base);
      line-height: var(--text-base--line-height);
      background-color: transparent;
      color: var(--sv-fg);
      border-bottom: 1px solid var(--sv-border);
    }

    [data-command-palette-input]::placeholder {
      color: var(--sv-fg-disabled);
    }`

/**
 * The result list: headings, rows, and the two things a row can carry after its
 * label.
 *
 * The active row is the reason this file exists. It is painted by fill and not
 * by outline, matching a highlighted menu item, so moving through the list reads
 * as one mark travelling rather than as rows lighting up.
 */
const PALETTE_RESULTS_RULES = `[data-command-palette-results] {
      padding: 4px;
    }

    [data-command-palette-heading] {
      padding: 6px 8px 2px;
      font-size: var(--text-xs);
      line-height: var(--text-xs--line-height);
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--sv-fg-subtle);
    }

    [data-command-palette] [role='option'] {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      padding: 5px 8px;
      border-radius: var(--radius-base);
      font-size: var(--text-base);
      line-height: var(--text-base--line-height);
      cursor: pointer;
    }

    [data-command-palette] [role='option']:hover,
    [data-command-palette] [role='option'][data-active='true'] {
      background-color: var(--sv-bg-subtle);
    }

    [data-command-palette-table] {
      font-size: var(--text-xs);
      line-height: var(--text-xs--line-height);
      color: var(--sv-fg-subtle);
    }

    [data-command-palette-excerpt] {
      flex-basis: 100%;
      font-size: var(--text-sm);
      line-height: var(--text-sm--line-height);
      color: var(--sv-fg-subtle);
    }

    [data-command-palette-excerpt] mark {
      background-color: var(--sv-bg-subtle);
      color: var(--sv-fg);
      font-weight: 500;
    }`

/**
 * The record-creation dialog the palette opens.
 *
 * It was the least finished surface in the console: a browser-default `<h2>`
 * over unlabelled-looking rows of bare `<input>`s over two bare `<button>`s.
 * The rows take the form vocabulary — a 12px label above its control, the
 * control at the field step — and the actions sit on a hairline at the bottom
 * right, which is where every other confirm/cancel pair in the system sits.
 *
 * The submit button is drawn as primary and the cancel as ghost by SELECTOR
 * rather than by class, for the same reason as everything else here: the two
 * elements are created by a runtime string with no class attribute to give them.
 */
const PALETTE_CREATE_DIALOG_RULES = `[data-create-record-dialog] {
      background-color: color-mix(in oklab, var(--sv-scrim) 50%, transparent);
    }

    [data-create-record-dialog] > div {
      background-color: var(--sv-bg-raised);
      color: var(--sv-fg);
      border: 1px solid var(--sv-border);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-lg);
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    [data-create-record-dialog] h2 {
      font-size: var(--text-lg);
      line-height: var(--text-lg--line-height);
      font-weight: 600;
    }

    [data-create-record-dialog] form {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    [data-create-record-dialog] form > div {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    [data-create-record-dialog] label {
      font-size: var(--text-sm);
      line-height: var(--text-sm--line-height);
      font-weight: 500;
      color: var(--sv-fg);
    }

    [data-create-record-dialog] input {
      height: 36px;
      padding: 8px 12px;
      font-size: var(--text-base);
      line-height: var(--text-base--line-height);
      background-color: var(--sv-bg-raised);
      color: var(--sv-fg);
      border: 1px solid var(--sv-border-strong);
      border-radius: var(--radius-base);
    }

    [data-create-record-dialog] form > div:last-of-type {
      flex-direction: row;
      justify-content: flex-end;
      gap: 8px;
      border-top: 1px solid var(--sv-border);
      padding-top: 12px;
    }

    [data-create-record-dialog] button {
      height: 32px;
      padding: 6px 12px;
      font-size: var(--text-base);
      line-height: var(--text-base--line-height);
      font-weight: 500;
      border-radius: var(--radius-base);
      border: 1px solid transparent;
      cursor: pointer;
    }

    [data-create-record-dialog] button[type='submit'] {
      background-color: var(--sv-primary);
      color: var(--sv-primary-fg);
      border-color: var(--sv-primary);
    }

    [data-create-record-dialog] button[data-create-record-close] {
      background-color: transparent;
      color: var(--sv-fg-muted);
    }

    [data-create-record-dialog] button[data-create-record-close]:hover {
      background-color: var(--sv-bg-subtle);
      color: var(--sv-fg);
    }`

/**
 * The confirmation toast the palette raises after a dark-mode toggle.
 *
 * An ink chip, as the reference draws it: the inverse of everything around it,
 * which is what makes it read as floating without a second elevation step.
 */
const PALETTE_TOAST_RULES = `[data-sonner-toaster] {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    [data-sonner-toaster] [data-toast] {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      background-color: var(--sv-fg);
      color: var(--sv-bg);
      border: 1px solid var(--sv-border);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-lg);
      font-size: var(--text-sm);
      line-height: var(--text-sm--line-height);
    }`

/**
 * Generate the command-palette stylesheet.
 *
 * Takes no argument, like `generateCalendarStyles()` and
 * `generateMarqueeStyles()`: every value is either a fixed geometry from the
 * reference or an indirection into an existing `--sv-*` / `--radius-*` /
 * `--shadow-*` / `--text-*` token, so an author's override reaches the palette
 * without this generator knowing the author exists.
 */
export function generateCommandPaletteStyles(): string {
  return [
    '/* ── Command palette + its record dialog and toast — wave R-F ── */',
    PALETTE_SHELL_RULES,
    PALETTE_INPUT_RULES,
    PALETTE_RESULTS_RULES,
    PALETTE_CREATE_DIALOG_RULES,
    PALETTE_TOAST_RULES,
  ].join('\n\n    ')
}
