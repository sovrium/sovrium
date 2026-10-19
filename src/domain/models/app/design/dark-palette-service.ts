/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What an app paints in its DARK scheme, colour by colour.
 *
 * Three consumers read this one rule, and they must not disagree: the
 * stylesheet generator, which writes the dark block the browser applies
 * (`dark-kept-colors.ts`), the design-system export, which describes that dark
 * palette as a token document, and the console's Foundations page, which prints
 * each swatch's dark value and who chose it. A reader re-deriving the cascade on
 * its own would eventually describe a theme the app does not paint.
 *
 * The cascade, per colour, in order:
 *
 *  1. a `design.darkColors` value — the operator said what dark paints;
 *  2. a BRAND colour declared in `design.colors` and left out of
 *     `design.darkColors` keeps its light value ({@link isKeptInDark}); a
 *     neutral one does not, because a light ground kept on a dark page draws
 *     dark text on dark;
 *  3. the text drawn on a kept brand surface keeps its LIGHT value too, unless
 *     the app declares it ({@link keptForegroundOf}): the readable ink the
 *     light scheme derived for that surface (`derivedForegrounds`), else the
 *     platform's light foreground;
 *  4. otherwise the platform's dark default for the role;
 *  5. a colour with no platform dark default — an extension key such as
 *     `signature` — keeps its light value, since nothing re-points it.
 */

import {
  DEFAULT_SHADCN_DARK_VALUES,
  DEFAULT_SHADCN_LIGHT_VALUES,
  DESIGN_COLOR_VARS,
} from './default-design.generated'
import { derivedForegrounds } from './foreground-ink-service'

/** An authored palette, light or dark: colour name to CSS colour. */
type Palette = Readonly<Record<string, string>>

/**
 * The brand roles a declared colour keeps in dark, each with the variable of
 * the text drawn on it (`undefined` for a role nothing is written on). The
 * neutral roles — the page and card grounds, the body and muted text, the
 * border and the input — are left to the platform's dark cascade when the app
 * gives them no dark value.
 */
export const DARK_KEPT_BRAND_FOREGROUNDS: Readonly<Record<string, string | undefined>> = {
  primary: 'primary-foreground',
  secondary: 'secondary-foreground',
  accent: 'accent-foreground',
  'sidebar-primary': 'sidebar-primary-foreground',
  'sidebar-accent': 'sidebar-accent-foreground',
  ring: undefined,
  'sidebar-ring': undefined,
  'chart-1': undefined,
  'chart-2': undefined,
  'chart-3': undefined,
  'chart-4': undefined,
  'chart-5': undefined,
}

/** The shadcn variable an authored key repaints, or the key itself. */
export const darkVariableOf = (name: string): string => DESIGN_COLOR_VARS[name] ?? name

/** Whether any key of `palette` repaints the shadcn variable `variable`. */
const repaints = (palette: Palette | undefined, variable: string): boolean =>
  Object.keys(palette ?? {}).some((key) => darkVariableOf(key) === variable)

/**
 * Whether a declared colour with no dark value is kept in dark: a brand role,
 * or the text drawn on one whose surface is kept too — a foreground follows its
 * surface, so a primary given a dark value takes the platform's dark text.
 */
export const isKeptInDark = (name: string, darkColors: Palette | undefined): boolean => {
  if (darkColors?.[name] !== undefined) return false
  const variable = darkVariableOf(name)
  if (variable in DARK_KEPT_BRAND_FOREGROUNDS) return true
  const surface = Object.keys(DARK_KEPT_BRAND_FOREGROUNDS).find(
    (role) => DARK_KEPT_BRAND_FOREGROUNDS[role] === variable
  )
  return surface !== undefined && !repaints(darkColors, surface)
}

/**
 * The text variable of a kept surface and the LIGHT value it keeps — the ink
 * the light scheme derived for the surface (`derivedForegrounds`), else the
 * platform's light foreground — or `undefined` when the surface carries no text
 * or the app declares that text.
 */
