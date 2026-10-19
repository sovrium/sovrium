/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { escapeCssValue } from '@/domain/kernel/sanitize/css-value-escaping'
import { isKeptInDark, keptForegroundOf } from '@/domain/models/app/design/dark-palette-service'
import { derivedPrimaryInteraction } from '@/domain/models/app/design/primary-interaction-service'
import { authorVarLines, DEFAULT_DARK_SELECTOR } from './theme-generators'
import type { DesignColors, DesignDarkColors } from '@/domain/models/app/design/colors'

/**
 * The dark-scheme block that keeps, in dark, every brand colour the app
 * declares in `design.colors` and leaves out of `design.darkColors`.
 *
 * The utility channel (`bg-primary`) already keeps its light value — `--color-*`
 * is written once, in `@theme static` — but the platform's dark cascade
 * re-points the shadcn variables (`--primary`, `--accent`, …) at its own dark
 * values, so anything reading the variable directly painted another colour than
 * the utility beside it. This block re-states each kept colour's variables
 * under the dark selector, after that cascade.
 *
 * Pairs stay together: a surface kept in its light colour keeps its LIGHT
 * foreground too, unless the app declares a dark foreground — otherwise a
 * beige accent kept in dark would carry the platform's near-white dark text. A
 * foreground the app never declared keeps the ink the light scheme derived for
 * its surface, as the utility channel does. A kept
 * `primary` keeps its derived hover and pressed shades.
 *
 * @param colors - the authored `design.colors`.
 * @param darkColors - the authored `design.darkColors`.
 * @param selector - the dark selector the block lands under: the platform's own
 *   by default, a scope's dark arm for a scoped design system.
 * @returns the block, or `''` when every declared colour has a dark value.
 */
export function generateDarkKeptColors(
  colors: DesignColors | undefined,
  darkColors: DesignDarkColors | undefined,
  selector = DEFAULT_DARK_SELECTOR
): string {
  const kept = Object.entries(colors ?? {}).filter(([name]) => isKeptInDark(name, darkColors))
  const lines = [
    ...new Set([
      ...kept.flatMap(([name, value]) => authorVarLines(name, String(value), '    ')),
      ...kept.flatMap(([name]) => keptForeground(name, colors, darkColors)),
      ...keptPrimaryInteraction(colors, darkColors),
    ]),
  ]
  return lines.length === 0 ? '' : `${selector} {\n${lines.join('\n')}\n  }`
}

/**
 * The light foreground of a kept surface — the readable ink the light scheme
 * derived for it (`derivedForegrounds`), else the platform's light value —
 * unless the app declares that foreground itself.
 */
function keptForeground(
  name: string,
  colors: DesignColors | undefined,
  darkColors: DesignDarkColors | undefined
): readonly string[] {
  const foreground = keptForegroundOf(name, colors, darkColors)
  return foreground === undefined
    ? []
    : [`    --${foreground.variable}: ${escapeCssValue(String(foreground.value))};`]
}

/** A kept `primary`'s derived hover and pressed shades. */
function keptPrimaryInteraction(
  colors: DesignColors | undefined,
  darkColors: DesignDarkColors | undefined
): readonly string[] {
  if (colors?.['primary'] === undefined || darkColors?.['primary'] !== undefined) return []
  return Object.entries(derivedPrimaryInteraction(colors))
    .filter(([name]) => darkColors?.[name] === undefined)
    .flatMap(([name, value]) => authorVarLines(name, value, '    '))
}
