/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The console's design — and, since jalon 6.1, Sovrium's DEFAULT design system.
 *
 * This file has two halves and they answer two different questions.
 *
 * ## Half one: what THIS app declares (the default export)
 *
 * THREE ZONES, AND THE SPLIT IS A REGISTER, NOT A BUDGET. The console has one
 * personality and one palette; what changes across it is what a surface is FOR,
 * and there are three answers, each already shipping chrome to match:
 *
 *   `auth`           `/login`, `/forgot-password`, `/reset-password` — the only
 *                    unguarded pages under a mount, and an EXACT-MATCH carve-out
 *                    rather than a prefix. No shell, no sidebar, no palette, no
 *                    breadcrumb, `noindex`. Nobody here is reading data yet, and
 *                    the one serif line on the card is explanatory rather than
 *                    operational (`BRAND.md` §4).
 *   `design-console` `/design-system` and everything under it. Shelled and gated
 *                    like the console, but it renders SPECIMENS rather than the
 *                    operator's data — so what it changes is the page's
 *                    register, never its chrome.
 *   `console`        everything else — the operational data surfaces this app
 *                    exists for.
 *
 * ─── ONE SCHEME TOGGLE, IN THE SHELL BAR, EVERYWHERE ───────────────────────
 *
 * This said until 2026-09-16 that the design-console zone carried a scheme
 * toggle of its own, in the section's `chromeEnd` slot, on the argument that a
 * reader comparing a light specimen against a dark one needs the control where
 * the specimens are. It was then the only console section with one.
 *
 * The founder ruling of that date arrived in two steps. The canvas wins, so a
 * scheme toggle goes in the SHARED shell bar on every console page
 * (`components/shell.ts`) — and once that landed, the section dropped its own
 * (`config/pages/design-system/chrome.ts`). One toggle, in one place, on every
 * page. The old argument survives the removal rather than losing it: the shell
 * bar is on the specimen page too, so the control is still where the specimens
 * are. What is gone is the second declaration beside it, which was redundancy
 * on a single axis rather than a choice between two.
 *
 * One axis is what the 2026-09-03 ruling settled, and neither step touches it.
 * The defect it closed was two AXES — a `?scheme=` link pair moving the app
 * scope while the chrome followed the stored theme, which on `/ui-kit` put
 * eighty-five near-white cards on a near-black shell. The remaining toggle
 * writes `localStorage.theme` and flips `html.dark`; nothing else may grow
 * scheme state of its own.
 *
 * This supersedes the one-zone statement that stood here until 2026-09-06, which
 * read a split as inventing a difference the console does not make. The
 * difference is already made, in those three places; the map was the only thing
 * not saying it.
 *
 * WHAT THE SPLIT DELIBERATELY DOES NOT DO, each omission load-bearing:
 *
 * No `accentBudget` on any of the three. The field says WHICH budget a zone
 * carries, and this app has no accent key and no colours, so every zone carries
 * none. `auth` in particular is NOT the public budget: that is the PERSUASION
 * budget, and licensing persuasion on a sign-in card is the marketing leak
 * `BRAND.md` §9 refuses. None of the three names is in `PUBLIC_BUDGET_ZONE_NAMES`
 * (`src/domain/models/app/design/zones.ts`, currently `['marketing']`), whose
 * fallback is fail-closed — so the omission and the names agree instead of one
 * of them carrying the decision alone.
 *
 * Measured while writing this, because it decides what assertion (c) is worth
 * here: NONE of this app's 37 routes declares `access`, so the budget lock reads
 * every one of them as public and could not fire whatever budget a zone declared.
 * The console is gated by the admin plane at the MOUNT, not by `PageSchema.access`
 * — which is correct, and which means these zone names are read by coverage, by
 * liveness, and by humans, and by nothing else.
 *
 * No `voice` override. `design-validation.ts` rule 5b refuses a zone voice with
 * no `design.voice` to override, and this app declares none: a per-FIELD override
 * needs a base for every field it does not spell out.
 *
 * No `density.byZone`. Two reasons, either sufficient. `DensitySchema.steps` is
 * required, so a `byZone` here would have to restate the whole ladder that
 * already sits in this file as `DEFAULT_DENSITY` — a second spelling of one value
 * inside one file. And nothing writes `[data-density]` onto a rendered element
 * yet (`generateDensityLayer`, `theme-generators.ts`), so the assignment would
 * name a step no surface can reach. The names are the half of that wiring that
 * can land now.
 *
 * Zone patterns here are MOUNT-RELATIVE, like every other intra-app path in this
 * config (`apps/admin/BRAND.md` §10). `Brand Zone Drift` compares them against
 * `pages[].path` as declared, which is unprefixed on both sides. `/design-system`
 * needs no trailing `/*`: a pattern owns its own index and everything below it.
 *
 * ## Half two: what EVERY app inherits ({@link DEFAULT_DESIGN_SOURCE})
 *
 * The named export below is Sovrium's default design system — the token layer,
 * the island fallback catalogue and the console's inherited-token projection are
 * all GENERATED from it by `bun run build:default-design`. It lives here because
 * `apps/admin` is the reference identity (`**Role**: reference` in its
 * `BRAND.md`): the console is the one app that DEFINES these tokens rather than
 * consuming them, and the founder decision behind jalon 6 is that restyling the
 * platform default should mean editing an app config and hot-reloading it.
 *
 * ### Why it is a NAMED export and not the default one
 *
 * Because it does not fit yet, and saying so is cheaper than pretending. Of the
 * default's 306 value declarations, only a minority have a home in `DesignSchema`
 * — see the second docstring below, which measures it. Making this the default
 * export would mean either widening the public config surface to hold CSS
 * `var` fallback chains (refused by [internal ref]) or silently dropping most of the
 * default at decode. So the app's own `design` stays the small typed thing an
 * operator can read, and the platform default sits beside it as data the
 * generator consumes, in the same file, under the same review.
 *
 * When the typed homes jalon 2 designed (`design.ramps`, `colorRoles[].value`,
 * `design.spacing`) can express the whole default, these two exports collapse
 * into one and this section is what should be deleted.
 *
 * ### What reads this file
 *
 * `scripts/build/generate-default-design.ts` — its `SOURCE_PATH` names this
 * path, and it is the ONLY consumer. Nothing in `src/` imports from `apps/`, and
 * nothing here imports a VALUE from `src/`: the single import below is a TYPE
 * import through the public `sovrium` specifier, which is what every business-app
 * config uses and what an external author gets from `sovrium types`.
 */

import type { DesignConfig } from 'sovrium'

export default {
  zones: [
    { pattern: '/login', zone: 'auth' },
    { pattern: '/forgot-password', zone: 'auth' },
    { pattern: '/reset-password', zone: 'auth' },
    { pattern: '/design-system', zone: 'design-console' },
    { pattern: '/*', zone: 'console' },
  ],
  // FOLLOW THE OPERATOR, AND SAY SO — OR THE DARK SCHEME IS UNREACHABLE.
  //
  // `'system'` is what the platform assumes when a page carries a
  // `theme-toggle` and nothing is configured, so on the six `/design-system`
  // pages this changes nothing. Everywhere else it is the difference between a
  // console that can be dark and one that cannot.
  //
  // `needsColorSchemeScript` (`render/page/theme-color-scheme.ts`) emits the
  // no-FOUC head script when a page declares a `theme-toggle` OR the design
  // configures `colorScheme`. Every operational console page has neither, so
  // the script it needs to read a stored preference — or the operator's OS —
  // was arriving only as a side effect of the HOST happening to declare one.
  // Measured under the mount: with the host's `colorScheme` removed, a stored
  // `theme=dark` and an OS set to dark BOTH left `/tables` on
  // `--sv-bg: oklch(0.985)`, while `/design-system` went dark on its toggle
  // alone. The console is mounted inside someone else's app, so a scheme that
  // depends on what that app declares is a scheme the operator does not have.
  //
  // It adds no control: a surface that wants the operator to CHOOSE a scheme
  // still has to draw a `theme-toggle`, and `foundations.spec.ts` deliberately
  // bounds that to the design-system section. This line is about honouring a
  // choice already made, not about offering one.
  colorScheme: 'system',
  // A light code block on a light page. Unset, the platform highlights with
  // `github-dark`, which put a near-black slab in the middle of every console
  // page that shows a snippet — legible, but the loudest thing on the page and
  // the one element that did not belong to the surrounding surface.
  //
  // The theme is ONE string, not a pair, so it is worth knowing what it does to
  // the dark scheme before reading it as a light-only decision. For a theme in
  // `LIGHT_SHIKI_THEMES` the block's CHROME defers to
  // `--color-background-subtle` / `--color-foreground`, which are scheme-aware,
  // so the frame follows the page into dark on its own. Only the TOKEN colours
  // come from here, and they are the half no scheme switch can adapt.
  //
  // MEASURED, 2026-09-16, and it was worse than "cannot adapt": with ONE name,
  // in dark, the chrome went to `oklch(0.272)` while the tokens stayed
  // light-theme, so the body ink `#24292E` read at 1.27:1 and a string literal
  // `#032F62` at 1.40:1 — 26 spans under the 4.5:1 floor on `/api`, 38 on
  // `/mcp`, 78 776 on `/schema`. The configuration a reader opened `/schema` to
  // READ was, in that scheme, invisible.
  //
  // ─── THE PAIR, NOW THAT THE SCHEMA CAN EXPRESS ONE ───────────────────────
  //
  // `darkTheme` ships as an OPTIONAL sibling of `theme`, so each scheme names
  // its own design and neither has to be the compromise. `github-light` stays
  // the light half, untouched, for the reason above it.
  //
  // `github-dark` is the dark half, and the choice is narrower than it looks —
  // see below. Measured after: `/api` 26 low-contrast spans → 1, `/mcp` 38 → 1,
  // `/schema` 78 776 → 0, worst ratio 1.02 → 4.04.
  //
  // The counterpart is DECLARED, never derived. `github-light` → `github-dark`
  // is a naming coincidence rather than a rule: `nord` and `dracula` have no
  // light sibling to compute, and `catppuccin-latte`'s is `catppuccin-mocha`.
  //
  // ─── THE ONE SPAN STILL UNDER 4.5, AND WHY IT IS NOT FIXED HERE ──────────
  //
  // `github-dark` paints comments AND strings with one colour, `#6a737d`,
  // which reads 4.04:1 against the `#0d0d0d` chrome the platform PINS under
  // every dark theme (`resolveChromeColors`). On `/api` and `/mcp` that is
  // exactly one span each — the `# POST …` line above a curl example.
  //
  // No other value closes it, and that is a PLATFORM limit rather than a
  // shortage of themes. `generateDarkSchemeArm` emits one rule per entry of
  // `COMMON_TOKEN_COLORS`, a hand-listed set of hexes covering `github-dark`,
  // `nord` and `github-light`. A `darkTheme` naming anything else emits NO
  // matching rule, so every token inherits the chrome foreground and the block
  // renders MONOCHROME — with no error and no warning. Measured on
  // `github-dark-default`, whose palette does clear AA everywhere (comment
  // `#8b949e` at 6.32:1): contrast became a uniform 15.24:1 across 108 174
  // spans on `/schema` because there was no longer any highlighting left to
  // measure. Trading syntax colour for 0.46 of a contrast point on one comment
  // line is the worse product, so this stays `github-dark` and the shortfall is
  // routed as the platform gap it is.
  //
  // Omitting the key is not neutral — it is exactly the state measured above,
  // where `theme` governs both schemes and no dark-scoped rule is emitted.
  codeBlock: { theme: 'github-light', darkTheme: 'github-dark' },
} satisfies DesignConfig

