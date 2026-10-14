/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The views of the Sovrium remainder (see `sovrium-design-remainder.ts`): the
 * utility safelists, the order and prose of the island `TOKENS` catalogue, the
 * author-key map onto the Sovrium roles, and the parts of the
 * console's inherited projection the blocks cannot derive.
 */

import type { CatalogueItem, DefaultDesignSource, SafelistItem } from './design-source-types'

/* ─────────────────────────────── safelists ─────────────────────────────── */

export const CANONICAL_COLOR_UTILITIES = [
  { kind: 'comment', text: '// Neutral ramp' },
  { kind: 'utility', name: 'bg-neutral-50' },
  { kind: 'utility', name: 'bg-neutral-100' },
  { kind: 'utility', name: 'bg-neutral-200' },
  { kind: 'utility', name: 'bg-neutral-300' },
  { kind: 'utility', name: 'bg-neutral-400' },
  { kind: 'utility', name: 'bg-neutral-500' },
  { kind: 'utility', name: 'bg-neutral-600' },
  { kind: 'utility', name: 'bg-neutral-700' },
  { kind: 'utility', name: 'bg-neutral-800' },
  { kind: 'utility', name: 'bg-neutral-900' },
  { kind: 'utility', name: 'bg-neutral-950' },
  { kind: 'utility', name: 'text-neutral-500' },
  { kind: 'utility', name: 'text-neutral-600' },
  { kind: 'utility', name: 'text-neutral-700' },
  { kind: 'utility', name: 'text-neutral-900' },
  { kind: 'utility', name: 'text-neutral-950' },
  { kind: 'utility', name: 'border-neutral-200' },
  { kind: 'utility', name: 'border-neutral-300' },
  { kind: 'comment', text: '// Surface roles' },
  { kind: 'utility', name: 'bg-background' },
  { kind: 'utility', name: 'bg-background-inset' },
  { kind: 'utility', name: 'bg-foreground' },
  { kind: 'utility', name: 'text-background' },
  { kind: 'comment', text: '// Border roles' },
  { kind: 'utility', name: 'border-border' },
  { kind: 'utility', name: 'border-border-strong' },
  { kind: 'utility', name: 'border-border-inverse' },
  { kind: 'utility', name: 'divide-border' },
  { kind: 'utility', name: 'bg-border' },
  { kind: 'utility', name: 'bg-border-strong' },
  { kind: 'comment', text: '// Foreground roles' },
  { kind: 'utility', name: 'text-foreground' },
  { kind: 'utility', name: 'text-foreground-subtle' },
  { kind: 'utility', name: 'text-foreground-disabled' },
  { kind: 'utility', name: 'text-foreground-inverse' },
  { kind: 'utility', name: 'text-foreground-humane' },
  { kind: 'comment', text: '// Primary' },
  { kind: 'utility', name: 'bg-primary' },
  { kind: 'utility', name: 'bg-primary-hover' },
  { kind: 'utility', name: 'bg-primary-active' },
  { kind: 'utility', name: 'bg-primary-subtle' },
  { kind: 'utility', name: 'text-primary' },
  { kind: 'utility', name: 'text-primary-subtle-fg' },
  { kind: 'utility', name: 'border-primary' },
  { kind: 'comment', text: '// Focus ring' },
  { kind: 'utility', name: 'border-ring' },
  { kind: 'comment', text: '// Warmth accent\n// Success' },
  { kind: 'utility', name: 'bg-success-bg' },
  { kind: 'utility', name: 'bg-success-solid' },
  { kind: 'utility', name: 'text-success-fg' },
  { kind: 'utility', name: 'text-success-solid-fg' },
  { kind: 'utility', name: 'border-success-border' },
  {
    kind: 'comment',
    text: '// Success numbered ramp (50/100/300/500/600/700/950 — the v1 ramp steps; see V1_ROOT_LIGHT)',
  },
  { kind: 'utility', name: 'bg-success-50' },
  { kind: 'utility', name: 'bg-success-100' },
  { kind: 'utility', name: 'bg-success-300' },
  { kind: 'utility', name: 'bg-success-500' },
  { kind: 'utility', name: 'bg-success-600' },
  { kind: 'utility', name: 'bg-success-700' },
  { kind: 'utility', name: 'bg-success-950' },
  { kind: 'comment', text: '// Warning' },
  { kind: 'utility', name: 'bg-warning-bg' },
  { kind: 'utility', name: 'bg-warning-solid' },
  { kind: 'utility', name: 'text-warning-fg' },
  { kind: 'utility', name: 'text-warning-solid-fg' },
  { kind: 'utility', name: 'border-warning-border' },
  { kind: 'comment', text: '// Warning numbered ramp (50/100/300/500/700/950)' },
  { kind: 'utility', name: 'bg-warning-50' },
  { kind: 'utility', name: 'bg-warning-100' },
  { kind: 'utility', name: 'bg-warning-300' },
  { kind: 'utility', name: 'bg-warning-500' },
  { kind: 'utility', name: 'bg-warning-700' },
  { kind: 'utility', name: 'bg-warning-950' },
  { kind: 'comment', text: '// Error' },
  { kind: 'utility', name: 'bg-error-bg' },
  { kind: 'utility', name: 'text-error-fg' },
  { kind: 'utility', name: 'text-error-solid-fg' },
  { kind: 'utility', name: 'border-error-border' },
  { kind: 'comment', text: '// Error numbered ramp (50/100/300/500/600/700/950)' },
  { kind: 'utility', name: 'bg-error-50' },
  { kind: 'utility', name: 'bg-error-100' },
  { kind: 'utility', name: 'bg-error-300' },
  { kind: 'utility', name: 'bg-error-500' },
  { kind: 'utility', name: 'bg-error-600' },
  { kind: 'utility', name: 'bg-error-700' },
  { kind: 'utility', name: 'bg-error-950' },
  { kind: 'comment', text: '// Info' },
  { kind: 'utility', name: 'bg-info-bg' },
  { kind: 'utility', name: 'bg-info-solid' },
  { kind: 'utility', name: 'text-info-fg' },
  { kind: 'utility', name: 'text-info-solid-fg' },
  { kind: 'utility', name: 'border-info-border' },
  { kind: 'comment', text: '// Info numbered ramp (50/100/300/500/600/700/950)' },
  { kind: 'utility', name: 'bg-info-50' },
  { kind: 'utility', name: 'bg-info-100' },
  { kind: 'utility', name: 'bg-info-300' },
  { kind: 'utility', name: 'bg-info-500' },
  { kind: 'utility', name: 'bg-info-600' },
  { kind: 'utility', name: 'bg-info-700' },
  { kind: 'utility', name: 'bg-info-950' },
  {
    kind: 'comment',
    text: '// shadcn-convention utilities — safelisted so the default theme always\n// emits them (they otherwise tree-shake to no-ops when a config authored with\n// shadcn names is not scanned, e.g. the native-free binary path). Each reads\n// its shadcn variable.',
  },
  { kind: 'utility', name: 'text-primary-foreground' },
  { kind: 'utility', name: 'bg-card' },
  { kind: 'utility', name: 'bg-muted' },
  { kind: 'utility', name: 'text-muted-foreground' },
  { kind: 'utility', name: 'bg-popover' },
  { kind: 'utility', name: 'bg-destructive' },
  { kind: 'utility', name: 'text-destructive-foreground' },
] as const satisfies readonly SafelistItem[]

