/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The colour half of the theme CSS: the `@theme` colours, the shadcn and
 * `--sv-*` variables an authored colour repaints, the dark overrides and the
 * sidebar roles that follow their base roles.
 *
 * Split out of `theme-generators.ts`, which keeps the fonts, spacing,
 * shadows, radius, breakpoints, type scale and motion.
 */

import { escapeCssValue } from '@/domain/kernel/sanitize/css-value-escaping'
import {
  COLOR_TO_SV_TOKEN,
  DESIGN_COLOR_VARS,
} from '@/domain/models/app/design/default-design.generated'
import { derivedForegrounds } from '@/domain/models/app/design/foreground-ink-service'
import { derivedPrimaryInteraction } from '@/domain/models/app/design/primary-interaction-service'
import type { DesignColors, DesignDarkColors } from '@/domain/models/app/design/colors'

/**
 * The variable declarations an authored colour writes, beside its `--color-*`
 * utility registration: the shadcn/ui variable it repaints
 * (`DESIGN_COLOR_VARS`: `primary` → `--primary`, `background-raised` →
 * `--card`), and — for a Sovrium extension role base-nova does not declare
 * (`primary-hover`, `success`, …) — its `--sv-*` token (`COLOR_TO_SV_TOKEN`).
 * Both maps are generated from the default design source, so they cannot drift.
 *
 * Writing the role directly, rather than through a `var(--color-X, …)` rung in
 * the default layer, is what avoids the `--color-X ↔ --X` cycle that once left
 * `bg-primary` transparent; the block lands AFTER the default layer, so the
 * authored value wins by source order at equal specificity.
 */
export const authorVarLines = (name: string, value: string, indent: string): readonly string[] => {
  const shadcn = DESIGN_COLOR_VARS[name]
  const sv = COLOR_TO_SV_TOKEN[name]
  return [
    ...(shadcn === undefined ? [] : [`${indent}--${shadcn}: ${escapeCssValue(value)};`]),
    ...(sv === undefined ? [] : [`${indent}--sv-${sv}: ${escapeCssValue(value)};`]),
  ]
}

/**
 * The selector the platform's own dark cascade uses, and the default for
 * {@link generateDarkColorOverrides}.
 *
 * The `html` type prefix is load-bearing — see that function's own note.
 */
export const DEFAULT_DARK_SELECTOR = "html:is(.dark, [data-theme='dark'])"

/**
 * Tailwind `@theme` colours from `design.colors`, plus each undeclared
 * `-foreground` companion — the readable ink `derivedForegrounds` picks, which
 * {@link generateAuthorSvBridge} writes to the shadcn variable too.
 */
export function generateThemeColors(colors?: DesignColors): string {
  if (!colors || Object.keys(colors).length === 0) return ''

  const colorEntries = Object.entries(colors).map(([name, value]) => {
    return `    --color-${name}: ${escapeCssValue(String(value))};`
  })

  const derivedInks = Object.entries(derivedForegrounds(colors)).map(
    ([name, ink]) => `    --color-${name}: ${escapeCssValue(ink)};`
  )

  // Also ensure 'foreground' (the base text color) exists when 'background' is defined
  const baseForeground =
    colors['background'] && !colors['foreground'] ? ['    --color-foreground: #09090b;'] : []

  return [...colorEntries, ...derivedInks, ...baseForeground].join('\n')
}

/**
 * Generate a `:root` block of the variable declarations each authored colour
 * writes (see {@link authorVarLines}): the shadcn variable it repaints, and the
 * `--sv-*` extension token for a role shadcn does not declare.
 *
 * Emitted in a separate `:root` block (NOT inside `@theme static`) because
 * neither is a Tailwind theme token — they are the role variables the
 * registrations and the prestyled islands read. Going through `:root` keeps
 * the engine from misinterpreting them as utility-minting tokens.
 *
 * The cascade contract: this `:root` block is concatenated AFTER
 * `ROLE_TOKEN_BRIDGE` in `compiler.ts`, so a tenant `--primary: #c45d3f`
 * declaration beats the default layer's `--primary` by ordinary cascade order
 * (same specificity, later wins). The `--color-X: value` declarations stay in `@theme static` so existing
 * `bg-X` / `text-X` utilities continue to resolve through the registration
 * chain — the two channels stay independent and each picks up the tenant
 * override directly.
 *
 * @param colors - the authored `design.colors`.
 * @param selector - where the block lands. `:root` for the app's own
 *   stylesheet; a scope selector when the design system is drawn as a SUBTREE
 *   of a document themed by someone else (the design-system console — see
 *   `scoped-theme-layer.ts`). Parameterised rather than duplicated so the
 *   author-override semantics cannot drift between the two.
 */