/**
 * Sovrium's default design system — THE hand-written source of truth.
 *
 * ## What this replaced
 *
 * The default lived in three textual copies that a gate could only hold in
 * agreement after the fact: the CSS token layer
 * (`src/infrastructure/css/theme/default-theme-layer.ts`), the island fallback
 * catalogue (`TOKENS` in `src/presentation/utils/design/css-var.ts`) and the
 * console's inherited-token projection
 * (`src/domain/services/design-system/inherited-tokens.ts`). All three are now
 * GENERATED from this file, and `Design Token Drift` compares three derivations
 * against one source instead of three copies against each other.
 *
 * Nothing here is CSS text. Values are DATA — a ramp step is an `oklch()`
 * string, a role is `{ property, value: { authorKey?, legacyName?, fallback } }`
 * and the generator derives the `var()` fallback chain from it. The prose that
 * sat beside a declaration in the layer travels with it as a `comment` item, so
 * the emitted CSS keeps its explanations and the reasoning stays next to the
 * value it explains.
 *
 * Regenerate after ANY edit: `bun run build:default-design`.
 *
 * ## Why this is NOT typed as `Design`
 *
 * The original plan typed this literal against the domain `Design` schema. That
 * was measured on 2026-09-05 and abandoned; the measurement is recorded here
 * because the idea is otherwise certain to be retried.
 *
 * Of the default's 306 value declarations, **33 (11%) have a home in
 * `DesignSchema` today**. Two blockers:
 *
 * 1. **Colours.** When this was measured, `ColorValueSchema` accepted hex /
 *    rgb(a) / hsl(a) only and rejected **175 of 201 colour declarations (87%)**
 *    — 25 `oklch()` and 150 `var()` fallback chains. Jalon 2 opened the
 * `oklch` half, so the 25 now decode and the
 *    percentage above is a DATED figure, not a current one. Recount rather than
 *    quote it. The `var()` half stays refused, and that is not a gap waiting to
 *    be filled: an author-supplied `var()` is an unresolvable indirection into a
 * stylesheet the schema cannot see.
 * 2. **Scales that decode green and emit nothing.** Four families are ACCEPTED
 *    at decode and then **silently dropped**. This is the half worth naming
 *    loudest, because a probe that only checks for a thrown error reports it as
 *    success:
 *
 *    ```
 *    { typeScale: { '2xs': { size: '0.6875rem' } } }             -> { typeScale: {} }
 *    { theme: { spacing: { '0-5': '0.125rem', '4': '1rem' } } }  -> { spacing: {} }
 *    { theme: { animations: { durations: { fast: '120ms' } } } } -> { durations: {} }
 *    ```
 *
 *    `TypeScaleSchema` is a CLOSED Struct over twelve named steps
 *    (`display`, `h1`…`h6`, `lead`, `body`, `bodySmall`, `caption`, `overline`)
 *    — the `2xs`…`6xl` font-size ladder is not among them. And
 *    `SpacingConfigSchema`'s key pattern is `^[a-z]+(-[a-z]+)*$`, which matches
 *    no digit, so every spacing key this file declares (`0`, `px`, `0-5`, `1`,
 *    `2`, …) vanishes through `Schema.Record`'s silent key drop.
 *
 *    **So do not "fix" this file by moving values into `design.spacing`,
 *    `design.typeScale` or `theme.animations`.** The scales below are modelled
 *    explicitly for exactly that reason.
 *
 * The sub-objects that DO survive a round trip carry a `satisfies` against
 * their `Design` slice, so the part of the default an app config can actually
 * express stays pinned to the public contract: {@link DEFAULT_RADII},
 * {@link DEFAULT_SHADOWS}, {@link DEFAULT_FONT_FAMILIES},
 * {@link DEFAULT_CHART_COLORS} and {@link DEFAULT_DENSITY}.
 *
 * Jalon 2 designs the typed homes (an oklch ramp block, roles as ramp
 * references, numeric scales) before this literal moves to
 * this file in jalon 6.1, which is where it now lives.
 *
 * ## `islandFallback` — 19 measured divergences, frozen rather than fixed
 *
 * A declaration may carry `islandFallback`. That means the island's INLINE
 * literal — what a page paints when `ECO_DESIGN_LAYER=off` and the layer never
 * loads — differs from what the layer's own `var()` chain resolves to.
 * Nineteen such pairs exist: `success-100` is `oklch(0.925 0 0)` inline against
 * `oklch(0.92 0 0)` resolved, `error-solid-fg` is `oklch(0.985 0.003 75)`
 * against `oklch(0.985 0 0)`, and so on across the success / warning / info
 * families.
 *
 * They were invisible until this file existed: the old gate's rule 4 SKIPPED
 * any theme-layer value starting with `var(`, and every one of the nineteen
 * sits behind a `var()` indirection. They are recorded rather than repaired
 * because repairing them changes what a page paints — these literals are
 * emitted inside Tailwind arbitrary-value classes, so they reach the compiled
 * CSS and the candidate corpus. Draining them is a visual change with its own
 * baselines, not a refactor.
 *
 * ## The Admin Console canvas names two of these greys the other way round
 *
 * The console's design canvas and this ramp AGREE on the neutral values and
 * DISAGREE on two of the names. Measured in Chromium, light scheme:
 *
 * | canvas role   | canvas  | token                | here    | delta /255 |
 * | ------------- | ------- | -------------------- | ------- | ---------- |
 * | ground        | #fafafa | `--sv-bg`            | #fafafa | exact      |
 * | raised        | #fefefe | `--sv-bg-raised`     | #fdfdfd | 1          |
 * | well          | #f4f4f4 | `--sv-bg-subtle`     | #f3f3f3 | 1          |
 * | inset         | #efefef | `--sv-bg-inset`      | #efefef | exact      |
 * | hair          | #e3e3e3 | `--sv-border`        | #e4e4e4 | 1          |
 * | hair-strong   | #d3d3d3 | `--sv-border-strong` | #d4d4d4 | 1          |
 * | subtle        | #a1a1a1 | `--sv-fg-disabled`   | #a1a1a1 | exact      |
 * | **prose**     | #565656 | **`--sv-fg-muted`**  | #545454 | 2          |
 * | **muted**     | #707070 | **`--sv-fg-subtle`** | #6e6f6f | 2          |
 * | ink           | #131313 | `--sv-fg`            | #090909 | 10         |
 * | primary       | #1e1e1e | `--sv-primary`       | #171717 | 7          |
 *
 * The canvas calls the DARKER body grey `prose` and the fainter one `muted`;
 * this ramp calls the darker one `fg-muted` and the fainter one `fg-subtle`.
 * **Map by VALUE, never by name.** Paired by name the two text greys are 28 and
 * 25 apart — a class ported literally (canvas `muted` to
 * `text-foreground-muted`) swaps the two text weights on every surface it
 * touches.
 *
 * The two real divergences, `ink` at 10 and `primary` at 7, are LEFT ALONE.
 * Both sit inside a near-black, below what a reader can tell apart, and both
 * are platform ROLE tokens: repainting them to match the canvas would repaint
 * every prestyled island in every Sovrium app rather than just this console, to
 * close a gap nobody can perceive. The error, info and chart hues are already
 * byte-identical to the canvas and need no note.
 */

/* ───────────────────────────── shape of the source ─────────────────────── */

/**
 * A declaration's value, as DATA rather than CSS text.
 *
 * - a plain string is a LITERAL (`oklch(0.985 0 0)`, `#3b82f6`, `5px`)
 * - `{ ref }` points at another `--sv-*` token; the generator emits `var(--sv-<ref>)`
 * - the third form is a ROLE: the generator derives the author -> legacy ->
 *   default `var()` fallback chain, collapsing any rung that is absent
 */
export type ValueSpec =
  | string
  | { readonly ref: string }
  | {
      readonly authorKey: string
      readonly legacyName?: string
      readonly fallback: string | { readonly ref: string }
    }

/** One `--prop: value;` line. */
export interface TokenDecl {
  readonly kind: 'decl'
  readonly property: string
  readonly value: ValueSpec
  /**
   * The island's inline literal, when it differs from what {@link value}
   * resolves to. See the `islandFallback` section of this file's docstring —
   * nineteen of these exist and they are frozen, not aspirational.
   */
  readonly islandFallback?: string
}

/** Prose emitted verbatim into the CSS, above the declaration it explains. */
export interface TokenComment {
  readonly kind: 'comment'
  readonly text: string
}

/** A blank line, preserved so the emitted CSS keeps its paragraphing. */
export interface TokenBlank {
  readonly kind: 'blank'
}

export type BlockItem = TokenDecl | TokenComment | TokenBlank

/** One CSS rule: a selector and its ordered items. */
export interface TokenBlock {
  readonly selector: string
  readonly items: readonly BlockItem[]
}

/** One entry of an `@source inline(...)` safelist. */
export type SafelistItem =
  | { readonly kind: 'utility'; readonly name: string }
  | { readonly kind: 'comment'; readonly text: string }

/** An ordered, commented view over the emitted token catalogue. */
export type CatalogueItem =
  | { readonly kind: 'token'; readonly key: string; readonly trailing?: string }
  | { readonly kind: 'comment'; readonly text: string }
  | { readonly kind: 'blank' }

/** A named scale with no home in `DesignSchema` (see the docstring). */
export type Scale = Readonly<Record<string, string>>

/** One rung of the density ladder. */
export type DensityStep = {
  readonly rowY: string
  readonly controlH: string
  readonly buttonH: string
  readonly gap: string
  readonly text: string
}

/**
 * A scale whose EMISSION ORDER matters and whose keys are integer-like, so a
 * record would silently reorder it. See {@link SPACINGS}.
 */
export type OrderedScale = readonly (readonly [string, string])[]

/* ─────────────── the sub-objects that survive a `Design` round trip ─────── */

type DesignTokens = DesignConfig

/**
 * The radius scale. Round-trip proven: `design.radius` accepts and PRESERVES
 * every key below (verified by decode, not by reading the pattern).
 */
export const DEFAULT_RADII = {
  none: '0px',
  sm: '2px',
  base: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  full: '9999px',
} as const satisfies NonNullable<DesignTokens['radius']>

/**
 * The elevation ramp — FOUR levels, each naming a thing that floats.
 *
 * A shadow is spent only where something genuinely leaves the page, and the
 * system admits three such things: a menu, a dialog, and the switch thumb.
 * Everything else is bounded by a border, which states an edge more honestly
 * than a blur does. So the ramp is `none` plus one level per floating thing,
 * and a level with no floating thing to name does not exist.
 *
 * Two steps were retired on 2026-09-08 for failing that test:
 *
 * - `xs` (`0 1px 0 0 rgb(0 0 0 / 0.04)`) was a hairline pretending to be
 *   elevation. At zero blur and 4% it IS a 1px rule, drawn in the wrong
 *   medium — a `border` renders the same intent, snaps to the device pixel,
 *   and survives a background change. The field affordances that spent it
 *   carry their border alone.
 * - `xl` (`0 24px 48px -8px …`) was elevation above the dialog, and nothing in
 *   the system sits above a dialog. Toasts, its only plausible tenant, share
 *   the dialog plane and are told apart by their ink ground rather than by
 *   24px of extra blur. Its consumers moved to `lg`.
 *
 * The three surviving values are single-layer. The retired ramp doubled every
 * shadow — a wide soft layer plus a tight dark one — for a contact-shadow
 * effect that is invisible at 12px blur and 6% opacity, and paid two paint
 * passes for it on every open menu.
 */
export const DEFAULT_SHADOWS = {
  none: 'none',
  /** The switch thumb — the one 1px lift the system admits. */
  sm: '0 1px 2px rgb(0 0 0 / 0.08)',
  /** Menus, popovers, hover cards: floating, but anchored to a trigger. */
  md: '0 4px 12px rgb(0 0 0 / 0.06)',
  /** Dialogs, drawers, toasts: floating free of the page. */
  lg: '0 8px 24px rgb(0 0 0 / 0.12)',
} as const satisfies NonNullable<DesignTokens['elevation']>

/**
 * The font stacks. The strongest of the five `satisfies` here: `FontConfigItem`
 * is a Struct with a required `family`, so this one checks structure rather
 * than just `Record<string, string>`.
 */