/**
 * The font-slot safelist.
 *
 * Tailwind tree-shakes an `@theme` token whose minted utility has no candidate
 * in the source scan, so a slot referenced only dynamically would be dropped and
 * its `@font-face` would never load. Safelisting keeps every slot reachable in
 * both compilation paths.
 *
 * There is deliberately no serif slot: [internal ref] amendment A2 withdrew the serif
 * grace note and deleted the `--font-serif` token and the Source Serif face
 * with it.
 *
 * ## A live accident, stated so nobody tidies it away by mistake
 *
 * That sentence used to be spelled with the bare utility name in a JSDoc block
 * on this array, and Tailwind's scanner harvested it as a CANDIDATE — minting a
 * `.font-serif` utility and a `--font-serif` variable out of Tailwind's own
 * default theme. Sovrium ships 115 bytes of CSS advertising a face the runtime
 * cannot paint, for no reason but a comment saying that face does not exist.
 *
 * Measured, not guessed: moving this prose deleted the utility from the
 * compiled stylesheet of `apps/website`, `apps/partner` and a bare app alike
 * (the admin console was unaffected — it takes the precompiled path). Nothing
 * in `src/`, `apps/`, `[internal ref]` or `templates/` uses `font-serif` as a class;
 * every occurrence is prose saying the serif was deleted, and
 * `foundations.spec.ts` asserts the console shows no serif specimen at all.
 *
 * So the mention below is LOAD-BEARING BY ACCIDENT: it is the only reason the
 * utility still exists. It is kept spelled that way on purpose, because this
 * change is a REFACTOR and a refactor may not move a byte of output. Removing
 * the dead utility is a real, if tiny, product change — 115 bytes across every
 * app — and belongs in its own commit with its own baselines. Do not tidy this
 * paragraph without making that decision deliberately.
 *
 * `font-mono` is listed for parity — the contract is "every font slot is always
 * reachable" — and `font-sans` is already emitted through the body cascade, but
 * listing it keeps the contract symmetric against a future tree-shake.
 */