export function generateAuthorSvBridge(colors?: DesignColors, selector = ':root'): string {
  if (!colors || Object.keys(colors).length === 0) return ''

  const svBridgeEntries = Object.entries(colors).flatMap(([name, value]) =>
    authorVarLines(name, String(value), '    ')
  )

  // Derived companion: the `border-strong` extension role (a darker step of `border`,
  // consumed by the scroll-area thumb via `--sv-border-strong`) is not a
  // standalone author key, so an author `design.colors.border` override would
  // otherwise leave the thumb stuck on the zero-config neutral fallback. Mirror
  // the authored `border` onto `--sv-border-strong` so the custom-scrollbar
  // chrome shifts with the rest of the author surface intent. The default theme
  // layer still supplies the darker neutral step when `border` is unset.
  const derivedBorderStrong =
    colors['border'] && !colors['border-strong']
      ? [`    --sv-border-strong: ${escapeCssValue(String(colors['border']))};`]
      : []

  // NOTE: `--chart-1` is deliberately NOT derived from the authored primary.
  // The series is five hues held at one lightness and one chroma, which is the
  // only reason they read as peers rather than as a ranking; substituting an
  // arbitrary brand colour into slot 1 pulls one series off that plane and the
  // other four stop looking like the same set. The anchor existed when slot 1
  // was a Tailwind blue unrelated to anything, where borrowing the app's
  // primary was better than nothing; it is not better than a designed set.
  //
  // Not derived does NOT mean not authorable. All five `chart-N` keys are in
  // DESIGN_COLOR_VARS, so `design.colors['chart-1']` reaches `--chart-1`
  // through the same block as every other role, and the charts read exactly
  // that var (see islands/chart/chart-config.ts). An author who wants a
  // brand hue in the series names it; what this block declines to do is guess
  // one on their behalf from `primary`.
  // Derived companions: the hover and pressed shades of a declared `primary`
  // (`primary-interaction-service.ts`). Without them a brand primary hovers to
  // the platform's near-black, a colour from no palette the author chose.
  const derivedInteraction = Object.entries(derivedPrimaryInteraction(colors)).flatMap(
    ([name, value]) => authorVarLines(name, value, '    ')
  )
  // The same ink the utility channel derived, on the shadcn variable too.
  const derivedInks = Object.entries(derivedForegrounds(colors)).flatMap(([name, ink]) =>
    authorVarLines(name, ink, '    ')
  )
  const allEntries = [
    ...svBridgeEntries,
    ...derivedBorderStrong,
    ...derivedInteraction,
    ...derivedInks,
  ]
  if (allEntries.length === 0) return ''

  return `${selector} {\n${allEntries.join('\n')}\n  }`
}

/**
 * Generate the dark-scheme override block for `design.darkColors`.
 *
 * `design.colors` feeds TWO independent channels (see {@link generateThemeColors}
 * and {@link generateAuthorSvBridge}), so a dark palette has to re-point both or
 * the two disagree at runtime: the `bg-X` utility would keep its light value
 * while a reader of the role variable follows the platform's dark ramp. One
 * block therefore emits `--color-*` (utility channel) AND the role variables
 * (the shadcn variable, or the `--sv-*` extension token) for every authored
 * dark key.
 *
 * ## Selector
 *
 * `html:is(.dark, [data-theme='dark'])` — the same form the platform's own dark
 * cascade uses, and NOT a bare `.dark`. Two things depend on the `html` prefix:
 *
 * - Specificity (0,1,1) beats every `:root` block (0,1,0). `--color-*` values
 *   land in `:root` via `@theme static`, and Tailwind emits further `:root`
 *   blocks AFTER this one, so a (0,1,0) selector here would be masked by
 *   source order and the override would silently do nothing.
 * - It ties with `V1_ROOT_DARK` (also (0,1,1)), which re-points every role
 *   variable. This block is concatenated AFTER the default theme layer in
 *   `buildSourceCSS`, so the authored value wins on "later wins" cascade order.
 *
 * ## Deliberately NOT mirrored from the light path
 *
 * {@link generateThemeColors} derives a `#ffffff` companion for semantic colors
 * missing a `-foreground`, and a `#09090b` `foreground` when `background` is set
 * alone. Neither is mirrored here: both derive a value for the LIGHT surface, and
 * re-deriving them under the dark selector would either be a no-op (`#ffffff`) or
 * actively wrong (near-black body text on a dark page). A token left out of
 * `darkColors` keeps its light value — the documented way to express a
 * mode-invariant brand colour.
 *
 * A key present in `darkColors` but absent from `colors` still emits here, but
 * mints no utility: `bg-X`/`text-X` only exist when `--color-X` is registered by
 * the `@theme` block, which only `colors` writes. `darkColors` overrides the
 * palette; it does not extend it.
 *
 * @param darkColors - the authored `design.darkColors`.
 * @param selector - where the block lands, defaulting to the platform's own
 *   dark cascade selector. A SCOPED design system passes its own dark arm
 *   instead: keying a scope off `html.dark` would tie the specimen's scheme to
 *   the console's, and those are two independent axes once the preview renders
 *   inside the console's own document.
 */
