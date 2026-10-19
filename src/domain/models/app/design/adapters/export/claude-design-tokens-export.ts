/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { escapeCssValue } from '@/domain/kernel/sanitize/css-value-escaping'
import { SOVRIUM_EXTENSION_KEY } from '@/domain/models/api/admin/design-system/design-system'
import {
  colorAsCssLiteral,
  dimensionAsCss,
  fontFamilyStack,
  type DesignTokenModes,
} from './adapter-export-values'
import type {
  ClaudeDesignColorToken,
  ClaudeDesignTokens,
} from '@/domain/models/api/admin/design-system/adapter-claude-design-tokens'
import type { DesignSystemDocument } from '@/domain/models/api/admin/design-system/design-system'

/**
 * The `project/tokens.json` of the Claude Design adapter (contract 0.2.47).
 *
 * The artifact reads a LIST per family, never a DTCG name-to-value map, and
 * shows each token's `usage` as the rule beside its swatch. So:
 *
 * - light and dark are two THEMES of one colour list, light first (the theme a
 *   plain-string value belongs to), each colour carrying one value per theme;
 * - every token carries a non-empty `usage`: the colour role's own prose when
 *   the design system declares one, else a sentence naming what the token is
 *   for;
 * - spacing and radius are named by family and step (`space-4`, `radius-md`),
 *   in the unit the bundle tokens carry;
 * - every value is a literal. The artifact drops a `var()`, a `color-mix()` or
 *   a `url()` silently, so a shadow carrying one is left out rather than
 *   written and lost.
 *
 * The artifact has no motion family, so durations and easings are not here.
 */

/** What the shadcn colour roles are for, when the design system says nothing about them. */
const ROLE_USAGE: Readonly<Record<string, string>> = {
  background: 'Page background.',
  foreground: 'Default text and icons on the page background.',
  card: 'Surface of cards and panels.',
  popover: 'Surface of popovers, menus and dropdowns.',
  primary: 'Primary actions and the brand accent.',
  secondary: 'Secondary actions and quieter fills.',
  muted: 'Muted surfaces: disabled fills, table stripes, placeholders.',
  'muted-foreground': 'Secondary text: hints, captions and placeholders.',
  accent: 'Hover and selected surfaces in lists and menus.',
  destructive: 'Destructive actions and error states.',
  border: 'Borders and dividers.',
  input: 'Borders of form controls.',
  ring: 'Focus rings.',
  sidebar: 'Surface of the sidebar.',
}

/** The usage of a colour without declared prose. */
const colorUsage = (name: string): string => {
  const known = ROLE_USAGE[name]
  if (known !== undefined) return known
  if (name.endsWith('-foreground')) {
    return `Text and icons on ${name.slice(0, -'-foreground'.length)}.`
  }
  const chart = /^chart-(\d+)$/.exec(name)
  if (chart !== null) return `Chart series ${chart[1]}.`
  if (name.startsWith('sidebar-')) return `The sidebar's ${name.slice('sidebar-'.length)} colour.`
  return `The ${name} colour of the palette.`
}

/**
 * A name the artifact accepts (`^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$`): any other
 * character becomes `-`, so a step such as `1/2` is kept as `1-2` rather than
 * dropped by the reader.
 */
const tokenName = (raw: string): string =>
  raw
    .replace(/[^A-Za-z0-9_.-]/g, '-')
    .replace(/^[^A-Za-z0-9]+/, '')
    .slice(0, 64)

/** Prose the bundle token carries, or `undefined` when it carries none. */
const declaredUsage = (description: string | undefined): string | undefined =>
  description !== undefined && description.trim().length > 0 ? description.trim() : undefined

/** One colour list over both themes, in the light document's order, dark-only names after. */
const colorTokens = (modes: DesignTokenModes): readonly ClaudeDesignColorToken[] => {
  const names = [
    ...Object.keys(modes.light.color),
    ...Object.keys(modes.dark.color).filter((name) => !(name in modes.light.color)),
  ]
  return names.map((name) => {
    const light = modes.light.color[name]
    const dark = modes.dark.color[name]
    return {
      name: tokenName(name),
      value: {
        ...(light === undefined ? {} : { light: colorAsCssLiteral(light.$value) }),
        ...(dark === undefined ? {} : { dark: colorAsCssLiteral(dark.$value) }),
      },
      usage:
        declaredUsage(light?.$description) ?? declaredUsage(dark?.$description) ?? colorUsage(name),
    }
  })
}

/** A length family, each token named `<prefix>-<step>`. */
const lengthTokens = (
  group: DesignSystemDocument['spacing'],
  prefix: string,
  usage: (step: string) => string
): readonly { readonly name: string; readonly value: string; readonly usage: string }[] =>
  Object.entries(group).map(([step, token]) => ({
    name: tokenName(`${prefix}-${step}`),
    value: dimensionAsCss(token.$value),
    usage: declaredUsage(token.$description) ?? usage(step),
  }))

