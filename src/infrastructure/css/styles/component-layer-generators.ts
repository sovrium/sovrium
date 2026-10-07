/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { generateClickAnimationCSS } from '@/infrastructure/css/styles/click-animations'

/**
 * Component-layer class builders.
 *
 * The always-present default token layer (`default-theme-layer.ts`, injected by
 * `compiler.ts`) guarantees every canonical role token (`bg`, `fg`, `primary`,
 * `border`, `error-*`, …) is defined — with light/dark values, and recolored by
 * author `design.colors` via the alias bridge. So these builders emit canonical
 * token classes UNCONDITIONALLY; the old literal-color fallback branches
 * (`bg-blue-600`, `border-gray-200`, …) are dead and have been removed.
 *
 * ## Why this layer is nearly empty
 *
 * It carries no rule per component name — no `.card`, `.badge`, `.btn` and its
 * variants, `.toast`, `.nav`, `.sidebar`, `.modal-*`, `.alert-*` or
 * `.data-table th`. Such a rule is useless for one of two reasons:
 *
 *  - **Nothing wears the class.** `.toast`, `.nav`, `.sidebar`, `.modal-*`,
 *    `.alert-*`, `.data-table th` and `.container-page` have no emitter at all.
 *    The real toast is `[data-toast]`, the real nav and alerts are their own
 *    recipes. A rule for those names only matches fixtures that invent them.
 *  - **A recipe already paints it.** `.card`, `.badge` and the `.btn-*` family
 *    as `@apply` rules would sit in `@layer components`, while the recipes
 *    covering the same elements land in `@layer utilities`, which WINS in
 *    Tailwind v4. Such rules are painted over and drift into being wrong
 *    unnoticed (a `.card` shadow where a card casts none; a pill `.badge` where
 *    a badge is barely rounded) — invisible precisely because they never reach
 *    the screen.
 *
 * The CLASSES in that second group are still emitted onto the DOM and must stay
 * there: `style-processor.ts` writes them from `COMPONENT_TYPE_CLASS_MAP`, and
 * `variantFromButtonClassName` reads the `btn-*` token back to recover a
 * button's variant. Retiring a RULE is cascade-safe; removing the class is not.
 *
 * What survives here is only what nothing else provides: the bare-element
 * `input, select, textarea` chrome, the standalone form shell, and `.btn-icon`
 * — the one rule with a geometric effect (36×36 where the same button would be
 * 42×36) that no recipe duplicates.
 */

/**
 * Build input element classes — the Notion / Airtable-grade DEFAULT for every
 * `<input>` / `<select>` / `<textarea>` across every Sovrium business app AND
 * the admin console. Emitted ONCE under `@layer components` (see
 * {@link generateElementRules}), so any form gets polished controls with zero
 * per-app config — the dogfood win — while staying 100% overridable (author
 * `className` and `app.design.*` tokens still win at the cascade).
 *
 * Beyond the bare surface/border/focus tokens, this paints the chrome bare
 * inputs were missing: a calm rounded shape (`rounded-md`), comfortable
 * padding + a consistent control height (`px-3 py-2 text-sm leading-tight`),
 * full-width so controls fill their field column, a quiet muted placeholder, a
 * smooth focus transition, a clear focus ring with a tightened border, and a
 * legible disabled state. Color goes through canonical role tokens only —
 * never raw colors — so design overrides win.
 *
 * A `<select>` needs more than this shared surface to look like the input
 * beside it — native drawing off, a chevron, a wider right inset and a muted
 * placeholder — and gets it from `buildSelectRules`, which lives in the
 * utilities layer for the reason documented there.
 *
 * @returns CSS class string for input/select/textarea base styles
 */
export function buildInputClasses(): string {
  return [
    'block',
    'w-full',
    'rounded-md',
    'border',
    'border-border',
    'bg-background',
    'px-3',
    'py-2',
    'text-sm',
    'leading-tight',
    'text-foreground',
    'placeholder:text-foreground-subtle',
    'transition-colors',
    'focus:border-focus-ring',
    'focus:ring-2',
    'focus:ring-focus-ring',
    'focus:ring-offset-2',
    // The offset takes the page ground. Left without a colour it falls back to
    // Tailwind's literal `#fff` — invisible on a light page and a white halo on
    // a dark one, which reads as a glow around the field rather than as the gap
    // the offset exists to be. `background` is the scheme-aware role, so one
    // declaration is right in both schemes.
    'focus:ring-offset-background',
    'focus:outline-none',
    'disabled:cursor-not-allowed',
    'disabled:opacity-60',
  ].join(' ')
}

