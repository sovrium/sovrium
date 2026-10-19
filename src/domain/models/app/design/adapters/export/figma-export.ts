/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  colorAsHex,
  dimensionInPx,
  durationInSeconds,
  firstFontFamily,
  hexComponents,
  jsonFileContent,
  type AdapterFile,
  type DesignTokenModes,
} from './adapter-export-values'
import type { FigmaToken } from '@/domain/models/api/admin/design-system/adapter-figma-dtcg'
import type { DesignSystemDocument } from '@/domain/models/api/admin/design-system/design-system'

/**
 * The Figma adapter: the bundle tokens as two files of Figma's native
 * Variables DTCG import, one per colour mode.
 *
 * Figma reads a narrower DTCG than the bundle writes, and every conversion
 * below is one of those narrowings:
 *
 * - a dimension in px only, so `rem` is converted at a 16px base;
 * - a duration in seconds, so `150ms` becomes `0.15s`;
 * - ONE font family per token, so a stack keeps its first family;
 * - a colour in sRGB (or HSL), so an Oklch colour is converted, with its hex.
 *
 * Typography composites and easing curves have no Figma variable type and are
 * left out. The two files hold the SAME token paths with the SAME types:
 * Figma creates a variable only for a token present in every mode file, so a
 * path one mode lacks is dropped from both rather than left without a value.
 */

/** Where the adapter writes, inside the bundle. */
const FIGMA_DIR = 'adapters/figma'

type FigmaGroup = Readonly<Record<string, FigmaToken>>

/** `$description` copied when the bundle token carries one. */
const describedBy = (description: string | undefined): { readonly $description?: string } =>
  description === undefined ? {} : { $description: description }

/** The colour group, or only the colours that have an sRGB form. */
const colorGroup = (color: DesignSystemDocument['color']): FigmaGroup =>
  Object.fromEntries(
    Object.entries(color).flatMap(([name, token]) => {
      const hex = colorAsHex(token.$value)
      if (hex === undefined) return []
      const figmaToken: FigmaToken = {
        $type: 'color',
        $value: {
          colorSpace: 'srgb',
          components:
            token.$value.colorSpace === 'srgb' && token.$value.components.length === 3
              ? [
                  token.$value.components[0] ?? 0,
                  token.$value.components[1] ?? 0,
                  token.$value.components[2] ?? 0,
                ]
              : hexComponents(hex),
          alpha: token.$value.alpha ?? 1,
          hex,
        },
        ...describedBy(token.$description),
      }
      return [[name, figmaToken]]
    })
  )

/** A dimension group in px. */
const dimensionGroup = (group: DesignSystemDocument['spacing']): FigmaGroup =>
  Object.fromEntries(
    Object.entries(group).map(([name, token]) => [
      name,
      {
        $type: 'dimension',
        $value: { value: dimensionInPx(token.$value), unit: 'px' },
        ...describedBy(token.$description),
      } satisfies FigmaToken,
    ])
  )

/** The font families, one name each. */
const fontGroup = (font: DesignSystemDocument['font']): FigmaGroup =>
  Object.fromEntries(
    Object.entries(font).map(([name, token]) => [
      name,
      {
        $type: 'fontFamily',
        $value: firstFontFamily(token.$value),
        ...describedBy(token.$description),
      } satisfies FigmaToken,
    ])
  )

/** The durations, in seconds. */
const durationGroup = (duration: DesignSystemDocument['duration']): FigmaGroup =>
  Object.fromEntries(
    Object.entries(duration).map(([name, token]) => [
      name,
      {
        $type: 'duration',
        $value: { value: durationInSeconds(token.$value), unit: 's' },
        ...describedBy(token.$description),
      } satisfies FigmaToken,
    ])
  )

/** One mode's document, before the two modes are reconciled. */
const modeDocument = (document: DesignSystemDocument): Readonly<Record<string, FigmaGroup>> => ({
  color: colorGroup(document.color),
  radius: dimensionGroup(document.radius),
  spacing: dimensionGroup(document.spacing),
  breakpoint: dimensionGroup(document.breakpoint),
  font: fontGroup(document.font),
  duration: durationGroup(document.duration),
})

/** `document` with only the tokens `other` also holds under the same type, empty groups dropped. */
const sharedWith = (
  document: Readonly<Record<string, FigmaGroup>>,
  other: Readonly<Record<string, FigmaGroup>>
): Readonly<Record<string, FigmaGroup>> =>
  Object.fromEntries(
    Object.entries(document)
      .map(([group, tokens]): readonly [string, FigmaGroup] => [
        group,
        Object.fromEntries(
          Object.entries(tokens).filter(
            ([name, token]) => other[group]?.[name]?.$type === token.$type
          )
        ),
      ])
      .filter(([, tokens]) => Object.keys(tokens).length > 0)
  )

/**
 * The Figma subtree: `adapters/figma/light.tokens.json` and
 * `adapters/figma/dark.tokens.json`, in that order.
 */
export const exportFigma = (modes: DesignTokenModes): readonly AdapterFile[] => {
  const light = modeDocument(modes.light)
  const dark = modeDocument(modes.dark)
  return [
    { path: `${FIGMA_DIR}/light.tokens.json`, content: jsonFileContent(sharedWith(light, dark)) },
    { path: `${FIGMA_DIR}/dark.tokens.json`, content: jsonFileContent(sharedWith(dark, light)) },
  ]
}
