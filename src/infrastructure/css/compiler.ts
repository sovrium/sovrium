/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { parseEcoDesignLayer } from '@/domain/models/process-env/eco/eco-design-layer'
import { generateArbitraryVarSafelist } from '@/infrastructure/css/arbitrary-var-safelist'
import {
  getCSSCacheKey,
  getOrComputeCachedCSS,
  loadPrecompiledCSS,
  type CompiledCSS,
} from '@/infrastructure/css/cache/css-cache-service'
import {
  designCacheKey,
  EMPTY_DESIGN_CACHE_KEY,
} from '@/infrastructure/css/cache/design-cache-keys'
import {
  designSystemScopeKey,
  getDesignSystemScope,
} from '@/infrastructure/css/design-system-scope'
import {
  appAddsCandidatesBeyondBuiltin,
  compileCSSNativeFree,
  MINIMAL_FALLBACK_CSS,
  resolveNativeFreeCandidates,
} from '@/infrastructure/css/native-free-compiler'
import { generateMotionStyles } from '@/infrastructure/css/styles/animation-styles-generator'
import {
  generateComponentsLayer,
  generateUtilitiesLayer,
} from '@/infrastructure/css/styles/component-layer-generators'
import { generateMarqueeStyles } from '@/infrastructure/css/styles/marquee-styles-generator'
import { generateCalendarStyles } from '@/infrastructure/css/theme/calendar-styles'
import { generateCodeBlockStyles } from '@/infrastructure/css/theme/code-block-styles-generator'
import { generateCommandPaletteStyles } from '@/infrastructure/css/theme/command-palette-styles'
import {
  NEUTRAL_FLOOR_LAYER,
  ROLE_TOKEN_BRIDGE,
  V1_THEME_REGISTRATIONS,
  V1_TOKEN_LAYER,
} from '@/infrastructure/css/theme/default-theme-layer'
import { SELF_HOSTED_FONT_FACES } from '@/infrastructure/css/theme/fonts'
import { generateRichTextStyles } from '@/infrastructure/css/theme/rich-text-styles'
import { scopedTokenLayer } from '@/infrastructure/css/theme/scoped-theme-layer'
import {
  generateAuthorSvBridge,
  generateDarkColorOverrides,
  generateDensityLayer,
  generateMotionScale,
  generateSpacingScale,
  generateThemeBorderRadius,
  generateThemeBreakpoints,
  generateThemeColors,
  generateThemeFonts,
  generateThemeShadows,
  generateThemeTypeScale,
} from '@/infrastructure/css/theme/theme-generators'
import { generateBaseLayer } from '@/infrastructure/css/theme/theme-layer-generators'
import { CSSCompilationError } from '@/infrastructure/errors/css-compilation-error'
import { logDebug, logError, logWarning } from '@/infrastructure/logging/logger'
import { isDevCacheDisabled, isProduction as checkIsProduction } from '@/infrastructure/process/env'
import { isCompiled, SOVRIUM_PACKAGE_ROOT } from '@/infrastructure/process/package-paths'
import type { App } from '@/domain/models/app'
import type { Design } from '@/domain/models/app/design'
import type { AcceptedPlugin, Result as PostcssResult } from 'postcss'

// Re-export CompiledCSS type for external use
export type { CompiledCSS } from '@/infrastructure/css/cache/css-cache-service'

/**
 * Generate the complete Tailwind `@theme` block from `app.design`.
 *
 * ## One parameter, because there is one position
 *
 * This took `(theme, typeScale)` — two parameters for one design system,
 * because the token block was a nested key of its own while the type ladder sat
 * beside it. Every caller had to know which half held which key, and the guard
 * had to be `!theme && !typeScale` rather than the obvious `!theme`, because an
 * app declaring only a type scale was legitimate and an early return on the
 * token block would have made every one of its steps silently emit nothing.
 *
 * [internal ref] collapses both into `design`, so the guard is now simply `!design`:
 * there is no second container that could hold a declared token while this one
 * is absent. That is the whole reason the single position is safe — not that
 * the old split was harmless, but that the class of bug it invited (a key
 * declared in the position the reader did not check) no longer has a place to
 * happen.
 *
 * ## Emission order
 *
 * The first seven emitters keep their exact previous order, and
 * `generateMotionScale` is APPENDED rather than slotted in beside its ladder
 * siblings. That is deliberate: motion is the one token family that emitted
 * nothing before, so appending it leaves the stylesheet of every app that
 * declares no `motion` byte-identical to what it was under `theme.*`.
 */
