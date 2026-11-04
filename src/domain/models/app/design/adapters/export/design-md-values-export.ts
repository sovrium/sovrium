/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { formatColorValue } from '@/domain/models/app/design/token-value-dtcg-service'
import { dimensionAsCss, type DesignTokenModes } from './adapter-export-values'
import type { DesignSystemDocument } from '@/domain/models/api/admin/design-system/design-system'

/**
 * The token values a DESIGN.md is made of, read from the two token documents.
 *
 * Shared by the DESIGN.md itself (`design-md-export.ts`) and its sidecar
 * (`design-md-sidecar-export.ts`), so the sidecar keys its metadata by the very
 * names the front matter writes and never repeats a value in another notation.
 */

/** What a DESIGN.md is drawn from: the two token documents, the app name and description. */
export interface DesignMdExportInput extends DesignTokenModes {
  /** The app name, which names the design system. */
  readonly appName: string
  /** The app description; the front matter says what the system is when absent. */
  readonly description?: string
}

/** One text role of the front matter, as the format spells its properties. */
export interface DesignMdTypeValue {
  readonly fontFamily?: string
  readonly fontSize?: string
  readonly fontWeight?: number
  readonly lineHeight?: number
  readonly letterSpacing?: string
}

/** A text role and the Sovrium rung it was read from, if any. */
export interface DesignMdTypeRole {
  readonly role: string
  readonly rung: string
  readonly value: DesignMdTypeValue
}

/**
 * The rungs the format has a role for under another name. `display` and
 * `body` keep their names; every other rung keeps its own.
 */
const ROLE_OF_RUNG: Readonly<Record<string, string>> = {
  h1: 'headline',
  h2: 'title',
  caption: 'label',
}

