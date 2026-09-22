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
 * ## Why this layer is now nearly empty
 *
 * It used to carry a rule for every component name the platform knew — `.card`,
 * `.badge`, `.btn` and its variants, `.toast`, `.nav`, `.sidebar`, `.modal-*`,
 * `.alert-*`, `.data-table th`. Every one of them has been retired, for one of
 * two reasons:
 *
 *  - **Nothing wore the class.** `.toast`, `.nav`, `.sidebar`, `.modal-*`,
 *    `.alert-*`, `.data-table th` and `.container-page` had no emitter at all.
 *    The real toast is `[data-toast]`, the real nav and alerts are their own
 *    recipes. The rules only ever matched fixtures that invented the names.
 *  - **A recipe already painted it.** `.card`, `.badge` and the `.btn-*` family
 *    are `@apply` rules in `@layer components`, and the recipes covering the
 *    same elements land in `@layer utilities`, which WINS in Tailwind v4. The
 *    rules were being painted over, and two of them had drifted into being
 *    wrong (`.card` cast a shadow where a card casts none; `.badge` was a pill
 *    where a badge is barely rounded) — invisible precisely because they never
 *    reached the screen.
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
         leading class WINS the merge and replaces it. */
      .form-title {
        @apply text-foreground text-4xl font-semibold tracking-tight;
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
 * The bare-ELEMENT rule. Unlike every class rule that used to sit beside it,
 * this one has no recipe to be overpainted by: it is what a plain `<input>`
 * looks like when nobody styled it, which is exactly the case a component
 * recipe never reaches.
 */
function generateElementRules(): string {
  return `
      input, select, textarea { @apply ${buildInputClasses()}; }
${buildFormShellRules()}`
}

/**
 * Generate the `@layer components` block.
 *
 * Deliberately small — see the module header for what was retired and why.
 * It no longer takes the `design`: the only key it ever read was
 * `radius.full`, for the `.badge` pill that has been retired, and every
 * remaining rule is design-independent.
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

      ${clickAnimations}
    }`
}