/**
 * The one surviving `.btn-*` rule.
 *
 * Its siblings (`.btn`, `.btn-primary`, the variant and size modifiers) were
 * all overpainted by the button recipe in `@layer utilities` and have been
 * retired. This one is different because it changes GEOMETRY rather than
 * colour: an icon button is 36×36 where the same button would be 42×36, and no
 * recipe reproduces that. The square is pinned by
 * `component-schema-enhancements.spec.ts` and `config/config-contract.spec.ts`.
 *
 * @returns the `@layer components` rule fragment for the icon button
 */
function buildIconButtonRule(): string {
  return `
      .btn-icon { @apply p-0 h-9 w-9; }`
}

/**
 * Build the default chrome for STANDALONE form pages (`form-renderer.tsx`):
 * the `.form-page` shell, the `.form-title` / `.form-description` header, and
 * the submit button. These class names were previously decorative (no backing
 * rule), so a standalone form rendered as edge-to-edge bare controls. Emitting
 * real rules here gives every `app.forms[]` form an Airtable/Notion-grade
 * default — a centered card with comfortable padding, a clear title hierarchy,
 * and a real primary submit button — with zero per-form config, while staying
 * fully overridable (author `display.theme` tokens + role tokens win).
 *
 * @returns the `@layer components` rule fragment for the form shell
 */
function buildFormShellRules(): string {
  return `
      .form-page {
        @apply mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10 sm:px-6 md:py-16;
      }
      .form-page > form {
        @apply rounded-lg border border-border bg-background-raised p-6 shadow-sm sm:p-8;
      }
      /* The standalone form's title is that page's h1, so it takes the h1 rung
         (30px) — and the description under it takes the lead rung (18px), the
         same pair \`computeHeadingClasses\` and \`computeBodyClasses\` produce for
         a title and its deck anywhere else.

         Both moved when the platform ladder did. The pass that held rendered
         sizes steady across the repo skipped this file, so \`text-3xl\` kept its
         name and quietly became 24px; \`APP-THEME-COMP-008\` is the spec that
         caught it. Neither carries a \`leading-*\` class any more, for the reason
         the prose recipes do not: a rung emits its own line-height, and a
         leading class WINS the merge and replaces it.

         The display size is scoped to \`.form-page\`: only there is the title
         the page's h1. An embedded form's title is a section of its host page
         (\`props.headingLevel\` demotes it to h2/h3), so it keeps the size of
         the heading level it renders as instead of outsizing the page's own
         h1. */
      .form-title {
        @apply text-foreground font-semibold tracking-tight;
      }
      .form-page .form-title {
        @apply text-4xl;
      }
      .form-description {
        @apply text-foreground-muted max-w-prose text-xl;
      }
      /* The negative top margin tightens the title→description pair against the
         standalone shell's \`gap-6\` flex rhythm. It is scoped to \`.form-page\`
         so it applies ONLY on the standalone form page — an embedded/dialog form
         body (rendered WITHOUT the \`.form-page\` shell) keeps normal, non-cramped
         title→description spacing instead of pulling the description up under the
         title. */
      .form-page .form-description {
        @apply -mt-3;
      }
      .form-group-label {
        @apply text-foreground border-border border-b pb-2 text-base font-semibold;
      }`
}

/**
 * The chevron a single-value `<select>` is painted with once the browser's own
 * arrow is switched off. A 16px lucide `chevron-down`, inlined as a data URI.
 *
 * The stroke is a fixed MID-TONE grey rather than a theme token, because a
 * data URI is a separate document: it cannot read `currentColor` or a CSS
 * custom property. `#808080` clears the 3:1 non-text contrast floor against
 * both a white ground (~3.9:1) and a near-black one (~5:1), so one image
 * serves the light and the dark scheme — and every scoped design-system
 * specimen, which a second image keyed off `html.dark` would miss.
 */
export const SELECT_CHEVRON_DATA_URI =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23808080' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")"

