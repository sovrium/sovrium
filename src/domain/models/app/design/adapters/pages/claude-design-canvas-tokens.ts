/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { PaintTokens } from '@/domain/models/app/pages/page-merge-paint-service'

/**
 * The Claude Design page adapter, token half: the canvas's own
 * `ds/<app>/tokens.json` (`claude-design-tokens-export.ts` writes it, the
 * canvas Theme menu edits it) read back as the colour and type tokens a page
 * drawing is painted with.
 *
 * The page import reads it twice. An unedited export's says which token a
 * colour or a text size drawn on a board is; the canvas's own says, with
 * `--tokens`, which colour the Theme menu changed. A document that is not one
 * reads as no token at all, never as a guess.
 */

/** Where an installed design system's token file sits in a canvas project. */
export const CANVAS_TOKENS_FILE = /^(?:.*\/)?ds\/[^/]+\/tokens\.json$/

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Each colour token's value in each theme, by token name then theme. */
export type CanvasColourThemes = Readonly<Record<string, Readonly<Record<string, string>>>>

/** The colour tokens of a token document, each value per theme. */
export const canvasColoursOf = (document: unknown): CanvasColourThemes => {
  const tokens = isRecord(document) && isRecord(document['color']) ? document['color'] : {}
  const list = Array.isArray(tokens['tokens']) ? (tokens['tokens'] as readonly unknown[]) : []
  return Object.fromEntries(
    list.flatMap((token) => {
      if (!isRecord(token) || typeof token['name'] !== 'string') return []
      const { value } = token
      const themes = isRecord(value)
        ? Object.fromEntries(
            Object.entries(value).flatMap(([theme, colour]) =>
              typeof colour === 'string' ? [[theme, colour] as const] : []
            )
          )
        : typeof value === 'string'
          ? { light: value }
          : {}
      return [[token['name'], themes] as const]
    })
  )
}

/** The type steps of a token document, each step's font size by its name. */
const typeSizesOf = (document: unknown): Readonly<Record<string, string>> => {
  const type = isRecord(document) && isRecord(document['type']) ? document['type'] : {}
  const groups = Array.isArray(type['groups']) ? (type['groups'] as readonly unknown[]) : []
  return Object.fromEntries(
    groups.flatMap((group) =>
      isRecord(group) && Array.isArray(group['styles'])
        ? (group['styles'] as readonly unknown[]).flatMap((style) =>
            isRecord(style) &&
            typeof style['name'] === 'string' &&
            typeof style['fontSize'] === 'string'
              ? [[style['name'], style['fontSize']] as const]
              : []
          )
        : []
    )
  )
}

/**
 * The tokens a drawn paint is read against: each colour in the light theme the
 * boards are drawn in, and each type step's size.
 *
 * @param document - the canvas token document, parsed.
 */
export const paintTokensOf = (document: unknown): PaintTokens => ({
  colors: Object.fromEntries(
    Object.entries(canvasColoursOf(document)).flatMap(([name, themes]) =>
      themes['light'] === undefined ? [] : [[name, themes['light']] as const]
    )
  ),
  typeSizes: typeSizesOf(document),
})

/** One colour token a canvas's Theme menu changed, in one theme. */
export interface CanvasTokenChange {
  readonly token: string
  readonly theme: string
  readonly before: string
  readonly after: string
}

/**
 * Every colour a canvas's token file holds that an unedited export's does not:
 * a changed value, by token and theme. A token or a theme the canvas added is
 * a change from nothing, which no config value can be `before`; it is left out.
 *
 * @param drawn - the canvas's token document.
 * @param unedited - an unedited export's token document.
 */
export const canvasTokenChanges = (
  drawn: unknown,
  unedited: unknown
): readonly CanvasTokenChange[] => {
  const before = canvasColoursOf(unedited)
  return Object.entries(canvasColoursOf(drawn)).flatMap(([token, themes]) =>
    Object.entries(themes).flatMap(([theme, after]) => {
      const was = before[token]?.[theme]
      return was === undefined || was === after ? [] : [{ token, theme, before: was, after }]
    })
  )
}

/** The `design` key a theme's colour is declared under: `colors`, or the dark `darkColors`. */
export const designColourKeyOf = (theme: string): 'colors' | 'darkColors' | undefined =>
  theme === 'light' ? 'colors' : theme === 'dark' ? 'darkColors' : undefined