export const CANONICAL_FONT_UTILITIES = [
  { kind: 'utility', name: 'font-sans' },
  { kind: 'utility', name: 'font-mono' },
] as const satisfies readonly SafelistItem[]

/* ───────────────────────── the island token catalogue ──────────────────── */

/**
 * The ordered key list of the island fallback catalogue (`TOKENS`), with its
 * own section prose. VALUES are not stored here — the generator resolves each
 * key's `--sv-*` / `--<scale>-*` counterpart out of the blocks below, applying
 * `islandFallback` where one is declared. A key with no counterpart is a
 * generator ERROR, not a silent omission.
 */
export const TOKEN_CATALOGUE = [
  { kind: 'comment', text: '// ---------- Neutral ramp (warm cast) ----------' },
  { kind: 'token', key: 'neutral50' },
  { kind: 'token', key: 'neutral100' },
  { kind: 'token', key: 'neutral200' },
  { kind: 'token', key: 'neutral300' },
  { kind: 'token', key: 'neutral400' },
  { kind: 'token', key: 'neutral500' },
  { kind: 'token', key: 'neutral600' },
  { kind: 'token', key: 'neutral700' },
  { kind: 'token', key: 'neutral800' },
  { kind: 'token', key: 'neutral900' },
  { kind: 'token', key: 'neutral950' },
  { kind: 'blank' },
  { kind: 'comment', text: '// ---------- Surface roles ----------' },
  { kind: 'token', key: 'bgInset' },
  { kind: 'blank' },
  { kind: 'comment', text: '// ---------- Border roles ----------' },
  // `border` and `primary` are shadcn names too: each reads `--border` / `--primary`.
  // The retired role keys (`bg`, `bgRaised`, `fgMuted`, `focusRing` …) left with the
  // `--sv-*` alias layer in P10; their shadcn twins are catalogued below.
  { kind: 'token', key: 'border' },
  { kind: 'token', key: 'borderStrong', trailing: '// neutral-300' },
  { kind: 'token', key: 'borderInverse', trailing: '// neutral-900' },
  { kind: 'blank' },
  { kind: 'comment', text: '// ---------- Foreground roles ----------' },
  {
    kind: 'token',
    key: 'fgSubtle',
    trailing: '// off-ramp: neutral-500 (0.56) computes 4.46:1 and fails AA',
  },
  { kind: 'token', key: 'fgDisabled', trailing: '// neutral-400' },
  { kind: 'token', key: 'fgInverse', trailing: '// neutral-50' },
  { kind: 'token', key: 'primary' },
  { kind: 'token', key: 'primaryHover', trailing: '// neutral-800' },
  { kind: 'token', key: 'primaryActive', trailing: '// neutral-950' },
  { kind: 'token', key: 'primarySubtle', trailing: '// neutral-100' },
  { kind: 'token', key: 'primarySubtleFg', trailing: '// neutral-900' },
  { kind: 'blank' },
  { kind: 'comment', text: '// ---------- Warmth accent ----------' },
  { kind: 'blank' },
  { kind: 'comment', text: '// ---------- Semantic — Success ----------' },
  { kind: 'token', key: 'success50' },
  { kind: 'token', key: 'success100' },
  { kind: 'token', key: 'success300' },
  { kind: 'token', key: 'success500' },
  { kind: 'token', key: 'success600' },
  { kind: 'token', key: 'success700' },
  { kind: 'token', key: 'success950' },
  { kind: 'token', key: 'successBg' },
  { kind: 'token', key: 'successBorder' },
  { kind: 'token', key: 'successFg' },
  { kind: 'token', key: 'successSolid' },
  { kind: 'token', key: 'successSolidFg' },
  { kind: 'blank' },
  { kind: 'comment', text: '// ---------- Semantic — Warning ----------' },
  { kind: 'token', key: 'warning50' },
  { kind: 'token', key: 'warning100' },
  { kind: 'token', key: 'warning300' },
  { kind: 'token', key: 'warning500' },
  { kind: 'token', key: 'warning700' },
  { kind: 'token', key: 'warning950' },
  { kind: 'token', key: 'warningBg' },
  { kind: 'token', key: 'warningBorder' },
  { kind: 'token', key: 'warningFg' },
  { kind: 'token', key: 'warningSolid' },
  { kind: 'token', key: 'warningSolidFg' },
  { kind: 'blank' },
  { kind: 'comment', text: '// ---------- Semantic — Error ----------' },
  { kind: 'token', key: 'error50' },
  { kind: 'token', key: 'error100' },
  { kind: 'token', key: 'error300' },
  { kind: 'token', key: 'error500' },
  { kind: 'token', key: 'error600' },
  { kind: 'token', key: 'error700' },
  { kind: 'token', key: 'error950' },
  { kind: 'token', key: 'errorBg' },
  { kind: 'token', key: 'errorBorder' },
  { kind: 'token', key: 'errorFg' },
  { kind: 'token', key: 'errorSolidFg' },
  { kind: 'blank' },
  { kind: 'comment', text: '// ---------- Semantic — Info ----------' },
  { kind: 'token', key: 'info50' },
  { kind: 'token', key: 'info100' },
  { kind: 'token', key: 'info300' },
  { kind: 'token', key: 'info500' },
  { kind: 'token', key: 'info600' },
  { kind: 'token', key: 'info700' },
  { kind: 'token', key: 'info950' },
  { kind: 'token', key: 'infoBg' },
  { kind: 'token', key: 'infoBorder' },
  { kind: 'token', key: 'infoFg' },
  { kind: 'token', key: 'infoSolid' },
  { kind: 'token', key: 'infoSolidFg' },
  { kind: 'blank' },
  { kind: 'comment', text: '// ---------- Radii ----------' },
  { kind: 'token', key: 'radiusNone' },
  { kind: 'token', key: 'radiusSm' },
  { kind: 'token', key: 'radiusBase' },
  { kind: 'token', key: 'radiusMd' },
  { kind: 'token', key: 'radiusLg' },
  { kind: 'token', key: 'radiusXl' },
  { kind: 'token', key: 'radiusFull' },
  { kind: 'blank' },
  { kind: 'comment', text: '// ---------- Shadows (warm-cast Sovrium elevation) ----------' },
  { kind: 'token', key: 'shadowNone' },
  { kind: 'token', key: 'shadowSm' },
  { kind: 'token', key: 'shadowMd' },
  { kind: 'token', key: 'shadowLg' },
  { kind: 'blank' },
  { kind: 'comment', text: '// ---------- Motion — durations ----------' },
  { kind: 'token', key: 'durationFast' },
  { kind: 'token', key: 'durationBase' },
  { kind: 'token', key: 'durationSlow' },
  { kind: 'blank' },
  { kind: 'comment', text: '// ---------- Motion — easings ----------' },
  { kind: 'token', key: 'easeDefault' },
  { kind: 'token', key: 'easeEnter' },
  { kind: 'token', key: 'easeExit' },
  { kind: 'blank' },
  { kind: 'comment', text: '// ---------- Typography ----------' },
  { kind: 'token', key: 'fontSans' },
  { kind: 'token', key: 'fontMono' },
  {
    kind: 'comment',
    text: '// No `fontSerif`: ADR-024 amendment A2 withdrew the serif grace note, and the\n// theme layer declares no `--font-serif` for a fallback here to pair with. A\n// fallback whose variable is never emitted is not a fallback — it is a\n// hardcoded face wearing the syntax of an override.',
  },
  { kind: 'blank' },
  {
    kind: 'comment',
    text: "// No `fontSize*`: this catalogue is the LITERAL an island inlines beside a\n// `--sv-*` override hook, and the type ladder has never had one — it emits\n// `--text-*` (Tailwind's own namespace), so a recipe names `text-base` and the\n// utility carries the value. The twelve entries that used to sit here were read\n// by nothing but a unit test pinning three hand-copied rem literals in the\n// recipes; the recipes now name rungs, so both are gone.",
  },
  { kind: 'blank' },
  { kind: 'token', key: 'fontWeightRegular' },
  { kind: 'token', key: 'fontWeightMedium' },
  { kind: 'token', key: 'fontWeightSemibold' },
  { kind: 'token', key: 'fontWeightBold' },
  { kind: 'blank' },
  { kind: 'token', key: 'lineHeightNone' },
  { kind: 'token', key: 'lineHeightTight' },
  { kind: 'token', key: 'lineHeightSnug' },
  { kind: 'token', key: 'lineHeightNormal' },
  { kind: 'token', key: 'lineHeightRelaxed' },
  { kind: 'blank' },
  { kind: 'token', key: 'letterSpacingTighter' },
  { kind: 'token', key: 'letterSpacingTight' },
  { kind: 'token', key: 'letterSpacingNormal' },
  { kind: 'token', key: 'letterSpacingWide' },
  { kind: 'token', key: 'letterSpacingCaps' },
  { kind: 'blank' },
  {
    kind: 'comment',
    text: '// ---------- Density (the `compact` step, the `:root` default) ----------\n//\n// Mirrors `V1_ROOT_DENSITY` in `default-theme-layer.ts`, and the mirror is\n// ENFORCED: `Design Token Drift` rule 4 compares these four literals against\n// that block, so the two cannot silently disagree about what "compact" is.\n//\n// Unlike every other entry above, these are NOT consumed through\n// `withVarFallback`. The recipes read them with Tailwind v4\'s arbitrary\n// custom-property syntax (`py-(--sv-density-row-y)`, `text-(length:--sv-density-text)`),\n// which emits a bare `var()` with no inline fallback. The values are held\n// here for the drift mirror and as the one place a reader can see what the\n// default ladder step is worth without opening the CSS layer.',
  },
  { kind: 'token', key: 'densityRowY' },
  { kind: 'token', key: 'densityControlH' },
  { kind: 'token', key: 'densityButtonH' },
  { kind: 'token', key: 'densityGap' },
  { kind: 'token', key: 'densityText' },
] as const satisfies readonly CatalogueItem[]