/**
 * The select-only rules: native `<select>` chrome that matches the inputs.
 *
 * `input, select, textarea` paints the shared surface but cannot switch off
 * the browser's own drawing: with `appearance` left at `auto` a select keeps
 * its native arrow, its own inner metrics and — on WebKit — the whole popup
 * button, which ignores the radius and ground the shared rule sets. So a
 * single-value select (a `multiple` or `size`d one is a list box, not a
 * dropdown, and keeps no chevron) turns native drawing off, takes the Sovrium
 * chevron, and widens its right inset so the value never runs under it.
 * The inset is LOGICAL (`padding-inline-end`) but `background-position` has
 * no logical keyword, so a right-to-left page (`languages.direction: rtl`)
 * moves the chevron to the left explicitly — otherwise the inset would open
 * on the left while the chevron stayed on the right, over the value.
 *
 * The second rule mutes the empty leading option — the field's placeholder —
 * to the same token an input's `::placeholder` uses, so "Choose a platform"
 * does not read as an answer. It stops applying the moment a real option is
 * chosen. Options inherit the select's colour, so while the placeholder is
 * chosen the real options are put back to the foreground — otherwise every
 * choice in an opened list (Firefox, Chromium on Windows and Linux) would read
 * as greyed out.
 *
 * These live in `@layer utilities`, NOT beside the element rule in
 * `@layer components`, and that is load-bearing. Most selects the engine
 * paints carry a class string of their own — the crud-form controls, the
 * platform `select.native`, the data-table panels and pager, the comment sort
 * — and every one of them sets a horizontal padding (`px-2`, `px-3`) from the
 * utilities layer, which beats ANY component-layer padding. Native drawing
 * reserved the arrow's room inside the control itself; once it is switched
 * off nothing does, so a component-layer inset would leave every classed
 * select with its value running under the chevron. Inside the utilities layer
 * the selectors' specificity (two pseudo-classes plus a type) outranks a
 * single-class utility, so the inset and the muted placeholder hold on every
 * select, classed or bare, from one rule rather than from a `pr-9` each call
 * site would have to remember.
 *
 * A COMPACT select — the 24px pager page-size control, the comment sort, the
 * select inside an editable grid cell — opts into a smaller chevron and a
 * proportionate inset with the plain marker class `select-compact`. That is
 * opted into rather than inferred because CSS cannot read a control's height:
 * no selector can tell a `h-6` select from a full-height one. The marker is
 * carried by each compact control's class recipe, not by its call sites, and
 * its selector adds a class to the base one, so it outranks the standard inset
 * (right-to-left twin included) without an `!important`.
 */
function buildSelectRules(): string {
  return `
      select:not([multiple]):not([size]) {
        appearance: none;
        background-image: ${SELECT_CHEVRON_DATA_URI};
        background-repeat: no-repeat;
        background-position: right 0.75rem center;
        background-size: 1rem;
        padding-inline-end: 2.25rem;
      }
      select:not([multiple]):not([size]):dir(rtl) { background-position: left 0.75rem center; }
      select.select-compact:not([multiple]):not([size]) {
        background-position: right 0.375rem center;
        background-size: 0.75rem;
        padding-inline-end: 1.5rem;
      }
      select.select-compact:not([multiple]):not([size]):dir(rtl) { background-position: left 0.375rem center; }
      select:has(option[value=""]:checked) { @apply text-foreground-subtle; }
      select:has(option[value=""]:checked) option:not([value=""]) { @apply text-foreground; }`
}

/**
 * The controls of a form field (`.form-field`, the wrapper every `app.forms[]`
 * field renders in) that hold ONE line of text: every `<input>` but the ones
 * that draw a mark, a slider, a swatch or a button, and a dropdown `<select>`.
 *
 * They take the `input` component's height (`h-9`, 36px — the canvas `.input`
 * and `density.controlH`), so a form's controls and an input written as a
 * component beside it are one size. The shared padding alone drew them at
 * 33px. A `<textarea>` and a list-box select grow with their content and keep
 * no fixed height. Scoped to the form field rather than every bare element:
 * the compact controls islands draw (a pager's page box, a grid cell editor)
 * carry their own padding and no height, and must not grow to 36px.
 */
const SINGLE_LINE_CONTROL_SELECTOR = [
  '.form-field input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]):not([type="hidden"]):not([type="image"]):not([type="submit"]):not([type="button"]):not([type="reset"])',
  '.form-field select:not([multiple]):not([size])',
].join(', ')

/**
 * The bare-ELEMENT rule. Unlike a component class rule,
 * this one has no recipe to be overpainted by: it is what a plain `<input>`
 * looks like when nobody styled it, which is exactly the case a component
 * recipe never reaches.
 */
function generateElementRules(): string {
  return `
      input, select, textarea { @apply ${buildInputClasses()}; }
      ${SINGLE_LINE_CONTROL_SELECTOR} { @apply h-9; }
${buildFormShellRules()}`
}

/**
 * Generate the `@layer components` block.
 *
 * Deliberately small — see the module header for why there are no component
 * class rules. It takes no `design`: every rule here is design-independent.
 *
 * @returns CSS @layer components rule as string
 */
export function generateComponentsLayer(): string {
  return `@layer components {${buildIconButtonRule()}
${generateElementRules()}
    }`
}

/**
 * Generate utilities layer styles
 * Combines static utilities with click interaction animations
 *
 * @returns CSS @layer utilities rule as string
 *
 * @example
 * generateUtilitiesLayer()
 * // => '@layer utilities { .text-balance { ... } ... }'
 */
export function generateUtilitiesLayer(): string {
  const clickAnimations = generateClickAnimationCSS()

  return `@layer utilities {
      .text-balance {
        text-wrap: balance;
      }

      /* Safelist: Ensure critical utility classes are always included */
      .text-center {
        text-align: center;
      }

      /* Override Tailwind v4's multi-layer shadow system for shadow-none */
      .shadow-none {
        box-shadow: none !important;
      }
${buildSelectRules()}

      ${clickAnimations}
    }`
}
