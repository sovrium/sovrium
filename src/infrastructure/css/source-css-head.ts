/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { generateArbitraryVarSafelist } from '@/infrastructure/css/arbitrary-var-safelist'

/**
 * The fixed head of the compiler's source CSS: the Tailwind imports and
 * plugins, the safelists the candidate scan cannot see, and the always-emitted
 * palette. `buildSourceCSS` (`source-css.ts`) lays every app-derived layer after it.
 */

/**
 * Layout-utility safelist — Tailwind layout primitives that are NOT theme
 * tokens but ARE referenced dynamically (via runtime-composed `className`
 * strings) by operator app schemas. The build-time source scan only sees
 * utilities literally present in Sovrium's own `src/`, so a schema author
 * using `grid-cols-11` (or any column count outside the 1-7 range already
 * used by built-in islands) gets a broken layout.
 *
 * Safelisting `grid-cols-{1..12}` (and the matching `sm:`/`md:`/`lg:`
 * responsive variants) makes the full standard Tailwind grid range
 * resolvable from any app schema, in both the native PostCSS path AND the
 * pure-JS native-free binary path, regardless of source-tree scan output.
 *
 * Standard Tailwind range is 1-12; we don't safelist beyond 12 because that
 * is rare enough that an operator hitting it should opt into a wider
 * candidate set (e.g. by adding a className that the build-time scan picks
 * up in a future feature).
 *
 * Semantic-ramp color utilities (`bg-success-500`, `bg-warning-100`, etc.)
 * are safelisted separately via `CANONICAL_COLOR_UTILITIES` in
 * `default-theme-layer.ts` — they ship inside the v1 token layer alongside
 * their `@theme` color-variable registrations.
 */
const LAYOUT_UTILITY_SAFELIST = [
  // Base
  'grid-cols-1',
  'grid-cols-2',
  'grid-cols-3',
  'grid-cols-4',
  'grid-cols-5',
  'grid-cols-6',
  'grid-cols-7',
  'grid-cols-8',
  'grid-cols-9',
  'grid-cols-10',
  'grid-cols-11',
  'grid-cols-12',
  // sm: responsive variant
  'sm:grid-cols-1',
  'sm:grid-cols-2',
  'sm:grid-cols-3',
  'sm:grid-cols-4',
  'sm:grid-cols-5',
  'sm:grid-cols-6',
  'sm:grid-cols-7',
  'sm:grid-cols-8',
  'sm:grid-cols-9',
  'sm:grid-cols-10',
  'sm:grid-cols-11',
  'sm:grid-cols-12',
  // md: responsive variant
  'md:grid-cols-1',
  'md:grid-cols-2',
  'md:grid-cols-3',
  'md:grid-cols-4',
  'md:grid-cols-5',
  'md:grid-cols-6',
  'md:grid-cols-7',
  'md:grid-cols-8',
  'md:grid-cols-9',
  'md:grid-cols-10',
  'md:grid-cols-11',
  'md:grid-cols-12',
  // lg: responsive variant
  'lg:grid-cols-1',
  'lg:grid-cols-2',
  'lg:grid-cols-3',
  'lg:grid-cols-4',
  'lg:grid-cols-5',
  'lg:grid-cols-6',
  'lg:grid-cols-7',
  'lg:grid-cols-8',
  'lg:grid-cols-9',
  'lg:grid-cols-10',
  'lg:grid-cols-11',
  'lg:grid-cols-12',
  // Flex direction / wrap — emitted by buildFlexClasses from string `direction`/`wrap` props
  'flex-row',
  'flex-row-reverse',
  'flex-col',
  'flex-col-reverse',
  'flex-wrap',
  'flex-nowrap',
  'flex-wrap-reverse',
  // Justify-content — emitted from string `justify` prop
  'justify-start',
  'justify-center',
  'justify-end',
  'justify-between',
  'justify-around',
  'justify-evenly',
  // Align-items — emitted from string `align` prop
  'items-start',
  'items-center',
  'items-end',
  'items-stretch',
  'items-baseline',
  // Gap scale targets — emitted from named `gap` props (sm/md/lg/xl → gap-2/4/6/8, etc.)
  'gap-0',
  'gap-1',
  'gap-2',
  'gap-3',
  'gap-4',
  'gap-5',
  'gap-6',
  'gap-8',
  // Native Admin Dashboard responsive shell. The
  // shell's sidebar collapse / burger-drawer reflow composes these utilities in
  // runtime `className` strings AND in the inline `SidebarDrawerToggle` script —
  // both invisible to the source scanner — so they are safelisted here to be
  // emitted on EVERY app's CSS (the dashboard is auto-mounted on any operator
  // app, whose theme drives the served CSS). `overflow-x-auto` backs the
  // horizontally-scrollable per-domain tab bar.
  'hidden',
  'md:flex',
  'md:hidden',
  'md:block',
  'overflow-x-auto',
  'fixed',
  'inset-0',
  'inset-y-0',
  'left-0',
  'z-30',
  'z-40',
  'shadow-xl',
  'bg-scrim/50',
].join(' ')