/* ──────────────── legacy author-key aliases + inherited views ──────────── */

/**
 * The author-key -> Sovrium role map. A role retired in P10 (`bg`, `bg-raised`,
 * `chart-1` …) has a shadcn twin in `RETIRED_SV_ROLE_TWINS`, and the author key
 * repaints that shadcn variable (`DESIGN_COLOR_VARS`); every other role is an
 * extension token the key repaints directly.
 *
 * Only the extension rows are emitted, into `default-design.generated.ts` as
 * `COLOR_TO_SV_TOKEN`, as a plain inline object literal: the gates that read it
 * parse that shape.
 */
export const LEGACY_ALIASES = {
  primary: 'primary',
  'primary-hover': 'primary-hover',
  'primary-active': 'primary-active',
  'primary-foreground': 'primary-fg',
  'primary-subtle': 'primary-subtle',
  'primary-subtle-foreground': 'primary-subtle-fg',
  background: 'bg',
  'background-subtle': 'bg-subtle',
  'background-raised': 'bg-raised',
  'background-overlay': 'bg-overlay',
  'background-inset': 'bg-inset',
  foreground: 'fg',
  'foreground-muted': 'fg-muted',
  'foreground-subtle': 'fg-subtle',
  'foreground-disabled': 'fg-disabled',
  'foreground-inverse': 'fg-inverse',
  muted: 'bg-subtle',
  'muted-foreground': 'fg-muted',
  card: 'bg-raised',
  popover: 'bg-overlay',
  border: 'border',
  ring: 'focus-ring',
  success: 'success-solid',
  warning: 'warning-solid',
  error: 'error-solid',
  destructive: 'error-solid',
  'destructive-foreground': 'error-solid-fg',
  info: 'info-solid',
  // The five chart slots are their own author keys. Each resolves to shadcn's
  // `--chart-N` through `RETIRED_SV_ROLE_TWINS`, which is the route an app has
  // to its own series.
  'chart-1': 'chart-1',
  'chart-2': 'chart-2',
  'chart-3': 'chart-3',
  'chart-4': 'chart-4',
  'chart-5': 'chart-5',
} as const satisfies Readonly<Record<string, string>>