function generateDesignCSS(design?: Design): string {
  if (!design) return ''

  // Narrow ONCE rather than optional-chaining each generator: every `Design`
  // field is itself optional, so an empty object is a faithful stand-in for
  // "nothing declared" and each generator already guards its own absent input.
  const declared: Design = design

  const themeTokens = [
    generateThemeColors(declared.colors),
    generateThemeFonts(declared.typeScale?.families),
    generateSpacingScale(declared.spacing),
    generateThemeShadows(declared.elevation),
    generateThemeBorderRadius(declared.radius),
    generateThemeBreakpoints(declared.breakpoints),
    generateThemeTypeScale(declared.typeScale?.steps),
    generateMotionScale(declared.motion),
  ].filter(Boolean)

  // [internal ref] / Phase 5 follow-up: the author-`--sv-*` bridge block, emitted as
  // a separate `:root` block AFTER `@theme static`. Each `app.design.colors.X`
  // value also writes `--sv-Y: value` directly so the prestyled-by-default
  // island channel (`bg-[var(--sv-Y, …)]`) picks up tenant overrides in
  // addition to the legacy `bg-X` utility channel. The cascade ordering
  // (ROLE_TOKEN_BRIDGE → author bridge) ensures the tenant value beats the
  // bridge's neutral fallback by ordinary "later wins" cascade semantics. See
  // `generateAuthorSvBridge` for the full rationale.
  const authorSvBridge = generateAuthorSvBridge(declared.colors)

  // `design.darkColors` — the authored dark palette. Emitted LAST so its
  // `html:is(.dark, …)` block sits after both the `@theme static` tokens and
  // the default theme layer's own dark cascade (`V1_ROOT_DARK`), which it ties
  // with on specificity and must therefore beat on source order. See
  // `generateDarkColorOverrides` for the full cascade rationale.
  const darkColorOverrides = generateDarkColorOverrides(declared.darkColors)

  if (themeTokens.length === 0 && !authorSvBridge && !darkColorOverrides) return ''

  // `@theme static` (not plain `@theme`) so author-declared tokens are ALWAYS
  // emitted to :root, even when no candidate references them yet. Plain `@theme`
  // tree-shakes unused tokens — fine for Tailwind's default palette, wrong for an
  // operator's own theme: client-hydrated islands may reference these vars at
  // runtime, beyond the reach of the build-time candidate scan.
  const themeStaticBlock =
    themeTokens.length > 0 ? `@theme static {\n${themeTokens.join('\n')}\n  }` : ''

  return [themeStaticBlock, authorSvBridge, darkColorOverrides].filter(Boolean).join('\n\n')
}

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
  // horizontally-scrollable per-domain tab bar (RESPONSIVE-004).
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
const STATIC_IMPORTS = `@import 'tailwindcss';
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

/**
 * Final base layer for global resets
 * Note: Removed hardcoded utilities (border-border, bg-background, etc.)
 * These should be defined in the app theme if needed
 */
const FINAL_BASE_LAYER = ''

/**
 * Build the always-present default token layer (see V1_TOKEN_LAYER in
 * `theme/default-theme-layer.ts`).
 *
 * Selected by `design.baseline`:
 *  - `'replace'` → neutral floor (grayscale, system fonts) + the alias bridge,
 *    so a replaced baseline still defines every canonical token and never
 *    renders unstyled.
 *  - otherwise (default `'extend'`) → the v1 token layer + the alias bridge.
 *
 * The alias bridge supplies the role-token LIGHT values via
 * `author key → legacy → default` fallback chains, late-bound so the author's
 * `@theme` (emitted later in `buildSourceCSS`) still wins.
 *
 * Injected in `buildSourceCSS` between `STATIC_IMPORTS` and the base layer so it
 * flows through BOTH the native PostCSS path and the native-free binary path.
 */
function buildDefaultLayer(design?: Design): string {
  // ECO_DESIGN_LAYER=off — operator demotes the token layer's OVERRIDE SURFACE
  // ([internal ref] contract). The prestyled-by-default islands carry their own OKLCH /
  // radius / shadow defaults inline via `withVarFallback`, so the page still
  // renders styled. We still emit the `@theme` token REGISTRATIONS
  // (`V1_THEME_REGISTRATIONS`) — they mint the canonical `bg-*` / `text-*` /
  // `border-*` / `ring-*` / `font-*` / `text-{size}` utilities that
  // `generateBaseLayer` `@apply`s (e.g. `@apply text-foreground`, `font-sans`).
  // Without them the per-app PostCSS/native-free compile THROWS "Cannot apply
  // unknown utility class `text-foreground`", which previously forced the
  // layer-off path to reuse the app-agnostic pre-compiled file — breaking the
  // with≡without parity for apps that author classes outside the builtin scan
  // (border resolved to the bare-`border`/red-600 fallback instead of the
  // canonical token). Dropping only the VALUE blocks (`V1_ROOT_*` / the alias
  // bridge) keeps the override surface demoted while letting layer-off compile
  // per-app exactly like layer-on. The self-hosted `@font-face` blocks stay so
  // text still resolves to Plex Sans / JetBrains Mono (part of the prestyled
  // baseline, not the override layer). Verified by
  // `[internal ref]` — the resolved
  // computed styles with the layer disabled must equal the layer-on reading.
  if (parseEcoDesignLayer(process.env) === 'off') {
    return `${SELF_HOSTED_FONT_FACES}\n\n  ${V1_THEME_REGISTRATIONS}`
  }
  const tokenLayer = design?.baseline === 'replace' ? NEUTRAL_FLOOR_LAYER : V1_TOKEN_LAYER
  // Emit `@font-face` BEFORE the token layer so the variable face is registered
  // before the font tokens reference them. Inlined here
  // (not in V1_TOKEN_LAYER) so the token layer remains a pure token block and
  // the existing "excludes @font-face" contract on V1_TOKEN_LAYER still holds.
  return `${SELF_HOSTED_FONT_FACES}\n\n  ${tokenLayer}\n\n  ${ROLE_TOKEN_BRIDGE}`
}

/**
 * Build the dynamic SOURCE_CSS: the app's own `@theme` tokens plus every
 * layer laid around them.
 *
 * Takes the whole `App` rather than a parameter per key. It used to take
 * `(theme, typeScale, scope)` and adding `density` — a fourth thing derived
 * from the same object at the single call site — made the case for the
 * argument list an argument list no longer. `design.density` is emitted
 * OUTSIDE `generateDesignCSS` because it is not a `@theme` token at all: it is
 * a `:root` + `[data-density]` block pair, and folding it into the theme
 * generator would put it inside `@theme static`, where the four
 * `--sv-density-*` names would be misread as utility-minting tokens.
 */
function buildSourceCSS(app?: App): string {
  const design = app?.design
  const scope = getDesignSystemScope(app)
  const themeCSS = generateDesignCSS(design)
  // The author's density ladder. Emitted after `buildDefaultLayer` (below) so
  // its `:root` block beats the platform's `V1_DENSITY_LAYER` on source order —
  // the same same-specificity, later-wins contract the author `--sv-*` colour
  // bridge relies on.
  const densityCSS = generateDensityLayer(app?.design?.density)
  // The SCOPED design system, emitted LAST so its selector-bound blocks sit
  // after every `:root` block the pipeline produces. Source order is not what
  // makes it win — a declaration on an element always beats an inherited value
  // — but emitting it last keeps the stylesheet readable as "the host, then the
  // guest" and leaves no doubt for a future reader.
  const scopedCSS = scope === undefined ? '' : scopedTokenLayer({ design: scope.design })
  const animationCSS = generateMotionStyles(design?.motion, design)
  const defaultLayerCSS = buildDefaultLayer(design)
  const baseLayerCSS = generateBaseLayer(design)
  const componentsLayerCSS = generateComponentsLayer()
  const utilitiesLayerCSS = generateUtilitiesLayer()
  // Code-block chrome (and `.tok-XXX` token color rules) for markdown pages.
  // Plain CSS — flows through BOTH the native PostCSS pipeline AND the
  // pure-JS native-free engine because `buildSourceCSS` is the shared input.
  const codeBlockCSS = generateCodeBlockStyles(design)
  // Marquee band chrome + motion. Plain CSS for the same reason as the code-block
  // rules above: `@keyframes`, `animation-play-state` under `:hover`/`:focus-within`
  // and a `prefers-reduced-motion` override are not utility-shaped, so they must
  // not depend on the Tailwind candidate scan.
  const marqueeCSS = generateMarqueeStyles()
  // FullCalendar theming: the `--fc-*` → `--sv-*` bridge plus the `.fc-*`
  // geometry. Plain CSS for a THIRD reason on top of the two above — the
  // selectors belong to FullCalendar's DOM, not to ours, so the candidate-driven
  // compiler could never mint them as utilities however the corpus grew.
  const calendarCSS = generateCalendarStyles()
  // The command palette, its record-creation dialog and its toast. Plain CSS for
  // the third reason too: that DOM is built by a runtime STRING with no class
  // attribute to hang a utility on, and its keyboard mark is a `[data-active]`
  // state selector an inline style cannot express.
  const commandPaletteCSS = generateCommandPaletteStyles()
  return [
    STATIC_IMPORTS,
    defaultLayerCSS,
    densityCSS,
    baseLayerCSS,
    componentsLayerCSS,
    utilitiesLayerCSS,
    '/*---break---\n     */',
    themeCSS,
    '/*---break---\n     */',
    animationCSS,
    '/*---break---\n     */',
    codeBlockCSS,
    '/*---break---\n     */',
    marqueeCSS,
    '/*---break---\n     */',
    calendarCSS,
    '/*---break---\n     */',
    commandPaletteCSS,
    '/*---break---\n     */',
    // The `.rte` content block — descendant rules over markup the AUTHOR types.
    // Shares the separator above rather than adding a sixth: `max-lines` on this
    // file is at its ceiling, and a break comment in the compiled output is
    // worth less than the rules it would push out. Splitting the six plain-CSS
    // generators into their own builder is the real fix; it belongs to a
    // refactor pass, not to a wave that is adding one of them.
    generateRichTextStyles(),
    scopedCSS,
    '/*---break---\n     */',
    FINAL_BASE_LAYER,
  ]
    .filter(Boolean)
    .join('\n\n    ')
}

const CSS_COMPILATION_TIMEOUT_MS = 30_000

/**
 * Create a timeout promise that rejects after the configured timeout.
 * Prevents silent hangs when native binaries are missing.
 */
const createCompilationTimeout = (): Promise<never> =>
  new Promise<never>((_resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new Error(
            `CSS compilation timed out after ${CSS_COMPILATION_TIMEOUT_MS / 1000}s. ` +
              'This usually means native binaries for @tailwindcss/oxide or lightningcss ' +
              'are missing for this platform. ' +
              'Fix: run "bun add @tailwindcss/oxide lightningcss" to install platform-specific binaries.'
          )
        ),
      CSS_COMPILATION_TIMEOUT_MS
    )
    // Don't keep the event loop alive just for this safety-net timer.
    // Without unref(), a successful build subprocess hangs for 30s waiting for this timer.
    // eslint-disable-next-line functional/no-expression-statements
    timer.unref()
  })

/**
 * Process CSS source through PostCSS with the Tailwind plugin.
 * Races compilation against a timeout to catch missing native binaries.
 *
 * `postcss` and `@tailwindcss/postcss` are imported lazily on purpose: that
 * chain loads native `.node` addons (lightningcss, @tailwindcss/oxide) which a
 * `bun build --compile` standalone binary cannot resolve from its virtual
 * filesystem. A static top-level import would crash the binary at module-load
 * time — before the `isCompiled` branch in `compileCSSRaw` ever runs. Deferring
 * the import to this function, which is only ever reached on the from-source
 * path, keeps the native chain out of the binary's load graph (issue #19).
 */
const processWithPostCSS = async (sourceCSS: string): Promise<PostcssResult> => {
  const { default: postcss } = await import('postcss')
  const { default: tailwindcss } = await import('@tailwindcss/postcss')

  // Cast needed: @tailwindcss/postcss bundles its own PostCSS types
  // which are structurally identical but nominally different from top-level postcss
  const processor = postcss([tailwindcss() as AcceptedPlugin])
  // The `from` path anchors PostCSS's `@import` resolver. Earlier this used
  // `process.cwd() + '/src/styles/global.css'`, which works when the CLI is
  // invoked from the Sovrium source tree (where `tailwindcss` lives in
  // `node_modules`) but FAILS when invoked from a partner application's
  // working directory (no `tailwindcss` installed). The fix: anchor the
  // `from` path at the SOVRIUM package root, so the `@import 'tailwindcss'`
  // resolves against Sovrium's own `node_modules` regardless of the operator's
  // CWD. The synthetic `src/styles/global.css` segment is kept so any error
  // messages remain stable and recognisable.
  const compilationPromise = processor.process(sourceCSS, {
    from: SOVRIUM_PACKAGE_ROOT + '/src/styles/global.css',
    to: undefined,
  })

  return Promise.race([compilationPromise, createCompilationTimeout()])
}

/**
 * Make the source CSS self-contained so the native PostCSS pipeline never scans
 * the filesystem for utility candidates.
 *
 * `@tailwindcss/postcss` auto-detects content by walking the project tree from
 * the `from` path. That scan is both unbounded (it reaches `vendor/` and any
 * large file under `src/`) and anchored to a synthetic `from`
 * (`src/styles/global.css` does not exist), so it OOMs `markUsedVariable`. We
 * disable it with `source(none)` and supply the exact candidate set via
 * `@source inline(...)` — the SAME `BUILTIN_CSS_CANDIDATES ∪ app className`
 * union the native-free binary path uses (`resolveNativeFreeCandidates`). Both
 * compile paths are now deterministic and scan-free.
 */
const makeScanlessSource = (sourceCSS: string, app?: App): string => {
  const candidates = resolveNativeFreeCandidates(app)
  return sourceCSS.replace(
    "@import 'tailwindcss';",
    `@import 'tailwindcss' source(none);\n    @source inline("${candidates.join(' ')}");`
  )
}

/**
 * Log a CSS compilation failure. The caught error is passed as the `cause` arg
 * so its stack is printed locally AND forwarded to Sentry (no manual splitting
 * of type/message/stack across separate debug lines).
 */
const logCompilationError = (error: unknown): CSSCompilationError => {
  logError('[css] compilation failed', error)
  return new CSSCompilationError(error)
}

const isProduction = checkIsProduction()

/**
 * Whether the test-server pre-compiled CSS file (`SOVRIUM_CSS_FILE`) may be
 * served for this app instead of compiling per-app.
 *
 * That file is built by `compileCSSRaw()` with NO app — it holds the builtin
 * candidate set only. Reusing it is sound ONLY when:
 *  - the app declares no CSS-bearing `design` key (the file is the default CSS), AND
 *  - the app authors no class beyond the builtin set; otherwise classes the
 *    build-time scan never saw (e.g. `max-w-6xl` or arbitrary `grid-cols-[…]`
 *    from a spec/operator fixture — the scan covers `src`+`examples`, not
 * `[internal ref]`) would be silently dropped from the served CSS, breaking layout.
 *
 * `ECO_DESIGN_LAYER` is NOT consulted here: the pre-compiled file is built in
 * the default (`on`) context, so serving it under `off` would leak the override
 * surface and break the with≡without parity contract ([internal ref],
 * contract-without-theme-layer.spec.ts) for apps that widen the candidate set.
 * Layer-off now compiles per-app like layer-on (`buildDefaultLayer` still emits
 * the `@theme` registrations under `off`, so `@apply` resolves), so the
 * candidate-set check is the only gate that matters in both layer states.
 *
 * Exported for its co-located test only. Every clause here is the difference
 * between an authored design key TAKING EFFECT and being silently inert, and
 * that is worth asserting directly rather than inferring from a compiled
 * stylesheet — reaching it through `compileCSS` needs `SOVRIUM_CSS_FILE`, a
 * sentinel file on disk, and a cache key nothing earlier in the suite has
 * already populated.
 */
export const canServePrecompiledFile = (app?: App): boolean =>
  // ONE clause covers every declared token, where this used to carry a clause
  // per key: `app.design === undefined`, then one for `typeScale`, then `density`,
  // then `components`, each added after the key it names shipped inert. The
  // cache key already enumerates every CSS-bearing key for its own reasons, so
  // asking it whether anything is declared cannot fall behind the schema the way
  // a hand-listed predicate did — twice.
  designCacheKey(app?.design) === EMPTY_DESIGN_CACHE_KEY &&
  // A SCOPED design system (the `/_admin` design-system console) emits a whole
  // extra token layer that the app-agnostic pre-compiled file cannot contain.
  // Without this clause the console — which declares no design of its own and
  // may add no candidate beyond builtin — would be served that file and the
  // operator's scope would resolve NOTHING, which is precisely the
  // half-themed failure the scoped layer exists to prevent.
  getDesignSystemScope(app) === undefined &&
  !appAddsCandidatesBeyondBuiltin(app)

/**
 * Internal CSS compilation logic (without caching)
 * Generates and compiles Tailwind CSS from theme configuration
 *
 * Accepts the full `App` so the compiled-binary path can also collect the
 * utility classes authored in the operator's `className` props.
 *
 * Inside a `bun build --compile` standalone binary the native PostCSS pipeline
 * is unavailable; this function transparently uses the pure-JS native-free
 * compiler there instead (issue #19). From-source / npm-bundled runs are
 * unchanged.
 */
export const compileCSSRaw = (app?: App): Effect.Effect<CompiledCSS, CSSCompilationError> =>
  Effect.gen(function* () {
    const sourceCSS = buildSourceCSS(app)

    logDebug(`[CSS] Source CSS length: ${sourceCSS.length} bytes`)
    logDebug(`[CSS] Contains @import 'tailwindcss': ${sourceCSS.includes("@import 'tailwindcss'")}`)
    logDebug(
      `[CSS] Contains @import 'tw-animate-css': ${sourceCSS.includes("@import 'tw-animate-css'")}`
    )

    // Inside a `bun build --compile` standalone binary, the native PostCSS /
    // Tailwind / lightningcss pipeline cannot load its `.node` addons from the
    // virtual filesystem (issue #19). Compile with the pure-JS native-free
    // engine instead. If that path itself fails (unexpected), serve minimal
    // fallback styles with an actionable log line rather than crashing.
    //
    // SOVRIUM_FORCE_NATIVE_FREE_CSS=1 forces this path from source too, so the
    // native-free output can be verified without compiling a binary.
    if (isCompiled || process.env.SOVRIUM_FORCE_NATIVE_FREE_CSS === '1') {
      return yield* compileCSSNativeFree(sourceCSS, app).pipe(
        Effect.catch((error) => {
          logError(
            '[CSS] Native-free compilation failed inside the compiled binary. ' +
              'This is a Sovrium bug — please report it at ' +
              'https://github.com/sovrium/sovrium/issues. Serving minimal fallback styles.',
            error
          )
          return Effect.succeed({ css: MINIMAL_FALLBACK_CSS, timestamp: Date.now() })
        })
      )
    }

    const result = yield* Effect.tryPromise({
      try: () => processWithPostCSS(makeScanlessSource(sourceCSS, app)),
      catch: (error) => logCompilationError(error),
    })

    logDebug('[CSS] Compiled and cached')

    return {
      css: result.css,
      timestamp: Date.now(),
    }
  })

/**
 * Compiles Tailwind CSS using PostCSS with @tailwindcss/postcss plugin
 *
 * This function:
 * 1. Extracts theme from app config (if provided)
 * 2. Generates dynamic SOURCE_CSS with @theme tokens
 * 3. Processes through PostCSS with Tailwind CSS v4 plugin
 * 4. Returns the compiled CSS string
 * 5. Caches the result in memory per theme (subsequent requests use cache)
 *
 * Uses getOrComputeCachedCSS for declarative caching with normalized theme keys.
 * Same theme content always produces the same cache key regardless of property order.
 *
 * @param app - Optional app configuration containing theme
 * @returns Effect that yields compiled CSS string or CSSCompilationError
 *
 * @example
 * ```typescript
 * // Without theme (minimal CSS)
 * const program = Effect.gen(function* () {
 *   const result = yield* compileCSS()
 *   console.log(`Compiled ${result.css.length} bytes of CSS`)
 * })
 *
 * // With app theme
 * const programWithTheme = Effect.gen(function* () {
 *   const result = yield* compileCSS(app)
 *   console.log(`Compiled ${result.css.length} bytes of CSS with theme`)
 * })
 *
 * Effect.runPromise(program)
 * ```
 */
/**
 * Production CSS resolution: Memory cache → File cache (only when serving the
 * generic pre-compiled file is sound) → per-app runtime compilation.
 *
 * The pre-compiled file is built with the BUILTIN candidate set only (no app
 * theme, no app-authored classes). It is a valid substitute ONLY when the app
 * neither overrides the theme nor authors any class beyond builtin (see
 * `canServePrecompiledFile`). Without this gate, an app that widens the candidate
 * set — e.g. the docs app's `dark:hidden` / `dark:block` logo lockup, or a
 * `w-[calc(100%-2.5rem)]` arbitrary value — silently has those classes dropped
 * from the served CSS (the stale-precompiled-CSS bug). The dev branches honor
 * this gate too. Inside the binary there is no native PostCSS path, so
 * `compileCSSRaw` routes to the native-free engine.
 */
const resolveProductionCSS = (
  app: App | undefined,
  cacheKey: string
): Effect.Effect<CompiledCSS, CSSCompilationError> =>
  getOrComputeCachedCSS(
    cacheKey,
    Effect.gen(function* () {
      if (canServePrecompiledFile(app)) {
        const precompiled = yield* loadPrecompiledCSS
        if (precompiled) {
          logDebug('[CSS] Loaded from pre-compiled file')
          return precompiled
        }
        logWarning(
          '[CSS] Pre-compiled CSS not found. Falling back to runtime compilation. ' +
            'Run "sovrium build" for faster startup.'
        )
      }
      // App widens the candidate set (or overrides the theme): the generic
      // pre-compiled file would drop app-authored classes, so compile per-app.
      return yield* compileCSSRaw(app)
    })
  )

export const compileCSS = (app?: App): Effect.Effect<CompiledCSS, CSSCompilationError> =>
  Effect.gen(function* () {
    const design = app?.design
    // Key on theme AND the app's authored class candidates: the compiled output
    // depends on both, so a theme-only key serves stale CSS when classes change.
    // …and on the SCOPED design system, if the app carries one: two operators
    // with the same (absent) console theme and the same candidate set compile
    // to DIFFERENT stylesheets once their own themes are scoped into it.
    // …and on `design.density`, which emits its own `:root` + `[data-density]`
    // blocks outside the theme entirely. Two apps with the same (absent) theme
    // and the same candidate set compile to DIFFERENT stylesheets once one of
    // them declares a ladder, so without this segment the second one served is
    // handed the first one's CSS.
    //
    // …and on `design.typeScale`, the gap this block used to name and leave
    // open. `[internal ref]` made it load-bearing — the operator's ladder cascades onto
    // the console, so two consoles with the same absent theme can differ by it —
    // and closes it here. `getVersionedCssHash`'s OPERATOR branch still derives
    // its URL from `getCSSCacheKey` alone and still does not vary with a ladder:
    // a pre-existing gap on a different surface, left where it is because moving
    // it changes the stylesheet URL of every app declaring one. The CONSOLE
    // branch does cover it, through `designCascadeKey`.
    const cacheKey =
      getCSSCacheKey(design, resolveNativeFreeCandidates(app)) + designSystemScopeKey(app)

    if (isProduction) {
      return yield* resolveProductionCSS(app, cacheKey)
    }

    // See `canServePrecompiledFile` — the test-server pre-compiled file is only
    // a valid substitute when the app adds no candidates beyond builtin.
    const canUsePrecompiledFile = canServePrecompiledFile(app)

    // Dev cache bypass: recompile every request so config edits appear without a
    // restart. Still honor the pre-compiled file fast path for the default theme
    // (test servers set SOVRIUM_CSS_FILE).
    if (isDevCacheDisabled()) {
      if (canUsePrecompiledFile && process.env.SOVRIUM_CSS_FILE) {
        const precompiled = yield* loadPrecompiledCSS
        if (precompiled) {
          logDebug('[CSS] Loaded from pre-compiled file (dev, cache bypassed)')
          return precompiled
        }
      }
      return yield* compileCSSRaw(app)
    }

    // Development: Memory cache → Pre-compiled file (if no theme) → PostCSS compilation
    const result = yield* getOrComputeCachedCSS(
      cacheKey,
      Effect.gen(function* () {
        // For default theme, try loading from pre-compiled file first (e.g. test servers)
        if (canUsePrecompiledFile && process.env.SOVRIUM_CSS_FILE) {
          const precompiled = yield* loadPrecompiledCSS
          if (precompiled) {
            logDebug('[CSS] Loaded from pre-compiled file (dev mode)')
            return precompiled
          }
        }
        return yield* compileCSSRaw(app)
      })
    )

    if (Date.now() - result.timestamp > 100) {
      logDebug('[CSS] Cache hit')
    }

    return result
  })