export const keptForegroundOf = (
  name: string,
  colors: Palette | undefined,
  darkColors: Palette | undefined
): { readonly variable: string; readonly value: string } | undefined => {
  const variable = DARK_KEPT_BRAND_FOREGROUNDS[darkVariableOf(name)]
  if (variable === undefined) return undefined
  const value = derivedForegrounds(colors)[variable] ?? DEFAULT_SHADCN_LIGHT_VALUES[variable]
  if (value === undefined || repaints(colors, variable) || repaints(darkColors, variable))
    return undefined
  return { variable, value }
}

/** An authored palette re-keyed by the variable each entry repaints (last key wins). */
const byVariable = (palette: Palette | undefined): Palette =>
  Object.fromEntries(
    Object.entries(palette ?? {}).map(([key, value]) => [darkVariableOf(key), value] as const)
  )

/**
 * Who chose the colour a name paints in dark:
 *
 * - `declared` — a `design.darkColors` value (step 1);
 * - `light` — the app's own light value, kept: a light-only brand colour
 *   (step 2) or a colour nothing re-points (step 5);
 * - `platform` — a value the platform supplies: the light text of a kept brand
 *   surface, derived for it or the platform's own (step 3), or the role's dark
 *   default (step 4).
 */
export type DarkPaintSource = 'declared' | 'light' | 'platform'

/** What one name paints in dark, and who chose it. */
export interface DarkPaint {
  readonly value: string
  readonly source: DarkPaintSource
}

/**
 * The colour each published name paints in dark, with who chose it — the
 * cascade of the module header, entry by entry.
 *
 * @param inherited - the platform's colour roles, as the LIGHT palette lists
 *   them: the names the dark palette must answer for even when the app declares
 *   nothing.
 * @param colors - the authored `design.colors`.
 * @param darkColors - the authored `design.darkColors`.
 * @returns the dark paint of each name, keyed by the variable it repaints.
 */
export const resolveDarkPaints = (
  inherited: readonly string[],
  colors: Palette | undefined,
  darkColors: Palette | undefined
): Readonly<Record<string, DarkPaint>> => {
  const light = byVariable(colors)
  const declaredDark = byVariable(darkColors)
  const keptEntries = Object.entries(colors ?? {}).filter(([name]) =>
    isKeptInDark(name, darkColors)
  )
  const kept = byVariable(Object.fromEntries(keptEntries))
  const keptForegrounds = Object.fromEntries(
    keptEntries.flatMap(([name]) => {
      const foreground = keptForegroundOf(name, colors, darkColors)
      return foreground === undefined ? [] : [[foreground.variable, foreground.value] as const]
    })
  )
  const cascade: readonly (readonly [Palette, DarkPaintSource])[] = [
    [declaredDark, 'declared'],
    [kept, 'light'],
    [keptForegrounds, 'platform'],
    [DEFAULT_SHADCN_DARK_VALUES, 'platform'],
    [light, 'light'],
  ]
  const names = [...new Set([...inherited, ...Object.keys(light), ...Object.keys(declaredDark)])]
  return Object.fromEntries(
    names.flatMap((name) => {
      const step = cascade.find(([palette]) => palette[name] !== undefined)
      const value = step?.[0][name]
      return step === undefined || value === undefined
        ? []
        : [[name, { value, source: step[1] }] as const]
    })
  )
}

/**
 * The colour each published name paints in dark, for every name the light
 * palette publishes and every name the dark palette declares — the values of
 * {@link resolveDarkPaints}, without who chose them.
 */
export const resolveDarkPalette = (
  inherited: readonly string[],
  colors: Palette | undefined,
  darkColors: Palette | undefined
): Palette =>
  Object.fromEntries(
    Object.entries(resolveDarkPaints(inherited, colors, darkColors)).map(
      ([name, paint]) => [name, paint.value] as const
    )
  )