/**
 * Runtime-template-literal arbitrary-value safelist.
 *
 * Islands compose classes like `` `bg-[${v('sv-primary', T.primary)}]` `` whose
 * resolved literal (`bg-[var(--sv-primary,oklch(0.205_0.008_40))]`) is invisible
 * to Tailwind's content scanner — it only sees the template SOURCE, not the
 * value. Without this safelist those classes never reach the compiled CSS and
 * elements render transparent on the dedicated Linux runner. The generator
 * source-scans `src/presentation/islands/*-default-classes.ts` and resolves
 * each `v('sv-X', T.Y)` against `css-var.ts`'s `TOKENS` map; the result is
 * empty in compiled-binary mode (where the JS bundle already contains the
 * resolved literals and Tailwind picks them up natively).
 *
 * See `./arbitrary-var-safelist.ts` and its co-located test for details.
 */
const ARBITRARY_VAR_CLASS_SAFELIST = generateArbitraryVarSafelist().join(' ')

const ARBITRARY_VAR_SAFELIST_DIRECTIVE = ARBITRARY_VAR_CLASS_SAFELIST
  ? `@source inline("${ARBITRARY_VAR_CLASS_SAFELIST}");`
  : '/* arbitrary-var safelist empty — binary mode (resolved literals already in JS bundle) */'

/**
 * Static CSS imports and custom variants
 */
export const STATIC_IMPORTS = `@import 'tailwindcss';
    @import 'tw-animate-css';
    /* Tailwind v4 registers JS plugins via the @plugin directive in the CSS
       input (no tailwind.config.js in Sovrium's programmatic compiler). The
       typography plugin mints the \`prose\` family (\`prose\`, \`prose-invert\`,
       \`prose-slate\`, \`prose-sm\`, …) used by markdown article layouts
       (markdown-article.tsx) and the rich-text editor island. Without it those
       classes are INERT. Placed after the \`@import 'tailwindcss'\` so the
       plugin's utilities register against the core theme. Flows through the
       native PostCSS path here; the native-free binary path resolves the
       \`prose\` utilities from the candidate set + embedded plugin (see
       generated-css-assets regeneration). */
    @plugin "@tailwindcss/typography";
    /*---break---
     */
    @source inline("${LAYOUT_UTILITY_SAFELIST}");
    /*---break---
     */
    ${ARBITRARY_VAR_SAFELIST_DIRECTIVE}
    /*---break---
     */
    @custom-variant dark (&:is(.dark *));
    /* @theme static (not plain @theme) so the full red palette is ALWAYS
       emitted to :root by BOTH compile engines. The pure-JS native-free engine
       (binary path) keeps every declared token, while real oxide tree-shakes a
       plain @theme block down to only candidate-referenced tokens — making the
       binary CSS emit reds the dev CSS dropped (CLI-BINARY-CSS-006). static
       opts both engines out of tree-shaking so they stay equivalent. */
    @theme static {
      --color-red-50: #fef2f2;
      --color-red-100: #fee2e2;
      --color-red-200: #fecaca;
      --color-red-300: #fca5a5;
      --color-red-400: #f87171;
      --color-red-500: #ef4444;
      --color-red-600: #dc2626;
      --color-red-700: #b91c1c;
      --color-red-800: #991b1b;
      --color-red-900: #7f1d1d;
      --color-red-950: #450a0a;
    }`