export function generateDarkColorOverrides(
  darkColors?: DesignDarkColors,
  selector = DEFAULT_DARK_SELECTOR
): string {
  if (!darkColors || Object.keys(darkColors).length === 0) return ''

  const colorEntries = Object.entries(darkColors).map(
    ([name, value]) => `    --color-${name}: ${escapeCssValue(String(value))};`
  )

  const svBridgeEntries = Object.entries(darkColors).flatMap(([name, value]) =>
    authorVarLines(name, String(value), '    ')
  )

  // Mirrors the light bridge's `border-strong` companion so an authored dark
  // `border` also shifts the scroll-area thumb instead of leaving it on the
  // platform's dark neutral step.
  const derivedBorderStrong =
    darkColors['border'] && !darkColors['border-strong']
      ? [`    --sv-border-strong: ${escapeCssValue(String(darkColors['border']))};`]
      : []

  // No chart anchor here either — see the light bridge for why slot 1 is not
  // derived from the authored primary. A `darkColors['chart-N']` an author DOES
  // declare still crosses, on the same bridge as every other role.
  const allEntries = [...colorEntries, ...svBridgeEntries, ...derivedBorderStrong]

  return `${selector} {\n${allEntries.join('\n')}\n  }`
}

/** The sidebar roles that follow an app role, unless the app declares the sidebar's. */
const SIDEBAR_FOLLOWS: ReadonlyArray<readonly [sidebar: string, role: string]> = [
  ['sidebar-primary', 'primary'],
  ['sidebar-primary-foreground', 'primary-foreground'],
  ['sidebar-ring', 'ring'],
]

/**
 * The sidebar's primary, its foreground and its ring follow the app's own, in
 * both schemes — always, whether or not the app declares them.
 *
 * base-nova ships the sidebar its own values for all three — a near-black
 * primary and a grey ring in light, a stock blue primary in dark — so the
 * sidebar's brand tile and active marks were drawn in the registry's colours
 * beside an app's own primary, and in dark even an app declaring nothing got
 * a blue sidebar beside a neutral primary everywhere else. Each follower is a
 * REFERENCE (`--sidebar-primary: var(--primary)`) written in the root block
 * and again in the dark block, so it resolves against whichever primary that
 * scheme holds: declared, or the default layer's own. A sidebar role the app
 * declares itself is left alone.
 *
 * This is a deliberate departure from the registry snapshot, recorded in
 * `default-theme-layer.ts`: the generated layer keeps base-nova's values, and
 * this block, emitted after it, re-points the three roles.
 *
 * @returns The root block and the dark block, or `''` when the app declares
 *   all three sidebar roles itself.
 */
export function generateSidebarRoleFollowers(
  colors: DesignColors | undefined,
  darkColors: DesignDarkColors | undefined,
  selectors: { readonly root?: string; readonly dark?: string } = {}
): string {
  const declared = (name: string): boolean =>
    colors?.[name] !== undefined || darkColors?.[name] !== undefined
  const lines = SIDEBAR_FOLLOWS.filter(([sidebar]) => !declared(sidebar)).map(
    ([sidebar, role]) => `    --${sidebar}: var(--${role});`
  )
  if (lines.length === 0) return ''
  const body = lines.join('\n')
  return [
    `${selectors.root ?? ':root'} {\n${body}\n  }`,
    `${selectors.dark ?? DEFAULT_DARK_SELECTOR} {\n${body}\n  }`,
  ].join('\n\n')
}