export const DEFAULT_FONT_FAMILIES = {
  sans: {
    family:
      "'IBM Plex Sans Variable', 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
  },
  mono: {
    family:
      "'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
  },
  display: { family: 'var(--font-sans)' },
} as const satisfies NonNullable<NonNullable<DesignTokens['typeScale']>['families']>

/**
 * The chart series palette — five hues at ONE lightness and ONE chroma.
 *
 * Each value is `oklch(0.62 0.14 h)` for `h` in 250 / 20 / 145 / 75 / 300,
 * converted to sRGB. The single constant lightness is the whole point: series
 * read as PEERS, so a reader compares magnitudes rather than inferring an
 * order the data does not carry. The Tailwind palette this replaced
 * (`#3b82f6 #ef4444 #10b981 #f59e0b #8b5cf6`) varies by more than 20 points of
 * lightness across its five entries, so its green always looked "further away"
 * than its blue whatever the numbers said.
 *
 * ## Why hex and not `oklch()`
 *
 * `ColorValueSchema` accepts hex, `rgb()` and `hsl()` and rejects `oklch()`,
 * and these five are the one part of the default that decodes through it (see
 * the block comment above). So the hues are AUTHORED in oklch and SHIPPED as
 * their sRGB conversion; the oklch triple stays in this comment as the source
 * of truth for the next hue anyone adds. Rounding is the sRGB quantisation
 * only — every value is in gamut.
 *
 * Honest about what the `satisfies` proves: `ColorValue` is a CHECKED string,
 * and an Effect check does not brand, so the decoded type erases to `string`.
 * This assertion is therefore shape-level (a record of string keys to string
 * values) and does NOT prove the hex pattern holds. The decode probe in
 * `scripts/build/default-design-source.test.ts` is what proves that.
 */
export const DEFAULT_CHART_COLORS = {
  'chart-1': '#398ad6', // oklch(0.62 0.14 250)
  'chart-2': '#cd5f62', // oklch(0.62 0.14 20)
  'chart-3': '#479c4d', // oklch(0.62 0.14 145)
  'chart-4': '#b67700', // oklch(0.62 0.14 75)
  'chart-5': '#9470cd', // oklch(0.62 0.14 300)
} as const satisfies NonNullable<DesignTokens['colors']>

/**
 * The density ladder. Round-trip proven, and the second-strongest `satisfies`
 * here: `DensityStepSchema` requires all five of `rowY` / `controlH` /
 * `buttonH` / `gap` / `text`, so a dropped key is a type error rather than a
 * silently thinner step.
 *
 * `compact` IS the `:root` default and its `rowY` / `gap` / `text` ARE the
 * literals the recipes used to hard-code (`py-[5px]`, `text-[11px]`,
 * `px-[7px]`), so those three must not move without a visual review.
 *
 * ## Why `controlH` and `buttonH` are two numbers
 *
 * They were one, at 28px, and that conflation made a field height
 * unadjustable. A text field and a small button are both "inline controls"
 * only in the sense that they sit on a line: a field is a place to TYPE and
 * wants room for a cursor, a descender and a comfortable click target, while a
 * small button is a label with a box drawn round it and wants to disappear
 * into a toolbar. The reference drawings put them 8px apart — field 36, small
 * button 28 — and under one key no density step could move either without
 * moving both.
 *
 * The ladder therefore carries both, and both ascend: fields 36 / 40 / 44,
 * buttons 28 / 32 / 36. `roomy`'s field lands exactly on the 44px WCAG 2.2
 * §2.5.8 enhanced target ({@link DENSITY_FLOORS.hit}), which is what a loose
 * step is for.
 */
export const DEFAULT_DENSITY = {
  steps: {
    compact: { rowY: '5px', controlH: '36px', buttonH: '28px', gap: '7px', text: '11px' },
    cozy: { rowY: '8px', controlH: '40px', buttonH: '32px', gap: '10px', text: '13px' },
    roomy: { rowY: '14px', controlH: '44px', buttonH: '36px', gap: '16px', text: '14px' },
  },
} as const satisfies NonNullable<DesignConfig['density']>

/* ───────────── scales with no `Design` home (see the docstring) ─────────── */

/**
 * The `2xs`…`6xl` platform font-size ladder, registered into Tailwind's
 * `--text-*` namespace. `typeScale.steps` is a separate, closed 12-step Struct
 * carrying an app's own SEMANTIC ladder (`display`…`overline`); the two never
 * collide, because their rung names are disjoint.
 *
 * ─── WHY `--text-*` AND NOT `--font-size-*` ─────────────────────────────────
 *
 * Until 2026-09-09 this ladder emitted `--font-size-*`, which is not a Tailwind
 * v4 namespace and which therefore **no utility ever read**. `text-base`
 * resolved to Tailwind's own `--text-base: 1rem`, so a `<p>` rendered at 16px
 * however this block was written, and the recipes reached the ladder only
 * through three hand-copied rem LITERALS that a unit test had to pin in place.
 * Measured on the served stylesheet: `--font-size-*` appeared in the generated
 * theme layer and in ZERO served declarations, because a plain `@theme` block
 * is candidate-gated and no candidate referenced it.
 *
 * Emitting `--text-*` is what makes a rung real — it populates `:root` AND backs
 * the `text-{rung}` utility — so a recipe names `text-base` instead of copying
 * `0.8125rem`, and the three pinned literals, with the test and the console
 * disclosure that existed to apologise for them, are gone.
 *
 * ─── WHY THESE VALUES ───────────────────────────────────────────────────────
 *
 * `base` is 13px: the platform base type step, per the design-console canvas.
 * Every other rung follows from it, and the set is exactly the canvas' own, so
 * each canvas size lands ON a named rung rather than between two:
 *
 *   xs 11 badge · th · eyebrow       sm 12 td · caption · rail
 *   base 13 button · input · deck    md 14 body · nav · large button
 *   lg 16 h4                         xl 18 lead
 *   2xl 20 h3 · 3xl 24 h2 · 4xl 30 h1 · 5xl 40 display
 *
 * `sm` < `base` < `md` now holds, which it did not while `base` was 14px and
 * `sm` 13px — the inversion that blocked this change when it was first drafted.
 *
 * Consequence, stated rather than left to be discovered: this moves every plain
 * `text-*` class in the repo one rung tighter. That is the intended systemic
 * tightening, not a side effect — the canvas reads one notch tighter than the
 * shipped UI did.
 */
const FONT_SIZES = {
  '2xs': '0.625rem',
  xs: '0.6875rem',
  sm: '0.75rem',
  base: '0.8125rem',
  md: '0.875rem',
  lg: '1rem',
  xl: '1.125rem',
  '2xl': '1.25rem',
  '3xl': '1.5rem',
  '4xl': '1.875rem',
  '5xl': '2.5rem',
  '6xl': '3rem',
} as const satisfies Scale

/**
 * The leading paired with each rung, emitted as `--text-{rung}--line-height`.
 *
 * Emitted rather than inherited, for a discontinuity rather than a preference.
 * Tailwind ships a `--text-{rung}--line-height` modifier for its OWN rungs
 * only, spelled `calc(<leading-rem> / <size-rem>)` so leading lands on the 4px
 * grid. Redeclaring a size without its modifier leaves the stale ratio in place
 * — and, worse, `2xs` and `md` are rungs Tailwind does not have at all, so they
 * would fall through to the browser's `normal` (~1.2) while every rung either
 * side of them sat at 1.4–1.55. `md` is the canvas' BODY size, so that gap would
 * land on the most-used rung in the ladder.
 *
 * Each value re-snaps its rung to the 4px grid at the new size. The `calc(a/b)`
 * spelling is Tailwind's own, kept because it makes the target readable: the
 * numerator is the leading in rem, the denominator the size.
 */
const FONT_SIZE_LEADINGS = {
  '2xs': 'calc(0.875 / 0.625)',
  xs: 'calc(1 / 0.6875)',
  sm: 'calc(1.125 / 0.75)',
  base: 'calc(1.25 / 0.8125)',
  md: 'calc(1.375 / 0.875)',
  lg: 'calc(1.5 / 1)',
  xl: 'calc(1.75 / 1.125)',
  '2xl': 'calc(1.75 / 1.25)',
  '3xl': 'calc(2 / 1.5)',
  '4xl': 'calc(2.25 / 1.875)',
  '5xl': '1',
  '6xl': '1',
} as const satisfies Scale

/** The four weights. No `Design` home at all. */
const FONT_WEIGHTS = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const satisfies Scale

/** The five line-heights. No `Design` home (`typeScale` is per-STEP). */
const LINE_HEIGHTS = {
  none: '1',
  tight: '1.1',
  snug: '1.25',
  normal: '1.55',
  relaxed: '1.7',
} as const satisfies Scale

/** The five tracking steps. No `Design` home. */
const LETTER_SPACINGS = {
  tighter: '-0.022em',
  tight: '-0.012em',
  normal: '0',
  wide: '0.02em',
  caps: '0.04em',
} as const satisfies Scale

/**
 * The spacing scale, as an ORDERED list rather than a record.
 *
 * A record cannot carry this scale. Its keys (`0`, `1`, `2`, …) are
 * integer-like, and JavaScript hoists integer-like keys to the front of a plain
 * object in ascending numeric order regardless of insertion order — so
 * `{ '0': …, px: …, '0-5': …, '1': … }` iterates as 0, 1, 2, … then px, 0-5,
 * 1-5, 2-5, and the emitted CSS silently reorders. Caught by the byte-identity
 * comparison against the hand-written layer; a record would have shipped a
 * reordered block that still compiled.
 *
 * Also: `theme.spacing` is NOT a home for this — its key pattern matches no
 * digit, so `Schema.Record` drops every key here (see the file docstring).
 */
const SPACINGS = [
  ['0', '0px'],
  ['px', '1px'],
  ['0-5', '0.125rem'],
  ['1', '0.25rem'],
  ['1-5', '0.375rem'],
  ['2', '0.5rem'],
  ['2-5', '0.625rem'],
  ['3', '0.75rem'],
  ['4', '1rem'],
  ['5', '1.25rem'],
  ['6', '1.5rem'],
  ['8', '2rem'],
  ['10', '2.5rem'],
  ['12', '3rem'],
  ['16', '4rem'],
  ['20', '5rem'],
  ['24', '6rem'],
  ['32', '8rem'],
] as const satisfies OrderedScale

/**
 * THREE durations, paired one-to-one with the three curves below.
 *
 * `instant: 0ms` and `deliberate: 340ms` were retired on 2026-09-08. Neither
 * had a consumer anywhere in `src/`, and neither could earn one: `0ms` is the
 * absence of a transition, which is spelled by not declaring one, and 340ms is
 * past the point where a UI transition stops reading as motion and starts
 * reading as lag.
 */
const DURATIONS = {
  /** Leaving: dialogs, drawers and toasts dismissing. Pairs with `exit`. */
  fast: '120ms',
  /** The default: hover, selection, a tab underline sliding. Pairs with `default`. */
  base: '180ms',
  /** Arriving: dialogs, drawers, menus and accordion panels opening. Pairs with `enter`. */
  slow: '260ms',
} as const satisfies Scale

/**
 * THREE easing curves, one per phase: steady, arriving, leaving.
 *
 * `emphasized` (`cubic-bezier(0.3, 0, 0.1, 1.1)`) was retired on 2026-09-08.
 * Its terminal `1.1` overshoots — the curve exists to make a thing bounce past
 * its resting position — and nothing in the system bounces. It had no consumer
 * in `src/`.
 */
const EASINGS = {
  /** Symmetric. Anything that changes state in place. */
  default: 'cubic-bezier(0.2, 0, 0, 1)',
  /** Decelerating. Anything appearing: it arrives fast and settles. */
  enter: 'cubic-bezier(0, 0, 0.2, 1)',
  /** Accelerating. Anything leaving: it commits immediately and is gone. */
  exit: 'cubic-bezier(0.4, 0, 1, 1)',
} as const satisfies Scale