/**
 * The parts of the console's inherited-token projection that are NOT derivable
 * from the blocks below. Everything else in `inherited-tokens.ts` IS derived:
 * the colour roles resolve through {@link LEGACY_ALIASES}, and the radius,
 * shadow, duration and easing tables are the scales themselves (verified, not
 * assumed — the generator recomputes and the gate compares).
 */
export const INHERITED = {
  /**
   * Tailwind v4's own thresholds. Sovrium emits no `--breakpoint-*`, so these
   * are the one table here describing what Tailwind resolves rather than what
   * Sovrium ships — see the note in `inherited-tokens.ts`.
   */
  breakpoints: {
    sm: '40rem',
    md: '48rem',
    lg: '64rem',
    xl: '80rem',
    '2xl': '96rem',
  },
  /** Deliberately empty: components take spacing from raw Tailwind utilities. */
  spacing: {},
  /** The seven roles whose registered `--color-*` name differs from the author's. */
  roleColorProperty: {
    ring: 'focus-ring',
    'primary-foreground': 'primary-fg',
    'primary-subtle-foreground': 'primary-subtle-fg',
    success: 'success-solid',
    warning: 'warning-solid',
    error: 'error-solid',
    info: 'info-solid',
  },
  /** The colour roles published to the console, in order. Values are DERIVED. */
  colorRoleNames: [
    'background',
    'background-subtle',
    'background-raised',
    'background-overlay',
    'background-inset',
    'foreground',
    'foreground-muted',
    'foreground-subtle',
    'foreground-disabled',
    'foreground-inverse',
    'border',
    'ring',
    'primary',
    'primary-hover',
    'primary-active',
    'primary-foreground',
    'primary-subtle',
    'primary-subtle-foreground',
    'success',
    'warning',
    'error',
    'info',
  ],
  /**
   * The platform ladder as `[utility, size, leading]` in px — what text renders
   * at when an app declares no `design.typeScale.steps` of its own.
   *
   * These are the rungs of `FONT_SIZES` / `FONT_SIZE_LEADINGS` above, not
   * Tailwind's defaults. Until 2026-09-09 they WERE Tailwind's, because this
   * ladder emitted `--font-size-*` and no utility read it; now that it emits
   * `--text-*` the platform ladder is Sovrium's own, and this table has to say
   * so or the console prints one set of numbers while the page renders another.
   *
   * Restated here rather than derived, because the surrounding object is
   * `as const satisfies` and a computed array widens out of the tuple type. The
   * pairing is asserted, not trusted: see `default-design-source.test.ts`.
   */
  platformTypeLadder: [
    ['text-2xs', 10, 14],
    ['text-xs', 11, 16],
    ['text-sm', 12, 18],
    ['text-base', 13, 20],
    ['text-md', 14, 22],
    ['text-lg', 16, 24],
    ['text-xl', 18, 28],
    ['text-2xl', 20, 28],
    ['text-3xl', 24, 32],
    ['text-4xl', 30, 36],
    ['text-5xl', 40, 40],
    ['text-6xl', 48, 48],
  ],
  /** Derived from the snapshot's font families by the transformer. */
  fontStacks: {},
} as const satisfies DefaultDesignSource['inherited']

/** The remainder, in the source's shape; the transformer completes it. */
