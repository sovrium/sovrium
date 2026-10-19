/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  colorAsCssLiteral,
  colorAsHexWithAlpha,
  dimensionInPx,
  firstFontFamily,
  jsonFileContent,
  type AdapterFile,
  type DesignTokenModes,
} from './adapter-export-values'
import type { TokensStudioSingleFile } from '@/domain/models/api/admin/design-system/adapter-tokens-studio'
import type { DesignSystemDocument } from '@/domain/models/api/admin/design-system/design-system'

/**
 * The Tokens Studio adapter: the bundle tokens as one single-file Tokens
 * Studio document, the format its Figma plugin syncs and Penpot imports.
 *
 * Modes are THEMES choosing SETS there, not documents: one `global` set holds
 * what does not change with the mode (radii, spacing, breakpoints, families),
 * a `light` and a `dark` set hold the colours, and a theme per mode enables
 * `global` plus its own set. `$metadata.tokenSetOrder` names every set, so
 * neither tool applies one at an undefined position.
 *
 * Tokens are in the W3C DTCG `$value`/`$type` form with Tokens Studio's own
 * type names. Lengths are px numbers written as strings, the plugin's own
 * unitless px; a colour is its hex, or its colour function when it has no
 * sRGB form.
 */

/** Where the adapter writes, inside the bundle. */
const TOKENS_STUDIO_FILE = 'adapters/tokens-studio/tokens.json'

interface TokensStudioToken {
  readonly $value: string
  readonly $type: string
  readonly $description?: string
}

type TokenSet = Readonly<Record<string, Readonly<Record<string, TokensStudioToken>>>>

/** One Tokens Studio token, with the bundle token's description when it has one. */
const token = (value: string, type: string, description: string | undefined): TokensStudioToken =>
  description === undefined
    ? { $value: value, $type: type }
    : { $value: value, $type: type, $description: description }

/** A colour set, flat: `primary`, `primary-foreground` … */
const colorSet = (
  color: DesignSystemDocument['color']
): Readonly<Record<string, TokensStudioToken>> =>
  Object.fromEntries(
    Object.entries(color).map(([name, entry]) => [
      name,
      token(
        colorAsHexWithAlpha(entry.$value) ?? colorAsCssLiteral(entry.$value),
        'color',
        entry.$description
      ),
    ])
  )

/** A dimension group as unitless px strings under one Tokens Studio type. */
const dimensionGroup = (
  group: DesignSystemDocument['spacing'],
  type: string
): Readonly<Record<string, TokensStudioToken>> =>
  Object.fromEntries(
    Object.entries(group).map(([name, entry]) => [
      name,
      token(String(dimensionInPx(entry.$value)), type, entry.$description),
    ])
  )

/** What does not change with the mode. Empty groups are left out. */
const globalSet = (document: DesignSystemDocument): TokenSet =>
  Object.fromEntries(
    Object.entries({
      radius: dimensionGroup(document.radius, 'borderRadius'),
      spacing: dimensionGroup(document.spacing, 'spacing'),
      breakpoint: dimensionGroup(document.breakpoint, 'sizing'),
      font: Object.fromEntries(
        Object.entries(document.font).map(([name, entry]) => [
          name,
          token(firstFontFamily(entry.$value), 'fontFamilies', entry.$description),
        ])
      ),
    }).filter(([, group]) => Object.keys(group).length > 0)
  )

/** The two themes, one per mode, each enabling the global set and its own. */
const THEMES: TokensStudioSingleFile['$themes'] = [
  {
    id: 'sovrium-light',
    name: 'Light',
    group: 'Mode',
    selectedTokenSets: { global: 'enabled', light: 'enabled' },
  },
  {
    id: 'sovrium-dark',
    name: 'Dark',
    group: 'Mode',
    selectedTokenSets: { global: 'enabled', dark: 'enabled' },
  },
]

/**
 * The Tokens Studio subtree: `adapters/tokens-studio/tokens.json`.
 */
export const exportTokensStudio = (modes: DesignTokenModes): readonly AdapterFile[] => [
  {
    path: TOKENS_STUDIO_FILE,
    content: jsonFileContent({
      global: globalSet(modes.light),
      light: colorSet(modes.light.color),
      dark: colorSet(modes.dark.color),
      $themes: THEMES,
      $metadata: { tokenSetOrder: ['global', 'light', 'dark'] },
    }),
  },
]