/** A font-family value as a plain CSS list: `Geist Variable, sans-serif`. */
export const fontFamilyList = (value: string | readonly string[]): string =>
  (typeof value === 'string' ? value.split(',') : value)
    .map((family) => family.trim().replace(/^["']|["']$/g, ''))
    .filter((family) => family.length > 0)
    .join(', ')

/** The face the app paints running text with: `font.body`, else `font.sans`. */
export const runningTextFace = (document: DesignSystemDocument): string | undefined => {
  const token = document.font['body'] ?? document.font['sans']
  return token === undefined ? undefined : fontFamilyList(token.$value)
}

/** The monospace face, when the app has one. */
export const monospaceFace = (document: DesignSystemDocument): string | undefined => {
  const token = document.font['mono']
  return token === undefined ? undefined : fontFamilyList(token.$value)
}

type TypographyValue = DesignSystemDocument['typography'][string]['$value']

/** One rung's measures in the format's notation; a face only when the rung declares its own. */
const typeValueOf = (value: TypographyValue): DesignMdTypeValue => ({
  ...(value.fontFamily === undefined ? {} : { fontFamily: fontFamilyList(value.fontFamily) }),
  fontSize: dimensionAsCss(value.fontSize),
  ...(value.fontWeight === undefined ? {} : { fontWeight: value.fontWeight }),
  ...(value.lineHeight === undefined ? {} : { lineHeight: value.lineHeight }),
  ...(value.letterSpacing === undefined
    ? {}
    : { letterSpacing: dimensionAsCss(value.letterSpacing) }),
})

/**
 * The text roles of the front matter, in ladder order: each rung the config
 * declares, under the format's role name, and nothing else. A role names a
 * face only when its rung declares one; the faces themselves are described in
 * the sidecar. Nothing the platform chose is passed off as the app's own, so a
 * DESIGN.md read back into a config changes nothing.
 */
export const designMdTypeRoles = (document: DesignSystemDocument): readonly DesignMdTypeRole[] =>
  Object.entries(document.typography).map(([rung, token]) => ({
    role: ROLE_OF_RUNG[rung] ?? rung,
    rung,
    value: typeValueOf(token.$value),
  }))

/** Every colour the app paints in light, by token name, in the token document's notation. */
export const designMdColors = (document: DesignSystemDocument): Readonly<Record<string, string>> =>
  Object.fromEntries(
    Object.entries(document.color).map(([name, token]) => [name, formatColorValue(token.$value)])
  )

/** A dimension group (radius, spacing) as CSS lengths keyed by step. */
export const designMdLengths = (
  group: DesignSystemDocument['radius']
): Readonly<Record<string, string>> =>
  Object.fromEntries(
    Object.entries(group).map(([step, token]) => [step, dimensionAsCss(token.$value)])
  )

/** One front-matter component: a format property and its value, literal or `{group.token}`. */
export type DesignMdComponentValue = Readonly<Record<string, string>>

/**
 * The shadcn/ui components the front matter draws, from base-nova's anatomy:
 * each names the tokens its variant paints with, and a literal only where
 * base-nova fixes a size no token carries.
 */
const DESIGN_MD_COMPONENTS: readonly (readonly [string, DesignMdComponentValue])[] = [
  [
    'button-primary',
    {
      backgroundColor: '{colors.primary}',
      textColor: '{colors.primary-foreground}',
      rounded: '{rounded.lg}',
      padding: '0 0.625rem',
      height: '2rem',
    },
  ],
  [
    'button-secondary',
    {
      backgroundColor: '{colors.secondary}',
      textColor: '{colors.secondary-foreground}',
      rounded: '{rounded.lg}',
      padding: '0 0.625rem',
      height: '2rem',
    },
  ],
  [
    'button-outline',
    {
      backgroundColor: '{colors.background}',
      textColor: '{colors.foreground}',
      rounded: '{rounded.lg}',
      padding: '0 0.625rem',
      height: '2rem',
    },
  ],
  [
    'button-destructive',
    { textColor: '{colors.destructive}', rounded: '{rounded.lg}', padding: '0 0.625rem' },
  ],
  [
    'input',
    {
      textColor: '{colors.foreground}',
      rounded: '{rounded.lg}',
      padding: '0.25rem 0.625rem',
      height: '2rem',
    },
  ],
  [
    'card',
    {
      backgroundColor: '{colors.card}',
      textColor: '{colors.card-foreground}',
      rounded: '{rounded.xl}',
      padding: '1rem',
    },
  ],
  [
    'badge',
    {
      backgroundColor: '{colors.primary}',
      textColor: '{colors.primary-foreground}',
      rounded: '{rounded.4xl}',
      height: '1.25rem',
    },
  ],
  [
    'popover',
    {
      backgroundColor: '{colors.popover}',
      textColor: '{colors.popover-foreground}',
      rounded: '{rounded.lg}',
    },
  ],
]

/** The token groups a `{group.token}` reference may name, as the front matter writes them. */
export interface DesignMdTokenGroups {
  readonly colors: Readonly<Record<string, unknown>>
  readonly typography: Readonly<Record<string, unknown>>
  readonly rounded: Readonly<Record<string, unknown>>
  readonly spacing: Readonly<Record<string, unknown>>
}

/** Whether a value is a literal, or a reference to a token the front matter declares. */
const resolves = (value: string, groups: DesignMdTokenGroups): boolean => {
  const reference = /^\{([a-z]+)\.([^{}]+)\}$/.exec(value)
  if (reference === null) return true
  const group = groups[reference[1] as keyof DesignMdTokenGroups] as
    Readonly<Record<string, unknown>> | undefined
  return group?.[reference[2] ?? ''] !== undefined
}

/**
 * The front-matter components, each property kept only when the token it
 * names is declared, so a reader never meets a dangling reference.
 */
export const designMdComponents = (
  groups: DesignMdTokenGroups
): readonly (readonly [string, DesignMdComponentValue])[] =>
  DESIGN_MD_COMPONENTS.map(
    ([name, properties]) =>
      [
        name,
        Object.fromEntries(
          Object.entries(properties).filter(([, value]) => resolves(value, groups))
        ),
      ] as const
  ).filter(([, properties]) => Object.keys(properties).length > 0)

/** The token groups of a light document, as the front matter writes them. */
export const designMdTokenGroups = (input: DesignMdExportInput): DesignMdTokenGroups => ({
  colors: designMdColors(input.light),
  typography: Object.fromEntries(
    designMdTypeRoles(input.light).map((role) => [role.role, role.value])
  ),
  rounded: designMdLengths(input.light.radius),
  spacing: designMdLengths(input.light.spacing),
})