const radiusUsage = (step: string): string => {
  if (step === 'none') return 'Square corners.'
  if (step === 'full') return 'Pills and circular elements.'
  return `Corner radius ${step}.`
}

/** A box-shadow the artifact can read: no reference to resolve. */
const isLiteralShadow = (value: string): boolean => !/(?:var|color-mix|url)\(/i.test(value)

/** One font file the project ships under `fonts/`, with the face it declares. */
export interface ClaudeDesignFontFile {
  /** The bare family name, e.g. `Geist Variable`. */
  readonly family: string
  /** The file's path in the project, `fonts/<file>`: the spelling the type's own example uses. */
  readonly file: string
  readonly weight?: string
  readonly style?: 'normal' | 'italic' | 'oblique'
}

/**
 * The `type` family: the font files, one stack per family key, and the type
 * scale as one group. A font is listed only when a family stack names it, so
 * the artifact writes an `@font-face` for each file a style can reach.
 */
const typeFamily = (
  document: DesignSystemDocument,
  fontFiles: readonly ClaudeDesignFontFile[]
): NonNullable<ClaudeDesignTokens['type']> => {
  const families = Object.fromEntries(
    Object.entries(document.font).map(([key, token]) => [key, fontFamilyStack(token.$value)])
  )
  const familyKeys = Object.keys(families)
  const familyOf = (value: string | readonly string[] | undefined): string => {
    const stack = value === undefined ? undefined : fontFamilyStack(value)
    return (
      familyKeys.find((key) => families[key] === stack) ??
      (familyKeys.includes('sans') ? 'sans' : (familyKeys[0] ?? 'sans'))
    )
  }
  const steps = Object.entries(document.typography)
  const stacks = Object.values(families)
  return {
    fonts: fontFiles
      .filter((font) => stacks.some((stack) => stack.includes(font.family)))
      .map((font) => ({
        family: font.family,
        file: font.file,
        ...(font.weight === undefined ? {} : { weight: font.weight }),
        ...(font.style === undefined ? {} : { style: font.style }),
      })),
    families,
    groups:
      steps.length === 0
        ? []
        : [
            {
              name: 'Text',
              family: familyOf(steps[0]?.[1].$value.fontFamily),
              styles: steps.map(([name, token]) => ({
                name: tokenName(name),
                fontSize: dimensionAsCss(token.$value.fontSize),
                ...(token.$value.lineHeight === undefined
                  ? {}
                  : { lineHeight: token.$value.lineHeight }),
                ...(token.$value.fontWeight === undefined
                  ? {}
                  : { fontWeight: token.$value.fontWeight }),
                ...(token.$value.letterSpacing === undefined
                  ? {}
                  : { letterSpacing: dimensionAsCss(token.$value.letterSpacing) }),
                ...(token.$value.fontFamily === undefined
                  ? {}
                  : { family: familyOf(token.$value.fontFamily) }),
                usage: declaredUsage(token.$description) ?? `The ${name} text style.`,
              })),
            },
          ],
  }
}

/** The `shadow` family, from the elevation ramp the bundle tokens carry. */
const shadowTokens = (
  document: DesignSystemDocument
): readonly { readonly name: string; readonly value: string; readonly usage: string }[] =>
  Object.entries(document.$extensions[SOVRIUM_EXTENSION_KEY].shadows ?? {})
    .filter(([, shadow]) => isLiteralShadow(shadow.value))
    .map(([step, shadow]) => ({
      name: tokenName(`shadow-${step}`),
      value: escapeCssValue(shadow.value),
      usage: `Elevation ${step}.`,
    }))

/** The tokens document of the Claude Design project, before serialisation. */
export const claudeDesignTokens = (
  appName: string,
  modes: DesignTokenModes,
  fontFiles: readonly ClaudeDesignFontFile[] = []
): ClaudeDesignTokens => {
  const shadows = shadowTokens(modes.light)
  return {
    name: appName,
    version: 1,
    color: {
      themes: [
        { id: 'light', name: 'Light' },
        { id: 'dark', name: 'Dark' },
      ],
      tokens: colorTokens(modes),
    },
    type: typeFamily(modes.light, fontFiles),
    spacing: {
      tokens: lengthTokens(
        modes.light.spacing,
        'space',
        (step) => `Spacing step ${step}: gaps and padding.`
      ),
    },
    radius: { tokens: lengthTokens(modes.light.radius, 'radius', radiusUsage) },
    ...(shadows.length === 0 ? {} : { shadow: { tokens: shadows } }),
  }
}
