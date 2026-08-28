/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The design system every Sovrium app inherits without declaring anything.
 *
 * ─── WHY THIS EXISTS AT ALL ─────────────────────────────────────────────────
 *
 * An app with no `design` block is the COMMON case, and D2 the
 * shipped default IS "the opinion every downstream Sovrium app inherits" — the
 * v1 token layer is emitted into its CSS whether or not it asked. Exporting an
 * empty document for such an app would report that it has no design system,
 * which is false, and would leave its author with nothing to hand an agent.
 *
 * ─── WHY THE VALUES ARE REPEATED HERE, STATED HONESTLY ──────────────────────
 *
 * These numbers already exist twice: as `--sv-*` declarations in
 * `src/infrastructure/css/theme/default-theme-layer.ts` (the override surface)
 * and as the `TOKENS` catalog in `src/presentation/utils/design/css-var.ts`
 * (the island fallbacks). `[internal ref]` is the unskippable
 * gate holding those two in agreement.
 *
 * This module is a THIRD copy, and that is a real cost rather than a neutral
 * one. Two constraints forced it:
 *
 *  - **Layering.** The export is an application-layer projection. It may not
 *    import `src/presentation/**`, so the `TOKENS` catalog is out of reach; and
 *    the theme layer is CSS TEXT, so reading it would mean parsing stylesheets
 *    at request time to answer a question about the config.
 *  - **Naming.** Neither existing surface is in the vocabulary this export
 *    needs. Both speak `--sv-bg` / `bgRaised`; an author writes `background`
 *    and `background-raised`. Publishing the internal spelling would hand an
 *    agent token names that cannot be written back into `design.theme.colors`.
 *
 * The set is therefore kept DELIBERATELY SMALL — only the role tokens an author
 * can actually override, in the names they would use — rather than mirroring
 * the whole ~100-entry catalog. Values are the LIGHT cascade (`:root`), which
 * is what a single-mode DTCG document can describe.
 *
 * FOLLOW-UP, named rather than assumed: `check-design-tokens.ts` covers two
 * surfaces and should cover three. Extending it belongs with the gate's owner.
 */

/**
 * The v1 colour roles, keyed by the name an author writes in
 * `design.theme.colors` and valued as the light cascade resolves them.
 *
 * Only CANONICAL spellings appear. `COLOR_TO_SV_TOKEN` also accepts aliases
 * that collapse onto the same `--sv-*` slot — `muted` for `background-subtle`,
 * `card` for `background-raised`, `destructive` for `error` — and publishing
 * both spellings of one token would read as two different colours.
 */
export const INHERITED_COLOR_TOKENS: Readonly<Record<string, string>> = {
  background: 'oklch(0.985 0 0)',
  'background-subtle': 'oklch(0.965 0 0)',
  'background-raised': 'oklch(0.995 0 0)',
  'background-overlay': 'oklch(0.995 0 0)',
  foreground: 'oklch(0.14 0 0)',
  'foreground-muted': 'oklch(0.445 0 0)',
  'foreground-subtle': 'oklch(0.54 0 0)',
  'foreground-disabled': 'oklch(0.71 0 0)',
  'foreground-inverse': 'oklch(0.985 0 0)',
  border: 'oklch(0.92 0 0)',
  ring: 'oklch(0.205 0 0)',
  primary: 'oklch(0.205 0 0)',
  'primary-hover': 'oklch(0.272 0 0)',
  'primary-active': 'oklch(0.14 0 0)',
  'primary-foreground': 'oklch(0.985 0 0)',
  'primary-subtle': 'oklch(0.965 0 0)',
  'primary-subtle-foreground': 'oklch(0.205 0 0)',
  success: 'oklch(0.45 0 0)',
  warning: 'oklch(0.72 0 0)',
  error: 'oklch(0.53 0.195 25)',
  info: 'oklch(0.45 0 0)',
}

/** The v1 radius scale. */
export const INHERITED_RADIUS_TOKENS: Readonly<Record<string, string>> = {
  none: '0px',
  sm: '2px',
  base: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  full: '9999px',
}

/** The v1 motion scale. */
export const INHERITED_DURATION_TOKENS: Readonly<Record<string, string>> = {
  instant: '0ms',
  fast: '120ms',
  base: '180ms',
  slow: '260ms',
  deliberate: '340ms',
}

/**
 * The v1 font stacks, as ordered fallback lists.
 *
 * DTCG's `fontFamily` accepts a single name or an ordered stack, and a stack is
 * the honest form here: the first entry is a webfont the platform ships, and
 * everything after it is what a reader actually sees while that font loads.
 */
export const INHERITED_FONT_TOKENS: Readonly<Record<string, readonly string[]>> = {
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
  serif: [
    'Source Serif 4 Variable',
    'Source Serif 4',
    'Source Serif Pro',
    'Georgia',
    'Times New Roman',
    'serif',
  ],
}

/**
 * There is deliberately NO inherited spacing scale.
 *
 * Sovrium's components take spacing from raw Tailwind utilities rather than
 * from `--sv-*` variables, so there is no platform spacing token an author
 * could override — and inventing one here would publish a token that overriding
 * changes nothing about. An app's spacing group is exactly what it declared.
 */
export const INHERITED_SPACING_TOKENS: Readonly<Record<string, string>> = {}

/**
 * The responsive thresholds every app RESPONDS AT, declared or not.
 *
 * Breakpoints are the opposite case to spacing above, and were wrongly grouped
 * with it. `theme.breakpoints` writes `--breakpoint-<name>` into the `@theme`
 * block, which OVERRIDES one entry of Tailwind's default scale and leaves the
 * rest standing — so `md:` and `lg:` fire in an app that declared neither.
 * Reporting only the declared entries told an author what they had WRITTEN
 * rather than what their app SHIPS, and inheritance is precisely the half they
 * cannot learn by re-reading their own config.
 *
 * Values are Tailwind v4's defaults, in the `rem` spelling Tailwind itself uses.
 */
export const INHERITED_BREAKPOINT_TOKENS: Readonly<Record<string, string>> = {
  sm: '40rem',
  md: '48rem',
  lg: '64rem',
  xl: '80rem',
  '2xl': '96rem',
}

/**
 * The `--color-*` custom property a canonical role name resolves through, for
 * the seven names where the registered property is spelled differently from the
 * name an author writes.
 *
 * `bg-<name>` is minted from `--color-<name>`, and for most roles those two
 * spellings agree. They do not for the semantic quartet (an author's `error`
 * drives the `error-solid` SLOT, which is the one a surface actually paints)
 * nor for the two `-foreground` roles and `ring`, which the token layer
 * abbreviates. A specimen that wants to paint what the app paints has to follow
 * the same indirection; every name absent from this map is its own property.
 *
 * This mirrors the subset of `COLOR_TO_SV_TOKEN` whose slot name differs.
 * It cannot import it: that map lives in `src/infrastructure/css`, and the
 * design-system projection is a domain service.
 */
export const ROLE_COLOR_PROPERTY: Readonly<Record<string, string>> = {
  ring: 'focus-ring',
  'primary-foreground': 'primary-fg',
  'primary-subtle-foreground': 'primary-subtle-fg',
  success: 'success-solid',
  warning: 'warning-solid',
  error: 'error-solid',
  info: 'info-solid',
}