/** The neutral floor's line-heights — the one scale it does NOT share with v1. */
const NEUTRAL_FLOOR_LINE_HEIGHTS = {
  none: '1',
  tight: '1.1',
  snug: '1.25',
  normal: '1.5',
  relaxed: '1.625',
} as const satisfies Scale

/** The neutral floor's system font stacks. */
const NEUTRAL_FLOOR_FONT_FAMILIES = {
  sans: {
    family: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  mono: { family: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace" },
  display: { family: 'var(--font-sans)' },
} as const satisfies NonNullable<NonNullable<DesignTokens['typeScale']>['families']>

/* ───────────────── derivations, so a value is written exactly once ─────── */

/**
 * The four declarations of one density step.
 *
 * Written as a derivation rather than as four literals in the block, because
 * the block and {@link DEFAULT_DENSITY} would otherwise be two copies of the
 * same numbers — the precise defect this whole file exists to remove. `knip`
 * caught it: the `satisfies`-checked object was exported and unused while the
 * block carried the values.
 */
const densityBlock = (selector: string, step: DensityStep): TokenBlock => ({
  selector,
  items: [
    { kind: 'decl', property: '--sv-density-row-y', value: step.rowY },
    { kind: 'decl', property: '--sv-density-control-h', value: step.controlH },
    { kind: 'decl', property: '--sv-density-button-h', value: step.buttonH },
    { kind: 'decl', property: '--sv-density-gap', value: step.gap },
    { kind: 'decl', property: '--sv-density-text', value: step.text },
  ],
})

/** The chart series declarations, derived from {@link DEFAULT_CHART_COLORS}. */
const chartDecls = (): readonly BlockItem[] =>
  Object.entries(DEFAULT_CHART_COLORS).map(([name, value]): BlockItem => ({
    kind: 'decl',
    property: `--sv-${name}`,
    value,
  }))

/* ─────────────────────────────── safelists ─────────────────────────────── */

const CANONICAL_COLOR_UTILITIES = [
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
  { kind: 'utility', name: 'bg-background-subtle' },
  { kind: 'utility', name: 'bg-background-raised' },
  { kind: 'utility', name: 'bg-background-overlay' },
  { kind: 'utility', name: 'bg-background-inset' },
  { kind: 'utility', name: 'bg-foreground' },
  { kind: 'utility', name: 'text-background' },
  { kind: 'utility', name: 'text-background-overlay' },
  { kind: 'utility', name: 'bg-scrim' },
  { kind: 'utility', name: 'bg-scrim/50' },
  { kind: 'comment', text: '// Border roles' },
  { kind: 'utility', name: 'border-border' },
  { kind: 'utility', name: 'border-border-strong' },
  { kind: 'utility', name: 'border-border-inverse' },
  { kind: 'utility', name: 'divide-border' },
  { kind: 'utility', name: 'bg-border' },
  { kind: 'utility', name: 'bg-border-strong' },
  { kind: 'comment', text: '// Foreground roles' },
  { kind: 'utility', name: 'text-foreground' },
  { kind: 'utility', name: 'text-foreground-muted' },
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
  { kind: 'utility', name: 'text-primary-fg' },
  { kind: 'utility', name: 'text-primary-subtle-fg' },
  { kind: 'utility', name: 'border-primary' },
  { kind: 'comment', text: '// Focus ring' },
  { kind: 'utility', name: 'ring-focus-ring' },
  { kind: 'utility', name: 'border-focus-ring' },
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
  { kind: 'utility', name: 'bg-error-solid' },
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
    text: '// shadcn-convention alias utilities (DEC-060) — mirror COLOR_TO_SV_TOKEN so the\n// default theme always emits them (they otherwise tree-shake to no-ops when a\n// config authored with shadcn names is not scanned, e.g. the native-free binary\n// path). Each resolves to the same --sv-* role as its v1-name sibling.',
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
const CANONICAL_FONT_UTILITIES = [
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
const TOKEN_CATALOGUE = [
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
  { kind: 'token', key: 'bg', trailing: '// neutral-50' },
  { kind: 'token', key: 'bgSubtle', trailing: '// neutral-100' },
  { kind: 'token', key: 'bgRaised' },
  { kind: 'token', key: 'bgOverlay' },
  { kind: 'token', key: 'bgInset' },
  { kind: 'token', key: 'scrim', trailing: '// neutral-950 (mode-invariant)' },
  { kind: 'blank' },
  { kind: 'comment', text: '// ---------- Border roles ----------' },
  { kind: 'token', key: 'border', trailing: '// neutral-200' },
  { kind: 'token', key: 'borderStrong', trailing: '// neutral-300' },
  { kind: 'token', key: 'borderInverse', trailing: '// neutral-900' },
  { kind: 'blank' },
  { kind: 'comment', text: '// ---------- Foreground roles ----------' },
  { kind: 'token', key: 'fg', trailing: '// neutral-950' },
  { kind: 'token', key: 'fgMuted', trailing: '// neutral-600' },
  {
    kind: 'token',
    key: 'fgSubtle',
    trailing: '// off-ramp: neutral-500 (0.56) computes 4.46:1 and fails AA',
  },
  { kind: 'token', key: 'fgDisabled', trailing: '// neutral-400' },
  { kind: 'token', key: 'fgInverse', trailing: '// neutral-50' },
  { kind: 'token', key: 'primary', trailing: '// neutral-900' },
  { kind: 'token', key: 'primaryHover', trailing: '// neutral-800' },
  { kind: 'token', key: 'primaryActive', trailing: '// neutral-950' },
  { kind: 'token', key: 'primaryFg', trailing: '// neutral-50' },
  { kind: 'token', key: 'primarySubtle', trailing: '// neutral-100' },
  { kind: 'token', key: 'primarySubtleFg', trailing: '// neutral-900' },
  { kind: 'blank' },
  { kind: 'comment', text: '// ---------- Focus ring ----------' },
  { kind: 'token', key: 'focusRing', trailing: '// neutral-900 by default' },
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
  { kind: 'token', key: 'errorSolid' },
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
    text: '// ---------- Density (the `compact` step — the `:root` default) ----------\n//\n// Mirrors `V1_ROOT_DENSITY` in `default-theme-layer.ts`, and the mirror is\n// ENFORCED: `Design Token Drift` rule 4 compares these four literals against\n// that block, so the two cannot silently disagree about what "compact" is.\n//\n// Unlike every other entry above, these are NOT consumed through\n// `withVarFallback`. The recipes read them with Tailwind v4\'s arbitrary\n// custom-property syntax — `py-(--sv-density-row-y)`, `text-(length:--sv-density-text)`\n// — which emits a bare `var()` with no inline fallback. The values are held\n// here for the drift mirror and as the one place a reader can see what the\n// default ladder step is worth without opening the CSS layer.',
  },
  { kind: 'token', key: 'densityRowY' },
  { kind: 'token', key: 'densityControlH' },
  { kind: 'token', key: 'densityButtonH' },
  { kind: 'token', key: 'densityGap' },
  { kind: 'token', key: 'densityText' },
] as const satisfies readonly CatalogueItem[]

/* ──────────────── legacy author-key aliases + inherited views ──────────── */

/**
 * The author-key -> `--sv-*` role map. An author writing
 * `theme.colors.background` is repainting `--sv-bg`, and this is the only
 * table that says so.
 *
 * Emitted into `default-design.generated.ts` as `COLOR_TO_SV_TOKEN` in the
 * exact object-literal shape `[internal ref]`
 * AST-parses for its T2 lock — that gate throws rather than proceeding with a
 * shrunken map, so the emitted shape is load-bearing.
 */
const LEGACY_ALIASES = {
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
  // The five chart slots are their own author keys, not aliases of anything.
  // Without these rows an authored `design.colors['chart-1']` would mint
  // `--color-chart-1`, which nothing reads: the chart island paints from
  // `--sv-chart-N`. This is the ONLY route an app has to its own series now
  // that slot 1 no longer borrows the theme primary.
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
const INHERITED = {
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
  /** The v1 font stacks as ordered fallback lists (DTCG `fontFamily`). */
  fontStacks: {
    sans: [
      'IBM Plex Sans Variable',
      'IBM Plex Sans',
      '-apple-system',
      'BlinkMacSystemFont',
      'Segoe UI',
      'system-ui',
      'sans-serif',
    ],
    mono: [
      'JetBrains Mono Variable',
      'JetBrains Mono',
      'ui-monospace',
      'SF Mono',
      'Menlo',
      'Consolas',
      'monospace',
    ],
  },
} as const satisfies DefaultDesignSource['inherited']

/* ──────────────────────────────── the source ───────────────────────────── */

/** @public */
export interface DefaultDesignSource {
  readonly safelist: {
    readonly colorUtilities: readonly SafelistItem[]
    readonly fontUtilities: readonly SafelistItem[]
  }
  readonly tokenCatalogue: readonly CatalogueItem[]
  readonly colorRegistrations: TokenBlock
  readonly scales: {
    readonly fontFamilies: Readonly<Record<string, { readonly family: string }>>
    readonly fontSizes: Scale
    readonly fontSizeLeadings: Scale
    readonly fontWeights: Scale
    readonly lineHeights: Scale
    readonly letterSpacings: Scale
    readonly spacings: OrderedScale
    readonly radii: Scale
    readonly shadows: Scale
    readonly durations: Scale
    readonly easings: Scale
  }
  readonly v1: { readonly light: TokenBlock; readonly dark: TokenBlock }
  readonly roleBridge: TokenBlock
  readonly density: {
    readonly root: TokenBlock
    readonly steps: readonly TokenBlock[]
  }
  readonly neutralFloor: {
    readonly light: TokenBlock
    readonly dark: TokenBlock
    readonly scales: {
      readonly fontFamilies: Readonly<Record<string, { readonly family: string }>>
      readonly fontSizes: Scale
      readonly fontSizeLeadings: Scale
      readonly fontWeights: Scale
      readonly lineHeights: Scale
      readonly radii: Scale
      readonly shadows: Scale
    }
  }
  readonly legacyAliases: Readonly<Record<string, string>>
  readonly inherited: {
    readonly breakpoints: Scale
    readonly spacing: Scale
    readonly roleColorProperty: Readonly<Record<string, string>>
    readonly colorRoleNames: readonly string[]
    readonly platformTypeLadder: readonly (readonly [string, number, number])[]
    readonly fontStacks: Readonly<Record<string, readonly string[]>>
  }
}

/** The single source of truth. @public */
export const DEFAULT_DESIGN_SOURCE = {
  safelist: {
    colorUtilities: CANONICAL_COLOR_UTILITIES,
    fontUtilities: CANONICAL_FONT_UTILITIES,
  },
  tokenCatalogue: TOKEN_CATALOGUE,
  colorRegistrations: {
    selector: '@theme',
    items: [
      {
        kind: 'comment',
        text: '/* Neutral ramp — minted directly so bg-neutral-* utilities resolve */',
      },
      { kind: 'decl', property: '--color-neutral-50', value: { ref: 'neutral-50' } },
      { kind: 'decl', property: '--color-neutral-100', value: { ref: 'neutral-100' } },
      { kind: 'decl', property: '--color-neutral-200', value: { ref: 'neutral-200' } },
      { kind: 'decl', property: '--color-neutral-300', value: { ref: 'neutral-300' } },
      { kind: 'decl', property: '--color-neutral-400', value: { ref: 'neutral-400' } },
      { kind: 'decl', property: '--color-neutral-500', value: { ref: 'neutral-500' } },
      { kind: 'decl', property: '--color-neutral-600', value: { ref: 'neutral-600' } },
      { kind: 'decl', property: '--color-neutral-700', value: { ref: 'neutral-700' } },
      { kind: 'decl', property: '--color-neutral-800', value: { ref: 'neutral-800' } },
      { kind: 'decl', property: '--color-neutral-900', value: { ref: 'neutral-900' } },
      { kind: 'decl', property: '--color-neutral-950', value: { ref: 'neutral-950' } },
      { kind: 'blank' },
      { kind: 'comment', text: '/* Surface roles */' },
      { kind: 'decl', property: '--color-background', value: { ref: 'bg' } },
      { kind: 'decl', property: '--color-background-subtle', value: { ref: 'bg-subtle' } },
      { kind: 'decl', property: '--color-background-raised', value: { ref: 'bg-raised' } },
      { kind: 'decl', property: '--color-background-overlay', value: { ref: 'bg-overlay' } },
      { kind: 'decl', property: '--color-background-inset', value: { ref: 'bg-inset' } },
      { kind: 'decl', property: '--color-scrim', value: { ref: 'scrim' } },
      { kind: 'blank' },
      { kind: 'comment', text: '/* Border roles */' },
      { kind: 'decl', property: '--color-border', value: { ref: 'border' } },
      { kind: 'decl', property: '--color-border-strong', value: { ref: 'border-strong' } },
      { kind: 'decl', property: '--color-border-inverse', value: { ref: 'border-inverse' } },
      { kind: 'blank' },
      { kind: 'comment', text: '/* Foreground roles */' },
      { kind: 'decl', property: '--color-foreground', value: { ref: 'fg' } },
      { kind: 'decl', property: '--color-foreground-muted', value: { ref: 'fg-muted' } },
      { kind: 'decl', property: '--color-foreground-subtle', value: { ref: 'fg-subtle' } },
      { kind: 'decl', property: '--color-foreground-disabled', value: { ref: 'fg-disabled' } },
      { kind: 'decl', property: '--color-foreground-inverse', value: { ref: 'fg-inverse' } },
      { kind: 'blank' },
      { kind: 'comment', text: '/* Primary */' },
      { kind: 'decl', property: '--color-primary', value: { ref: 'primary' } },
      { kind: 'decl', property: '--color-primary-hover', value: { ref: 'primary-hover' } },
      { kind: 'decl', property: '--color-primary-active', value: { ref: 'primary-active' } },
      { kind: 'decl', property: '--color-primary-fg', value: { ref: 'primary-fg' } },
      { kind: 'decl', property: '--color-primary-subtle', value: { ref: 'primary-subtle' } },
      { kind: 'decl', property: '--color-primary-subtle-fg', value: { ref: 'primary-subtle-fg' } },
      { kind: 'blank' },
      { kind: 'comment', text: '/* Focus ring */' },
      { kind: 'decl', property: '--color-focus-ring', value: { ref: 'focus-ring' } },
      { kind: 'blank' },
      { kind: 'comment', text: '/* Warmth accent */' },
      { kind: 'blank' },
      { kind: 'comment', text: '/* Success */' },
      { kind: 'decl', property: '--color-success-bg', value: { ref: 'success-bg' } },
      { kind: 'decl', property: '--color-success-border', value: { ref: 'success-border' } },
      { kind: 'decl', property: '--color-success-fg', value: { ref: 'success-fg' } },
      { kind: 'decl', property: '--color-success-solid', value: { ref: 'success-solid' } },
      { kind: 'decl', property: '--color-success-solid-fg', value: { ref: 'success-solid-fg' } },
      { kind: 'blank' },
      {
        kind: 'comment',
        text: '/* Success numbered ramp — mints bg-success-50/100/.../950 utilities.\n       Values resolve through --sv-success-* (defined in V1_ROOT_LIGHT). */',
      },
      { kind: 'decl', property: '--color-success-50', value: { ref: 'success-50' } },
      { kind: 'decl', property: '--color-success-100', value: { ref: 'success-100' } },
      { kind: 'decl', property: '--color-success-300', value: { ref: 'success-300' } },
      { kind: 'decl', property: '--color-success-500', value: { ref: 'success-500' } },
      { kind: 'decl', property: '--color-success-600', value: { ref: 'success-600' } },
      { kind: 'decl', property: '--color-success-700', value: { ref: 'success-700' } },
      { kind: 'decl', property: '--color-success-950', value: { ref: 'success-950' } },
      { kind: 'blank' },
      { kind: 'comment', text: '/* Warning */' },
      { kind: 'decl', property: '--color-warning-bg', value: { ref: 'warning-bg' } },
      { kind: 'decl', property: '--color-warning-border', value: { ref: 'warning-border' } },
      { kind: 'decl', property: '--color-warning-fg', value: { ref: 'warning-fg' } },
      { kind: 'decl', property: '--color-warning-solid', value: { ref: 'warning-solid' } },
      { kind: 'decl', property: '--color-warning-solid-fg', value: { ref: 'warning-solid-fg' } },
      { kind: 'blank' },
      { kind: 'comment', text: '/* Warning numbered ramp */' },
      { kind: 'decl', property: '--color-warning-50', value: { ref: 'warning-50' } },
      { kind: 'decl', property: '--color-warning-100', value: { ref: 'warning-100' } },
      { kind: 'decl', property: '--color-warning-300', value: { ref: 'warning-300' } },
      { kind: 'decl', property: '--color-warning-500', value: { ref: 'warning-500' } },
      { kind: 'decl', property: '--color-warning-700', value: { ref: 'warning-700' } },
      { kind: 'decl', property: '--color-warning-950', value: { ref: 'warning-950' } },
      { kind: 'blank' },
      { kind: 'comment', text: '/* Error */' },
      { kind: 'decl', property: '--color-error-bg', value: { ref: 'error-bg' } },
      { kind: 'decl', property: '--color-error-border', value: { ref: 'error-border' } },
      { kind: 'decl', property: '--color-error-fg', value: { ref: 'error-fg' } },
      { kind: 'decl', property: '--color-error-solid', value: { ref: 'error-solid' } },
      { kind: 'decl', property: '--color-error-solid-fg', value: { ref: 'error-solid-fg' } },
      { kind: 'blank' },
      { kind: 'comment', text: '/* Error numbered ramp */' },
      { kind: 'decl', property: '--color-error-50', value: { ref: 'error-50' } },
      { kind: 'decl', property: '--color-error-100', value: { ref: 'error-100' } },
      { kind: 'decl', property: '--color-error-300', value: { ref: 'error-300' } },
      { kind: 'decl', property: '--color-error-500', value: { ref: 'error-500' } },
      { kind: 'decl', property: '--color-error-600', value: { ref: 'error-600' } },
      { kind: 'decl', property: '--color-error-700', value: { ref: 'error-700' } },
      { kind: 'decl', property: '--color-error-950', value: { ref: 'error-950' } },
      { kind: 'blank' },
      { kind: 'comment', text: '/* Info */' },
      { kind: 'decl', property: '--color-info-bg', value: { ref: 'info-bg' } },
      { kind: 'decl', property: '--color-info-border', value: { ref: 'info-border' } },
      { kind: 'decl', property: '--color-info-fg', value: { ref: 'info-fg' } },
      { kind: 'decl', property: '--color-info-solid', value: { ref: 'info-solid' } },
      { kind: 'decl', property: '--color-info-solid-fg', value: { ref: 'info-solid-fg' } },
      { kind: 'blank' },
      { kind: 'comment', text: '/* Info numbered ramp */' },
      { kind: 'decl', property: '--color-info-50', value: { ref: 'info-50' } },
      { kind: 'decl', property: '--color-info-100', value: { ref: 'info-100' } },
      { kind: 'decl', property: '--color-info-300', value: { ref: 'info-300' } },
      { kind: 'decl', property: '--color-info-500', value: { ref: 'info-500' } },
      { kind: 'decl', property: '--color-info-600', value: { ref: 'info-600' } },
      { kind: 'decl', property: '--color-info-700', value: { ref: 'info-700' } },
      { kind: 'decl', property: '--color-info-950', value: { ref: 'info-950' } },
      { kind: 'blank' },
      {
        kind: 'comment',
        text: "/* shadcn-convention alias utilities (DEC-060). Mirror COLOR_TO_SV_TOKEN in\n       theme-generators.ts so the DEFAULT theme mints the same shadcn names the\n       custom-theme path already accepts — text-primary-foreground / bg-card /\n       bg-muted / text-muted-foreground / bg-popover / bg-destructive /\n       text-destructive-foreground resolve to their --sv-* role token in BOTH\n       light and dark (previously they no-op'd on the default theme, leaving\n       button text inheriting --sv-fg → near-invisible in dark mode). Each maps\n       to the SAME --sv-* role its v1-name sibling maps to, so the alias and the\n       v1 utility compute identically. The Group-A *-foreground / destructive\n       names were the author-override inputs the alias bridge read as\n       var(--color-X, ...); those bridge fallbacks are dropped (custom themes set\n       the --sv-* role directly via generateAuthorSvBridge), so registering them\n       here does NOT form a --color-X to --sv-role to --color-X cycle. */",
      },
      { kind: 'decl', property: '--color-primary-foreground', value: { ref: 'primary-fg' } },
      { kind: 'decl', property: '--color-card', value: { ref: 'bg-raised' } },
      { kind: 'decl', property: '--color-muted', value: { ref: 'bg-subtle' } },
      { kind: 'decl', property: '--color-muted-foreground', value: { ref: 'fg-muted' } },
      { kind: 'decl', property: '--color-popover', value: { ref: 'bg-overlay' } },
      { kind: 'decl', property: '--color-destructive', value: { ref: 'error-solid' } },
      {
        kind: 'decl',
        property: '--color-destructive-foreground',
        value: { ref: 'error-solid-fg' },
      },
    ],
  },
  scales: {
    fontFamilies: DEFAULT_FONT_FAMILIES,
    fontSizes: FONT_SIZES,
    fontSizeLeadings: FONT_SIZE_LEADINGS,
    fontWeights: FONT_WEIGHTS,
    lineHeights: LINE_HEIGHTS,
    letterSpacings: LETTER_SPACINGS,
    spacings: SPACINGS,
    radii: DEFAULT_RADII,
    shadows: DEFAULT_SHADOWS,
    durations: DURATIONS,
    easings: EASINGS,
  },
  v1: {
    light: {
      selector: ':root',
      items: [
        { kind: 'decl', property: 'color-scheme', value: 'light' },
        { kind: 'blank' },
        { kind: 'comment', text: '/* ---------- Neutral ramp — warm cast ---------- */' },
        { kind: 'decl', property: '--sv-neutral-50', value: 'oklch(0.985 0 0)' },
        { kind: 'decl', property: '--sv-neutral-100', value: 'oklch(0.965 0 0)' },
        { kind: 'decl', property: '--sv-neutral-200', value: 'oklch(0.92 0 0)' },
        { kind: 'decl', property: '--sv-neutral-300', value: 'oklch(0.87 0 0)' },
        { kind: 'decl', property: '--sv-neutral-400', value: 'oklch(0.71 0 0)' },
        { kind: 'decl', property: '--sv-neutral-500', value: 'oklch(0.56 0 0)' },
        { kind: 'decl', property: '--sv-neutral-600', value: 'oklch(0.445 0 0)' },
        { kind: 'decl', property: '--sv-neutral-700', value: 'oklch(0.375 0 0)' },
        { kind: 'decl', property: '--sv-neutral-800', value: 'oklch(0.272 0 0)' },
        { kind: 'decl', property: '--sv-neutral-900', value: 'oklch(0.205 0 0)' },
        { kind: 'decl', property: '--sv-neutral-950', value: 'oklch(0.14 0 0)' },
        { kind: 'blank' },
        { kind: 'comment', text: '/* ---------- Warmth accent ---------- */' },
        { kind: 'blank' },
        { kind: 'comment', text: '/* ---------- Semantic ramps (locked) ---------- */' },
        { kind: 'decl', property: '--sv-success-50', value: { ref: 'neutral-50' } },
        {
          kind: 'decl',
          property: '--sv-success-100',
          value: { ref: 'neutral-200' },
          islandFallback: 'oklch(0.925 0 0)',
        },
        { kind: 'decl', property: '--sv-success-300', value: { ref: 'neutral-300' } },
        { kind: 'decl', property: '--sv-success-500', value: { ref: 'neutral-500' } },
        {
          kind: 'decl',
          property: '--sv-success-600',
          value: { ref: 'neutral-600' },
          islandFallback: 'oklch(0.45 0 0)',
        },
        {
          kind: 'decl',
          property: '--sv-success-700',
          value: { ref: 'neutral-600' },
          islandFallback: 'oklch(0.45 0 0)',
        },
        { kind: 'decl', property: '--sv-success-950', value: { ref: 'neutral-900' } },
        { kind: 'blank' },
        { kind: 'decl', property: '--sv-warning-50', value: { ref: 'neutral-50' } },
        { kind: 'decl', property: '--sv-warning-100', value: { ref: 'neutral-100' } },
        { kind: 'decl', property: '--sv-warning-300', value: { ref: 'neutral-300' } },
        {
          kind: 'decl',
          property: '--sv-warning-500',
          value: { ref: 'neutral-400' },
          islandFallback: 'oklch(0.72 0 0)',
        },
        {
          kind: 'decl',
          property: '--sv-warning-700',
          value: { ref: 'neutral-600' },
          islandFallback: 'oklch(0.45 0 0)',
        },
        {
          kind: 'decl',
          property: '--sv-warning-950',
          value: { ref: 'neutral-800' },
          islandFallback: 'oklch(0.27 0 0)',
        },
        { kind: 'blank' },
        {
          kind: 'comment',
          text: '/* Error — the ONE hue the system spends on consequence, so it is the one\n       ramp written as exact sRGB rather than as a formula. Four steps are the\n       reference values verbatim: 100 is the alert ground, 300 its hairline,\n       600 the solid, 700 the text. The remaining three are interpolated on the\n       same hue (~32) and chroma envelope so the ladder stays one family.\n\n       Warmer and less saturated than the ramp it replaces (hue 25, chroma up\n       to 0.205): at that chroma a destructive button reads as an alarm rather\n       than as a consequence, and next to the neutral ramp it fluoresced. */',
        },
        { kind: 'decl', property: '--sv-error-50', value: '#fefbfa' },
        { kind: 'decl', property: '--sv-error-100', value: '#fdf5f3' },
        { kind: 'decl', property: '--sv-error-300', value: '#f0c8bd' },
        { kind: 'decl', property: '--sv-error-500', value: '#dc472e' },
        { kind: 'decl', property: '--sv-error-600', value: '#c13520' },
        { kind: 'decl', property: '--sv-error-700', value: '#a12b1a' },
        { kind: 'decl', property: '--sv-error-950', value: '#3d0e08' },
        { kind: 'blank' },
        { kind: 'decl', property: '--sv-info-50', value: { ref: 'neutral-50' } },
        {
          kind: 'decl',
          property: '--sv-info-100',
          value: { ref: 'neutral-200' },
          islandFallback: 'oklch(0.925 0 0)',
        },
        { kind: 'decl', property: '--sv-info-300', value: { ref: 'neutral-300' } },
        { kind: 'decl', property: '--sv-info-500', value: { ref: 'neutral-500' } },
        {
          kind: 'comment',
          text: '/* Info\'s SOLID step — and only this step — carries the first data-series\n       hue. --sv-info-solid refs 600, so this is what an informational mark\n       is painted with.\n\n       ADR-024 A1 deleted the semantic ramps because hue was being spent to\n       make surfaces look finished. A data-series hue is not that: it is\n       already the system\'s published answer to "a distinguishable category of\n       thing", so reusing series 1 for info spends no NEW colour and gives\n       the one role that had gone fully invisible a way to be seen. The rest of\n       this ramp stays monochrome ON PURPOSE — an informational surface is a\n       hairline on a neutral well carrying a coloured mark, not a blue box.\n       (ADR-024 amendment, 2026-09-08.) */',
        },
        { kind: 'decl', property: '--sv-info-600', value: '#398ad6' },
        {
          kind: 'decl',
          property: '--sv-info-700',
          value: { ref: 'neutral-600' },
          islandFallback: 'oklch(0.45 0 0)',
        },
        { kind: 'decl', property: '--sv-info-950', value: { ref: 'neutral-900' } },
        { kind: 'blank' },
        { kind: 'comment', text: '/* Humane fg — literal, no author alias */' },
        { kind: 'blank' },
        {
          kind: 'comment',
          text: '/* Scrim — mode-invariant dark modal backdrop. Pinned to the darkest ramp\n       step and intentionally NOT overridden in the dark cascade, so it stays a\n       dark veil in both light and dark modes (unlike bg-foreground/50, which inverts). */',
        },
        { kind: 'decl', property: '--sv-scrim', value: { ref: 'neutral-950' } },
      ],
    },
    dark: {
      selector: "html:is(.dark, [data-theme='dark'])",
      items: [
        { kind: 'decl', property: 'color-scheme', value: 'dark' },
        { kind: 'blank' },
        {
          kind: 'comment',
          text:
            '/* The four ground levels, ORDERED — and in dark the order inverts.\n\n' +
            '       In light a raised surface is lighter than the page and a well is\n' +
            '       darker: ground 0.985, raised 0.995, well 0.965, inset 0.952. Dark\n' +
            '       cannot mirror that, because darker than 0.14 is indistinguishable\n' +
            '       from black — so everything moves the other way and a well ends up\n' +
            '       LIGHTER than the surface it is cut into. The reference drawings do\n' +
            '       exactly this: ground #131313 < raised #1a1a1a < well #222220.\n\n' +
            '       bg-subtle and bg-raised used to be the SAME dark step, which made\n' +
            '       every raised-to-well hover inert in dark: a secondary button, a\n' +
            '       ghost button, a menu row and a table row each changed to the colour\n' +
            '       they already were. Measured live, not inferred. bg-overlay moves\n' +
            '       down to join raised, mirroring light, where a popup and a raised\n' +
            '       surface are one value.\n\n' +
            '       CLOSED (founder call, 2026-09-10). bg-inset used to share the\n' +
            '       neutral-800 step with bg-subtle AND with border, so a bordered inset\n' +
            '       panel had an invisible edge and a recess was the same colour as the\n' +
            '       panel it was cut into — three roles, one value. The ladder below is\n' +
            '       strictly increasing again: bg 0.14 < raised/overlay 0.205 <\n' +
            '       subtle 0.272 < inset 0.289 < border 0.321 < border-strong 0.375.\n\n' +
            '       The three grounds R-B separated do not move. The two values the ramp\n' +
            '       lacks are written as literals rather than minted as ramp steps,\n' +
            '       because they are dark-only: 0.289 and 0.321 are not rungs a LIGHT\n' +
            '       ramp wants, and the light scheme already writes bg-inset (0.952) and\n' +
            '       fg-subtle (0.54) as literals for exactly that reason.\n\n' +
            '       Provenance, per value:\n' +
            '         inset  0.289 — the reference drawing verbatim; oklch(0.289 0 0)\n' +
            '                        renders #2b2b2b, which IS the drawing hex.\n' +
            '         border 0.321 — the drawings give none (they draw hair and inset at\n' +
            '                        one value, which is the collision this fixes), so it\n' +
            "                        keeps the LIGHT scheme's own inset-to-border step:\n" +
            '                        light 0.952 - 0.920 = 0.032, dark 0.321 - 0.289 =\n' +
            '                        0.032. Measured, the two schemes now read the same:\n' +
            '                        a border on an inset panel is 1.11:1 in light and\n' +
            '                        1.12:1 in dark. */',
        },
        { kind: 'decl', property: '--sv-bg', value: { ref: 'neutral-950' } },
        { kind: 'decl', property: '--sv-bg-raised', value: { ref: 'neutral-900' } },
        { kind: 'decl', property: '--sv-bg-overlay', value: { ref: 'neutral-900' } },
        { kind: 'decl', property: '--sv-bg-subtle', value: { ref: 'neutral-800' } },
        { kind: 'decl', property: '--sv-bg-inset', value: 'oklch(0.289 0 0)' },
        { kind: 'blank' },
        { kind: 'decl', property: '--sv-border', value: 'oklch(0.321 0 0)' },
        { kind: 'decl', property: '--sv-border-strong', value: { ref: 'neutral-700' } },
        { kind: 'decl', property: '--sv-border-inverse', value: { ref: 'neutral-50' } },
        { kind: 'blank' },
        { kind: 'decl', property: '--sv-fg', value: { ref: 'neutral-50' } },
        { kind: 'decl', property: '--sv-fg-muted', value: { ref: 'neutral-400' } },
        {
          kind: 'comment',
          text: '/* fg-subtle is a TEXT token, so it is pinned slightly lighter than\n       --sv-neutral-500 (oklch L 0.56) to clear WCAG AA (>= 4.5:1) on\n       bg-background in dark mode while staying clearly darker than fg-muted. */',
        },
        { kind: 'decl', property: '--sv-fg-subtle', value: 'oklch(0.59 0 0)' },
        {
          kind: 'comment',
          text: '/* fg-disabled sat on neutral-700, the SAME step as border-strong, so\n       disabled ink and the strongest rule in the system were one colour —\n       and disabled text read at 1.95:1 on the page, below the 2.48:1 its\n       light counterpart gets. 0.475 is the reference drawing verbatim\n       (oklch(0.475 0 0) renders #5c5c5c, the drawing hex): it clears\n       border-strong by 0.100 L, stays 0.115 L under fg-subtle, and lifts\n       disabled ink to 2.98:1 — still plainly disabled, no longer illegible.\n       (Founder call, 2026-09-10.) */',
        },
        { kind: 'decl', property: '--sv-fg-disabled', value: 'oklch(0.475 0 0)' },
        { kind: 'decl', property: '--sv-fg-inverse', value: { ref: 'neutral-950' } },
        { kind: 'blank' },
        { kind: 'decl', property: '--sv-primary', value: { ref: 'neutral-50' } },
        { kind: 'decl', property: '--sv-primary-hover', value: { ref: 'neutral-200' } },
        { kind: 'decl', property: '--sv-primary-active', value: 'oklch(1 0 0)' },
        { kind: 'decl', property: '--sv-primary-fg', value: { ref: 'neutral-950' } },
        { kind: 'decl', property: '--sv-primary-subtle', value: { ref: 'neutral-800' } },
        { kind: 'decl', property: '--sv-primary-subtle-fg', value: { ref: 'neutral-50' } },
        { kind: 'blank' },
        { kind: 'decl', property: '--sv-focus-ring', value: { ref: 'neutral-50' } },
        { kind: 'blank' },
        {
          kind: 'decl',
          property: '--sv-success-bg',
          value: { ref: 'success-950' },
          islandFallback: 'oklch(0.925 0 0)',
        },
        { kind: 'decl', property: '--sv-success-border', value: { ref: 'neutral-700' } },
        {
          kind: 'decl',
          property: '--sv-success-fg',
          value: { ref: 'neutral-300' },
          islandFallback: 'oklch(0.45 0 0)',
        },
        {
          kind: 'decl',
          property: '--sv-success-solid',
          value: { ref: 'success-500' },
          islandFallback: 'oklch(0.45 0 0)',
        },
        { kind: 'decl', property: '--sv-success-solid-fg', value: { ref: 'neutral-950' } },
        { kind: 'blank' },
        { kind: 'decl', property: '--sv-warning-bg', value: { ref: 'warning-950' } },
        { kind: 'decl', property: '--sv-warning-border', value: { ref: 'neutral-600' } },
        {
          kind: 'decl',
          property: '--sv-warning-fg',
          value: { ref: 'neutral-300' },
          islandFallback: 'oklch(0.45 0 0)',
        },
        {
          kind: 'decl',
          property: '--sv-warning-solid',
          value: { ref: 'neutral-300' },
          islandFallback: 'oklch(0.72 0 0)',
        },
        {
          kind: 'decl',
          property: '--sv-warning-solid-fg',
          value: { ref: 'warning-950' },
          islandFallback: 'oklch(0.27 0 0)',
        },
        { kind: 'blank' },
        {
          kind: 'comment',
          text: '/* Error, dark. Four literals rather than ramp refs: the light ramp is\n       tuned for ink on paper and reads dirty when it is simply inverted, so\n       the dark scheme gets its own four reference values on the same hue. */',
        },
        { kind: 'decl', property: '--sv-error-bg', value: '#3a2323' },
        { kind: 'decl', property: '--sv-error-border', value: '#6b3a32' },
        { kind: 'decl', property: '--sv-error-fg', value: '#e88a79' },
        { kind: 'decl', property: '--sv-error-solid', value: '#e0705c' },
        {
          kind: 'decl',
          property: '--sv-error-solid-fg',
          value: { ref: 'neutral-950' },
          islandFallback: 'oklch(0.14 0 0)',
        },
        { kind: 'blank' },
        {
          kind: 'decl',
          property: '--sv-info-bg',
          value: { ref: 'info-950' },
          islandFallback: 'oklch(0.925 0 0)',
        },
        { kind: 'decl', property: '--sv-info-border', value: { ref: 'neutral-700' } },
        {
          kind: 'decl',
          property: '--sv-info-fg',
          value: { ref: 'neutral-300' },
          islandFallback: 'oklch(0.45 0 0)',
        },
        {
          kind: 'comment',
          text: '/* The series hue is scheme-invariant — --sv-chart-1 is not re-declared\n       in dark either — so the informational mark is the same blue on both\n       grounds. Re-pointing it at the ramp here is what would make info grey\n       again after dark, which is the bug this line exists to prevent. */',
        },
        { kind: 'decl', property: '--sv-info-solid', value: '#398ad6' },
        { kind: 'decl', property: '--sv-info-solid-fg', value: { ref: 'neutral-50' } },
      ],
    },
  },
  roleBridge: {
    selector: ':root',
    items: [
      {
        kind: 'comment',
        text: '/* Surface roles.\n       Neutral defaults are used directly (no var(--color-background, ...)\n       self-reference) to avoid the --color-background to --sv-bg to\n       --color-background custom-property CYCLE that left text-background on\n       bg-primary invalid-at-computed-value in zero-config — surface inherited\n       --sv-fg (near-black) and primary buttons rendered black-on-black in\n       light mode. The --color-muted / --color-card / --color-popover author\n       keys are NOT registered back to --sv-bg-* (no forward alias), but the\n       same pattern is applied for symmetry with the border/foreground/primary\n       roles above. Author override of --color-background still reaches every\n       bg-background utility directly via the registration in\n       V1_THEME_COLOR_REGISTRATIONS. */',
      },
      { kind: 'decl', property: '--sv-bg', value: { ref: 'neutral-50' } },
      { kind: 'decl', property: '--sv-bg-subtle', value: { ref: 'neutral-100' } },
      { kind: 'decl', property: '--sv-bg-raised', value: 'oklch(0.995 0 0)' },
      { kind: 'decl', property: '--sv-bg-overlay', value: 'oklch(0.995 0 0)' },
      {
        kind: 'comment',
        text: '/* Inset — the fourth ground, and the only one that goes DOWN.\n       raised and overlay sit above the page; subtle is the page, quieter. Inset\n       is a hole in it: a gutter, a disabled control fill, the well a frozen\n       table column casts its shadow into. Those were being painted with\n       bg-subtle, which made a recess and a panel the same colour and left the\n       recess reading as a slightly grubby card. */',
      },
      { kind: 'decl', property: '--sv-bg-inset', value: 'oklch(0.952 0 0)' },
      { kind: 'blank' },
      {
        kind: 'comment',
        text: "/* Border roles.\n       NOTE: sv-border/-strong/-inverse use the v1 neutral default DIRECTLY\n       (no var(--color-border, ...) self-reference). The canonical\n       --color-border token is registered in V1_THEME_COLOR_REGISTRATIONS as\n       --color-border: var(--sv-border); pulling it back in here as the\n       bridge's own author key would form a --color-border to --sv-border to\n       --color-border custom-property CYCLE that the engine resolves to NOTHING\n       (transparent/empty) in zero-config — the exact unstyled footgun these\n       contracts guard against. Author override still works: an author\n       --color-border value overrides the registration default directly, so\n       border-border (which reads var(--color-border)) picks it up without the\n       bridge needing to re-alias it. The --color-input alias is preserved as a\n       non-cyclic author key. */",
      },
      {
        kind: 'decl',
        property: '--sv-border',
        value: { authorKey: 'color-input', fallback: { ref: 'neutral-200' } },
      },
      { kind: 'decl', property: '--sv-border-strong', value: { ref: 'neutral-300' } },
      { kind: 'decl', property: '--sv-border-inverse', value: { ref: 'neutral-900' } },
      { kind: 'blank' },
      {
        kind: 'comment',
        text: '/* Foreground roles.\n       --sv-fg uses the neutral default directly (no var(--color-foreground, ...)\n       self-reference) to avoid the --color-foreground to --sv-fg to\n       --color-foreground custom-property CYCLE that resolved tooltip\n       backgrounds to transparent in zero-config (see border/primary notes\n       above). Author override of --color-foreground reaches every\n       bg-foreground/text-foreground utility directly via the registration. */',
      },
      { kind: 'decl', property: '--sv-fg', value: { ref: 'neutral-950' } },
      {
        kind: 'comment',
        text: '/* fg-muted uses the v1 neutral default DIRECTLY (no var(--color-muted-foreground,\n       …) self-reference) to avoid the --color-muted-foreground → --sv-fg-muted →\n       --color-muted-foreground CYCLE now that --color-muted-foreground is a\n       registered shadcn alias (DEC-060). Author override still flows through\n       --sv-fg-muted directly via generateAuthorSvBridge. */',
      },
      { kind: 'decl', property: '--sv-fg-muted', value: { ref: 'neutral-600' } },
      {
        kind: 'comment',
        text: '/* fg-subtle/-disabled/-inverse use the neutral default directly to avoid\n       the --color-foreground-* to --sv-fg-* to --color-foreground-* cycle (see border note\n       above). Author override still flows through --color-foreground-*. */',
      },
      {
        kind: 'comment',
        text: '/* fg-subtle is a TEXT token, so it is pinned slightly darker than\n       --sv-neutral-500 (oklch L 0.56) to clear WCAG AA (>= 4.5:1) on\n       bg-background in light mode while staying clearly lighter than fg-muted. */',
      },
      { kind: 'decl', property: '--sv-fg-subtle', value: 'oklch(0.54 0 0)' },
      { kind: 'decl', property: '--sv-fg-disabled', value: { ref: 'neutral-400' } },
      { kind: 'decl', property: '--sv-fg-inverse', value: { ref: 'neutral-50' } },
      { kind: 'blank' },
      {
        kind: 'comment',
        text: "/* Primary.\n       Neutral defaults are used directly (no var(--color-primary, ...)\n       self-reference) to avoid the --color-primary to --sv-primary to\n       --color-primary cycle that left bg-primary transparent in zero-config.\n       --sv-primary-fg likewise uses the neutral default DIRECTLY: as of DEC-060\n       --color-primary-foreground is a REGISTERED shadcn alias\n       (--color-primary-foreground: var(--sv-primary-fg)), so reading it back as\n       this role's fallback would form a --color-primary-foreground → --sv-primary-fg\n       → --color-primary-foreground cycle. Author override of primary-foreground\n       reaches --sv-primary-fg directly via generateAuthorSvBridge. */",
      },
      { kind: 'decl', property: '--sv-primary', value: { ref: 'neutral-900' } },
      { kind: 'decl', property: '--sv-primary-hover', value: { ref: 'neutral-800' } },
      { kind: 'decl', property: '--sv-primary-active', value: { ref: 'neutral-950' } },
      { kind: 'decl', property: '--sv-primary-fg', value: { ref: 'neutral-50' } },
      { kind: 'decl', property: '--sv-primary-subtle', value: { ref: 'neutral-100' } },
      { kind: 'decl', property: '--sv-primary-subtle-fg', value: { ref: 'neutral-900' } },
      { kind: 'blank' },
      {
        kind: 'comment',
        text: "/* Chart series palette — slot N paints series index N-1.\n\n       All five slots are ONE lightness and ONE chroma, five hues apart, and no\n       slot is derived from the theme. Slot 1 used to be re-pointed at an\n       authored primary so a single-series chart came out on-brand for free;\n       that is gone, because the property which makes this set readable is\n       precisely that every series sits at the same lightness — and an\n       arbitrary brand colour does not. A ramp of one hue's lightness steps\n       fails the same test from the other direction: it collapses under\n       deuteranopia and on small bars.\n\n       An app that wants its own series declares design.colors['chart-N']\n       directly, which reaches --sv-chart-N through the author bridge. That is\n       explicit, per-slot, and does not quietly break the other four. */",
      },
      ...chartDecls(),
      { kind: 'blank' },
      { kind: 'comment', text: '/* Focus ring */' },
      {
        kind: 'decl',
        property: '--sv-focus-ring',
        value: { authorKey: 'color-ring', fallback: { ref: 'neutral-900' } },
      },
      { kind: 'blank' },
      { kind: 'blank' },
      { kind: 'comment', text: "/* Success — author 'success' overrides the -solid slot only */" },
      {
        kind: 'decl',
        property: '--sv-success-bg',
        value: { ref: 'success-100' },
        islandFallback: 'oklch(0.925 0 0)',
      },
      { kind: 'decl', property: '--sv-success-border', value: { ref: 'success-300' } },
      {
        kind: 'decl',
        property: '--sv-success-fg',
        value: { ref: 'success-700' },
        islandFallback: 'oklch(0.45 0 0)',
      },
      {
        kind: 'decl',
        property: '--sv-success-solid',
        value: { authorKey: 'color-success', fallback: { ref: 'success-600' } },
        islandFallback: 'oklch(0.45 0 0)',
      },
      { kind: 'decl', property: '--sv-success-solid-fg', value: { ref: 'neutral-50' } },
      { kind: 'blank' },
      { kind: 'comment', text: '/* Warning */' },
      { kind: 'decl', property: '--sv-warning-bg', value: { ref: 'warning-100' } },
      { kind: 'decl', property: '--sv-warning-border', value: { ref: 'warning-300' } },
      {
        kind: 'decl',
        property: '--sv-warning-fg',
        value: { ref: 'warning-700' },
        islandFallback: 'oklch(0.45 0 0)',
      },
      {
        kind: 'decl',
        property: '--sv-warning-solid',
        value: { authorKey: 'color-warning', fallback: { ref: 'warning-500' } },
        islandFallback: 'oklch(0.72 0 0)',
      },
      {
        kind: 'decl',
        property: '--sv-warning-solid-fg',
        value: { ref: 'warning-950' },
        islandFallback: 'oklch(0.27 0 0)',
      },
      { kind: 'blank' },
      {
        kind: 'comment',
        text: "/* Error — author 'danger'/'error' override the -solid slot via --color-error.\n       The --color-destructive / --color-destructive-foreground shadcn names are\n       NO LONGER read here: as of DEC-060 they are registered aliases\n       (--color-destructive: var(--sv-error-solid)), so reading them back as this\n       role's fallback would form a --color-destructive → --sv-error-solid →\n       --color-destructive cycle. A destructive author override reaches\n       --sv-error-solid directly via generateAuthorSvBridge. */",
      },
      { kind: 'decl', property: '--sv-error-bg', value: { ref: 'error-100' } },
      { kind: 'decl', property: '--sv-error-border', value: { ref: 'error-300' } },
      { kind: 'decl', property: '--sv-error-fg', value: { ref: 'error-700' } },
      {
        kind: 'decl',
        property: '--sv-error-solid',
        value: { authorKey: 'color-error', fallback: { ref: 'error-600' } },
      },
      {
        kind: 'decl',
        property: '--sv-error-solid-fg',
        value: { ref: 'neutral-50' },
        islandFallback: 'oklch(0.985 0.003 75)',
      },
      { kind: 'blank' },
      { kind: 'comment', text: '/* Info */' },
      {
        kind: 'decl',
        property: '--sv-info-bg',
        value: { ref: 'info-100' },
        islandFallback: 'oklch(0.925 0 0)',
      },
      { kind: 'decl', property: '--sv-info-border', value: { ref: 'info-300' } },
      {
        kind: 'decl',
        property: '--sv-info-fg',
        value: { ref: 'info-700' },
        islandFallback: 'oklch(0.45 0 0)',
      },
      {
        kind: 'decl',
        property: '--sv-info-solid',
        value: { authorKey: 'color-info', fallback: { ref: 'info-600' } },
      },
      { kind: 'decl', property: '--sv-info-solid-fg', value: { ref: 'neutral-50' } },
    ],
  },
  density: {
    root: densityBlock(':root', DEFAULT_DENSITY.steps.compact),
    steps: [
      densityBlock("[data-density='cozy']", DEFAULT_DENSITY.steps.cozy),
      densityBlock("[data-density='roomy']", DEFAULT_DENSITY.steps.roomy),
    ],
  },
  neutralFloor: {
    light: {
      selector: ':root',
      items: [
        { kind: 'decl', property: 'color-scheme', value: 'light' },
        { kind: 'blank' },
        { kind: 'comment', text: '/* Plain grayscale ramp (no warm cast) */' },
        { kind: 'decl', property: '--sv-neutral-50', value: '#fafafa' },
        { kind: 'decl', property: '--sv-neutral-100', value: '#f5f5f5' },
        { kind: 'decl', property: '--sv-neutral-200', value: '#e5e5e5' },
        { kind: 'decl', property: '--sv-neutral-300', value: '#d4d4d4' },
        { kind: 'decl', property: '--sv-neutral-400', value: '#a3a3a3' },
        { kind: 'decl', property: '--sv-neutral-500', value: '#737373' },
        { kind: 'decl', property: '--sv-neutral-600', value: '#525252' },
        { kind: 'decl', property: '--sv-neutral-700', value: '#404040' },
        { kind: 'decl', property: '--sv-neutral-800', value: '#262626' },
        { kind: 'decl', property: '--sv-neutral-900', value: '#171717' },
        { kind: 'decl', property: '--sv-neutral-950', value: '#0a0a0a' },
        { kind: 'blank' },
        { kind: 'comment', text: '/* Neutral semantic hues — desaturated, generic */' },
        { kind: 'blank' },
        { kind: 'decl', property: '--sv-success-50', value: { ref: 'neutral-50' } },
        {
          kind: 'decl',
          property: '--sv-success-100',
          value: { ref: 'neutral-100' },
          islandFallback: 'oklch(0.925 0 0)',
        },
        { kind: 'decl', property: '--sv-success-300', value: { ref: 'neutral-300' } },
        { kind: 'decl', property: '--sv-success-500', value: { ref: 'neutral-500' } },
        {
          kind: 'decl',
          property: '--sv-success-600',
          value: { ref: 'neutral-600' },
          islandFallback: 'oklch(0.45 0 0)',
        },
        {
          kind: 'decl',
          property: '--sv-success-700',
          value: { ref: 'neutral-700' },
          islandFallback: 'oklch(0.45 0 0)',
        },
        { kind: 'decl', property: '--sv-success-950', value: { ref: 'neutral-950' } },
        { kind: 'blank' },
        { kind: 'decl', property: '--sv-warning-50', value: { ref: 'neutral-50' } },
        { kind: 'decl', property: '--sv-warning-100', value: { ref: 'neutral-100' } },
        { kind: 'decl', property: '--sv-warning-300', value: { ref: 'neutral-300' } },
        {
          kind: 'decl',
          property: '--sv-warning-500',
          value: { ref: 'neutral-500' },
          islandFallback: 'oklch(0.72 0 0)',
        },
        {
          kind: 'decl',
          property: '--sv-warning-700',
          value: { ref: 'neutral-700' },
          islandFallback: 'oklch(0.45 0 0)',
        },
        {
          kind: 'decl',
          property: '--sv-warning-950',
          value: { ref: 'neutral-950' },
          islandFallback: 'oklch(0.27 0 0)',
        },
        { kind: 'blank' },
        { kind: 'decl', property: '--sv-error-50', value: '#fef2f2' },
        { kind: 'decl', property: '--sv-error-100', value: '#fee2e2' },
        { kind: 'decl', property: '--sv-error-300', value: '#fca5a5' },
        { kind: 'decl', property: '--sv-error-500', value: '#ef4444' },
        { kind: 'decl', property: '--sv-error-600', value: '#dc2626' },
        { kind: 'decl', property: '--sv-error-700', value: '#b91c1c' },
        { kind: 'decl', property: '--sv-error-950', value: '#450a0a' },
        { kind: 'blank' },
        { kind: 'decl', property: '--sv-info-50', value: { ref: 'neutral-50' } },
        {
          kind: 'decl',
          property: '--sv-info-100',
          value: { ref: 'neutral-100' },
          islandFallback: 'oklch(0.925 0 0)',
        },
        { kind: 'decl', property: '--sv-info-300', value: { ref: 'neutral-300' } },
        { kind: 'decl', property: '--sv-info-500', value: { ref: 'neutral-500' } },
        {
          kind: 'decl',
          property: '--sv-info-600',
          value: { ref: 'neutral-600' },
          islandFallback: 'oklch(0.45 0 0)',
        },
        {
          kind: 'decl',
          property: '--sv-info-700',
          value: { ref: 'neutral-700' },
          islandFallback: 'oklch(0.45 0 0)',
        },
        { kind: 'decl', property: '--sv-info-950', value: { ref: 'neutral-950' } },
        { kind: 'blank' },
        {
          kind: 'comment',
          text: '/* Scrim — mode-invariant dark modal backdrop (see V1_ROOT_LIGHT). */',
        },
        { kind: 'decl', property: '--sv-scrim', value: { ref: 'neutral-950' } },
      ],
    },
    dark: {
      selector: "html:is(.dark, [data-theme='dark'])",
      items: [
        { kind: 'decl', property: 'color-scheme', value: 'dark' },
        { kind: 'blank' },
        {
          kind: 'comment',
          text:
            '/* The four ground levels, ordered as in the v1 dark block above:\n' +
            '       raised and overlay on one step, the well a step lighter. See that\n' +
            '       block for why dark inverts the order, and for how the inset/border\n' +
            '       collision was closed — the floor takes the same fix, in its own hex\n' +
            "       idiom, because the defect was the floor's too: a bordered inset panel\n" +
            '       had no visible edge and disabled ink was border-strong. The floor\n' +
            "       ramp sits within 0.004 L of v1's at every step it shares (800 0.269,\n" +
            '       700 0.371), so the three literals are the same three values. */',
        },
        { kind: 'decl', property: '--sv-bg', value: { ref: 'neutral-950' } },
        { kind: 'decl', property: '--sv-bg-raised', value: { ref: 'neutral-900' } },
        { kind: 'decl', property: '--sv-bg-overlay', value: { ref: 'neutral-900' } },
        { kind: 'decl', property: '--sv-bg-subtle', value: { ref: 'neutral-800' } },
        { kind: 'decl', property: '--sv-bg-inset', value: '#2b2b2b' },
        { kind: 'blank' },
        { kind: 'decl', property: '--sv-border', value: '#333333' },
        { kind: 'decl', property: '--sv-border-strong', value: { ref: 'neutral-700' } },
        { kind: 'decl', property: '--sv-border-inverse', value: { ref: 'neutral-50' } },
        { kind: 'blank' },
        { kind: 'decl', property: '--sv-fg', value: { ref: 'neutral-50' } },
        { kind: 'decl', property: '--sv-fg-muted', value: { ref: 'neutral-400' } },
        { kind: 'decl', property: '--sv-fg-subtle', value: { ref: 'neutral-500' } },
        { kind: 'decl', property: '--sv-fg-disabled', value: '#5c5c5c' },
        { kind: 'decl', property: '--sv-fg-inverse', value: { ref: 'neutral-950' } },
        { kind: 'blank' },
        { kind: 'decl', property: '--sv-primary', value: { ref: 'neutral-50' } },
        { kind: 'decl', property: '--sv-primary-hover', value: { ref: 'neutral-200' } },
        { kind: 'decl', property: '--sv-primary-active', value: '#ffffff' },
        { kind: 'decl', property: '--sv-primary-fg', value: { ref: 'neutral-950' } },
        { kind: 'decl', property: '--sv-primary-subtle', value: { ref: 'neutral-800' } },
        { kind: 'decl', property: '--sv-primary-subtle-fg', value: { ref: 'neutral-50' } },
        { kind: 'blank' },
        { kind: 'decl', property: '--sv-focus-ring', value: { ref: 'neutral-50' } },
        { kind: 'blank' },
        {
          kind: 'decl',
          property: '--sv-success-bg',
          value: { ref: 'success-950' },
          islandFallback: 'oklch(0.925 0 0)',
        },
        { kind: 'decl', property: '--sv-success-border', value: { ref: 'neutral-700' } },
        {
          kind: 'decl',
          property: '--sv-success-fg',
          value: { ref: 'neutral-300' },
          islandFallback: 'oklch(0.45 0 0)',
        },
        {
          kind: 'decl',
          property: '--sv-success-solid',
          value: { ref: 'success-500' },
          islandFallback: 'oklch(0.45 0 0)',
        },
        { kind: 'decl', property: '--sv-success-solid-fg', value: { ref: 'neutral-950' } },
        { kind: 'blank' },
        { kind: 'decl', property: '--sv-warning-bg', value: { ref: 'warning-950' } },
        { kind: 'decl', property: '--sv-warning-border', value: { ref: 'neutral-700' } },
        {
          kind: 'decl',
          property: '--sv-warning-fg',
          value: { ref: 'neutral-300' },
          islandFallback: 'oklch(0.45 0 0)',
        },
        {
          kind: 'decl',
          property: '--sv-warning-solid',
          value: { ref: 'warning-500' },
          islandFallback: 'oklch(0.72 0 0)',
        },
        {
          kind: 'decl',
          property: '--sv-warning-solid-fg',
          value: { ref: 'warning-950' },
          islandFallback: 'oklch(0.27 0 0)',
        },
        { kind: 'blank' },
        { kind: 'decl', property: '--sv-error-bg', value: { ref: 'error-950' } },
        { kind: 'decl', property: '--sv-error-border', value: '#991b1b' },
        { kind: 'decl', property: '--sv-error-fg', value: '#fca5a5' },
        { kind: 'decl', property: '--sv-error-solid', value: { ref: 'error-500' } },
        {
          kind: 'decl',
          property: '--sv-error-solid-fg',
          value: { ref: 'neutral-50' },
          islandFallback: 'oklch(0.985 0.003 75)',
        },
        { kind: 'blank' },
        {
          kind: 'decl',
          property: '--sv-info-bg',
          value: { ref: 'info-950' },
          islandFallback: 'oklch(0.925 0 0)',
        },
        { kind: 'decl', property: '--sv-info-border', value: { ref: 'neutral-700' } },
        {
          kind: 'decl',
          property: '--sv-info-fg',
          value: { ref: 'neutral-300' },
          islandFallback: 'oklch(0.45 0 0)',
        },
        {
          kind: 'decl',
          property: '--sv-info-solid',
          value: { ref: 'info-500' },
          islandFallback: 'oklch(0.45 0 0)',
        },
        { kind: 'decl', property: '--sv-info-solid-fg', value: { ref: 'neutral-50' } },
      ],
    },
    scales: {
      fontFamilies: NEUTRAL_FLOOR_FONT_FAMILIES,
      fontSizes: FONT_SIZES,
      fontSizeLeadings: FONT_SIZE_LEADINGS,
      fontWeights: FONT_WEIGHTS,
      lineHeights: NEUTRAL_FLOOR_LINE_HEIGHTS,
      radii: DEFAULT_RADII,
      shadows: DEFAULT_SHADOWS,
    },
  },
  legacyAliases: LEGACY_ALIASES,
  inherited: INHERITED,
} as const satisfies DefaultDesignSource
