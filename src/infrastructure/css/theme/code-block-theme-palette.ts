/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { contrastRatio } from '@/domain/kernel/color/option-chip-color'
import { logWarning } from '@/infrastructure/logging/logger'
import type { Design } from '@/domain/models/app/design'

/** A named dark theme whose palette could not be read: Shiki does not bundle it, or loading it failed. */
class CodeBlockPaletteUnavailable extends Data.TaggedError('CodeBlockPaletteUnavailable')<{
  readonly theme: string
  readonly cause: unknown
}> {}

/** A Shiki theme module's default export, reduced to the colours it declares. */
interface ShikiThemeColours {
  readonly colors?: Readonly<Record<string, string>>
  readonly tokenColors?: ReadonlyArray<{ readonly settings?: { readonly foreground?: string } }>
}

/** `#abc123` → `ABC123`, the form the highlighter writes in a `tok-dark-` class. */
const classHex = (value: string): string | undefined => {
  const match = /^#([0-9a-fA-F]{3,8})$/.exec(value.trim())
  return match?.[1]?.toUpperCase()
}

/** Every distinct foreground a theme can paint a token with, as class hexes. */
const paletteOf = (theme: ShikiThemeColours): readonly string[] => {
  const declared = [
    theme.colors?.['editor.foreground'],
    ...(theme.tokenColors ?? []).map((entry) => entry.settings?.foreground),
  ]
  return [
    ...new Set(
      declared
        .filter((value): value is string => typeof value === 'string')
        .map(classHex)
        .filter((hex): hex is string => hex !== undefined)
    ),
  ]
}

/**
 * The palette of the dark code-block theme an app names
 * (`design.codeBlock.darkTheme`), read from the theme Shiki itself highlights
 * with — so the stylesheet carries a colour rule for every token colour that
 * theme can put on a `tok-dark-` class, whichever theme it is.
 *
 * Empty when no dark theme is named. A theme Shiki does not bundle, or one that
 * fails to load, also answers empty: the code block then keeps the curated
 * rules and the chrome's own ink — legible, if monochrome — and the reason is
 * logged rather than failing the whole stylesheet over one code-block palette.
 */
export const loadCodeBlockDarkPalette = (
  design: Readonly<Design> | undefined
): Effect.Effect<readonly string[]> => {
  const name = design?.codeBlock?.darkTheme
  if (name === undefined || name === '') return Effect.succeed([])
  return Effect.tryPromise({
    try: async () => {
      const { bundledThemes } = await import('shiki')
      if (!Object.hasOwn(bundledThemes, name)) return []
      const theme = await bundledThemes[name as keyof typeof bundledThemes]()
      return paletteOf(theme.default as ShikiThemeColours)
    },
    catch: (cause) => new CodeBlockPaletteUnavailable({ theme: name, cause }),
  }).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() =>
        logWarning(`[CSS] could not read the palette of code-block dark theme "${name}"`, {
          cause: String(cause),
        })
      )
    ),
    // effect-swallow: logged above; a missing palette leaves the block legible in the chrome's ink, which is no reason to fail the stylesheet.
    Effect.orElseSucceed(() => [])
  )
}

/** The WCAG floor a token colour is held to against the chrome it is painted on. */
const CONTRAST_FLOOR = 4.5

/** One channel of a `#RRGGBB` colour, read at offset `at`. */
const hexChannel = (hex: string, at: number): number => Number.parseInt(hex.slice(at, at + 2), 16)

/** Blend two `#RRGGBB` colours, `weight` of the way from `from` to `to`. */
const blendHex = (from: string, to: string, weight: number): string => {
  const channel = hexChannel
  const mixed = [1, 3, 5].map((at) =>
    Math.round(channel(from, at) + (channel(to, at) - channel(from, at)) * weight)
      .toString(16)
      .padStart(2, '0')
  )
  return `#${mixed.join('')}`.toUpperCase()
}

/**
 * A theme colour as it is painted on the chrome: unchanged when it already
 * reaches the 4.5:1 floor, otherwise moved toward the chrome's own ink until it
 * does — the nearest tone of the same hue, the rule `THEME_CONTRAST_FLOORS`
 * spells out by hand for the curated themes. A colour that is not `#RRGGBB`
 * (an alpha hex) is painted as the theme wrote it.
 */
export const raisedToFloor = (color: string, ground: string, ink: string): string => {
  if (contrastRatio(color, ground) === undefined) return color
  const steps = Array.from({ length: 21 }, (_, step) => blendHex(color, ink, step / 20))
  return steps.find((tone) => (contrastRatio(tone, ground) ?? 0) >= CONTRAST_FLOOR) ?? ink
}

/**
 * A theme's own palette as `[hex, colour]` pairs to paint `tok-dark-` classes
 * with: the colours the curated list does not already cover, each raised to
 * the floor against the block's `background` toward its `foreground`.
 */
export const flooredPalette = (
  palette: readonly string[],
  curated: Readonly<Record<string, string>>,
  chrome: { readonly background: string; readonly foreground: string }
): ReadonlyArray<readonly [string, string]> =>
  palette
    .filter((hex) => !(hex in curated))
    .map((hex) => [hex, raisedToFloor(`#${hex}`, chrome.background, chrome.foreground)] as const)
