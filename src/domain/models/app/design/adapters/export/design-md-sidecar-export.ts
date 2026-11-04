/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { mapStringsDeep } from '@/domain/kernel/config-parsing/map-strings-deep'
import { SOVRIUM_EXTENSION_KEY } from '@/domain/models/api/admin/design-system/design-system'
import { buildDesignSystem } from '@/domain/models/app/design/design-system-service'
import { formatColorValue } from '@/domain/models/app/design/token-value-dtcg-service'
import {
  colorAsCssLiteral,
  dimensionAsCss,
  fontFamilyStack,
  jsonFileContent,
} from './adapter-export-values'
import {
  colorGroupOf,
  DESIGN_MD_DONTS,
  DESIGN_MD_DOS,
  DESIGN_MD_OVERVIEW_OPENER,
} from './design-md-body-export'
import {
  designMdTypeRoles,
  fontFamilyList,
  type DesignMdExportInput,
} from './design-md-values-export'
import type { DesignMdSidecar } from '@/domain/models/api/admin/design-system/adapter-design-md-sidecar'
import type { App } from '@/domain/models/app'

/**
 * The sidecar of a DESIGN.md, `.impeccable/design.json` (contract:
 * `adapter-design-md-sidecar.ts`): what the front matter cannot hold, keyed by
 * the front matter's own token names.
 *
 * Written AFTER the DESIGN.md it extends, so a reader comparing the two files'
 * modification times never takes it for stale; its `generatedAt` is the Unix
 * epoch, so two exports of one config are the same bytes.
 */

/** What the sidecar adds to a DESIGN.md's input: the colour keys the config declares. */
export interface DesignMdSidecarInput extends DesignMdExportInput {
  /** The keys of `design.colors`; a colour among them is `declared`, any other `inherited`. */
  readonly declaredColors?: readonly string[]
}

/**
 * The facts of the config a DESIGN.md and its sidecar read beyond the token
 * documents: the app's description and the colour keys it declares.
 */
export const designMdAppFacts = (
  app: Pick<App, 'description' | 'design'>
): Pick<DesignMdSidecarInput, 'description' | 'declaredColors'> => ({
  ...(app.description === undefined ? {} : { description: app.description }),
  declaredColors: Object.keys(app.design?.colors ?? {}),
})

/**
 * Everything a DESIGN.md and its sidecar are rendered from, with every string
 * passed through `translate`.
 *
 * An app may write its text as `$t:` translation keys (the operator console
 * writes its component guidance that way), and a DESIGN.md that names
 * `$t:admin.ds.tpl.shell.usage` tells a design agent nothing. The caller hands
 * in the translator into the app's default language; a string that is not a
 * key comes back unchanged, and a key no language defines comes back as the key.
 */
export const designMdInputOf = (
  app: App,
  translate: (text: string) => string
): DesignMdSidecarInput =>
  mapStringsDeep(
    {
      appName: app.name,
      light: buildDesignSystem(app, 'light'),
      dark: buildDesignSystem(app, 'dark'),
      ...designMdAppFacts(app),
    },
    translate
  ) as DesignMdSidecarInput

/** The instant every sidecar names, so reruns match byte for byte. */
const NO_DATE = '1970-01-01T00:00:00Z'

/** The role each palette group gives its colours in `colorMeta`. */
const ROLE_OF_GROUP: Readonly<Record<string, string>> = {
  Primary: 'primary',
  Secondary: 'secondary',
  Tertiary: 'tertiary',
  Neutral: 'neutral',
  Status: 'status',
}

type ColorMeta = DesignMdSidecar['extensions']['colorMeta']

/** Each light colour's metadata: role, dark value, and who chose it. */
const colorMetaOf = (input: DesignMdSidecarInput): ColorMeta =>
  Object.fromEntries(
    Object.keys(input.light.color).map((name) => {
      const role = ROLE_OF_GROUP[colorGroupOf(name)]
      const dark = input.dark.color[name]
      const declared = input.declaredColors?.includes(name)
      return [
        name,
        {
          ...(role === undefined ? {} : { role }),
          ...(dark === undefined ? {} : { dark: formatColorValue(dark.$value) }),
          ...(declared === undefined
            ? {}
            : declared
              ? { provenance: 'declared' as const, source: `design.colors.${name}` }
              : { provenance: 'inherited' as const }),
        },
      ]
    })
  )

type TypographyMeta = DesignMdSidecar['extensions']['typographyMeta']

/**
 * The rung each role was read from, and the faces, which no role carries. A
 * face is keyed by its own name (`sans`, `mono`), or as its utility
 * `font-<name>` where a role already has the name (`title`, `body`).
 */
const typographyMetaOf = (input: DesignMdSidecarInput): TypographyMeta => {
  const roles = designMdTypeRoles(input.light)
  const taken = new Set(roles.map((role) => role.role))
  return {
    ...Object.fromEntries(roles.map((role) => [role.role, { rung: role.rung }])),
    ...Object.fromEntries(
      Object.entries(input.light.font).map(([name, token]) => [
        taken.has(name) ? `font-${name}` : name,
        {
          fontFamily: fontFamilyList(token.$value),
          purpose: FACE_PURPOSE[name] ?? FACE_PURPOSE_OTHER,
        },
      ])
    ),
  }
}

/** What each face of `design.typeScale.families` sets. */
const FACE_PURPOSE: Readonly<Record<string, string>> = {
  sans: 'The default sans, which the `font-sans` utility names.',
  body: 'Running text.',
  title: 'Headings, and any rung that names it.',
  mono: 'Code, keys and figures set in monospace.',
}

/** What a face under any other key sets. */
const FACE_PURPOSE_OTHER = 'The rungs that name it, and its own `font-<key>` utility.'

/** The durations and easing curves, as CSS values. */
const motionOf = (input: DesignMdSidecarInput) => [
  ...Object.entries(input.light.duration).map(([name, token]) => ({
    name: `duration-${name}`,
    value: `${token.$value.value}${token.$value.unit}`,
  })),
  ...Object.entries(input.light.easing ?? {}).map(([name, token]) => ({
    name: `ease-${name}`,
    value: `cubic-bezier(${token.$value.join(', ')})`,
  })),
]

/** A theme variable with its light value as the fallback, so a snippet renders on its own. */
const themeVar = (input: DesignMdSidecarInput, name: string): string => {
  const token = input.light.color[name]
  return token === undefined
    ? `var(--${name})`
    : `var(--${name}, ${colorAsCssLiteral(token.$value)})`
}

/** A radius variable with its value as the fallback. */
const radiusVar = (input: DesignMdSidecarInput, step: string): string => {
  const token = input.light.radius[step]
  return token === undefined
    ? `var(--radius-${step})`
    : `var(--radius-${step}, ${dimensionAsCss(token.$value)})`
}

/** The running-text face as a `font-family` value. */
const fontOf = (input: DesignMdSidecarInput): string => {
  const token = input.light.font['body'] ?? input.light.font['sans']
  return token === undefined
    ? 'var(--font-sans)'
    : `var(--font-sans, ${fontFamilyStack(token.$value)})`
}

/** The focus ring every interactive snippet shares. */
const focusRule = (input: DesignMdSidecarInput, selector: string): string =>
  `${selector}:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in oklch, ${themeVar(input, 'ring')} 50%, transparent); }`

/** A button snippet in one variant. */
const buttonSnippet = (
  input: DesignMdSidecarInput,
  variant: {
    readonly key: string
    readonly name: string
    readonly fill: string
    readonly ink: string
  }
) => {
  const selector = `.ds-button-${variant.key}`
  return {
    name: variant.name,
    kind: 'button' as const,
    refersTo: `button-${variant.key}`,
    html: `<button class="ds-button-${variant.key}">Save changes</button>`,
    css: [
      `${selector} { display: inline-flex; align-items: center; height: 2rem; padding: 0 0.625rem; border: 1px solid transparent; border-radius: ${radiusVar(input, 'lg')}; background: ${variant.fill}; color: ${variant.ink}; font: 500 0.875rem/1.25rem ${fontOf(input)}; cursor: pointer; transition: background 0.15s; }`,
      `${selector}:hover { background: color-mix(in oklch, ${variant.fill} 80%, transparent); }`,
      focusRule(input, selector),
    ].join(' '),
  }
}

/** The component snippets: the front matter's components, each drawable on its own. */
const componentsOf = (input: DesignMdSidecarInput): DesignMdSidecar['components'] => [
  buttonSnippet(input, {
    key: 'primary',
    name: 'Primary Button',
    fill: themeVar(input, 'primary'),
    ink: themeVar(input, 'primary-foreground'),
  }),
  buttonSnippet(input, {
    key: 'secondary',
    name: 'Secondary Button',
    fill: themeVar(input, 'secondary'),
    ink: themeVar(input, 'secondary-foreground'),
  }),
  {
    name: 'Text Input',
    kind: 'input',
    refersTo: 'input',
    html: '<input class="ds-input" placeholder="Search projects" />',
    css: [
      `.ds-input { height: 2rem; padding: 0.25rem 0.625rem; border: 1px solid ${themeVar(input, 'input')}; border-radius: ${radiusVar(input, 'lg')}; background: transparent; color: ${themeVar(input, 'foreground')}; font: 400 0.875rem/1.25rem ${fontOf(input)}; }`,
      `.ds-input:hover { border-color: ${themeVar(input, 'ring')}; }`,
      `.ds-input:focus-visible { outline: none; border-color: ${themeVar(input, 'ring')}; box-shadow: 0 0 0 3px color-mix(in oklch, ${themeVar(input, 'ring')} 50%, transparent); }`,
    ].join(' '),
  },
  {
    name: 'Card',
    kind: 'card',
    refersTo: 'card',
    html: '<div class="ds-card" tabindex="0"><p class="ds-card-title">Quarterly report</p><p class="ds-card-description">Updated two days ago.</p></div>',
    css: [
      `.ds-card { padding: 1rem; border-radius: ${radiusVar(input, 'xl')}; background: ${themeVar(input, 'card')}; color: ${themeVar(input, 'card-foreground')}; box-shadow: 0 0 0 1px color-mix(in oklch, ${themeVar(input, 'foreground')} 10%, transparent); font-family: ${fontOf(input)}; }`,
      '.ds-card-title { margin: 0; font-size: 1rem; font-weight: 500; }',
      `.ds-card-description { margin: 0.25rem 0 0; font-size: 0.875rem; color: ${themeVar(input, 'muted-foreground')}; }`,
      `.ds-card:hover { background: ${themeVar(input, 'muted')}; }`,
      focusRule(input, '.ds-card'),
    ].join(' '),
  },
  {
    name: 'Badge',
    kind: 'chip',
    refersTo: 'badge',
    html: '<span class="ds-badge" tabindex="0">New</span>',
    css: [
      `.ds-badge { display: inline-flex; align-items: center; height: 1.25rem; padding: 0.125rem 0.5rem; border-radius: ${radiusVar(input, '4xl')}; background: ${themeVar(input, 'primary')}; color: ${themeVar(input, 'primary-foreground')}; font: 500 0.75rem/1rem ${fontOf(input)}; }`,
      `.ds-badge:hover { background: color-mix(in oklch, ${themeVar(input, 'primary')} 80%, transparent); }`,
      focusRule(input, '.ds-badge'),
    ].join(' '),
  },
]

/** The sidecar of an app's DESIGN.md, as the JSON text written beside it. */
export const renderDesignSidecar = (input: DesignMdSidecarInput): string => {
  const extension = input.light.$extensions[SOVRIUM_EXTENSION_KEY]
  const ladder = Object.keys(input.light.typography)
  const sidecar: DesignMdSidecar = {
    schemaVersion: 2,
    generatedAt: NO_DATE,
    title: `Design System: ${input.appName}`,
    extensions: {
      colorMeta: colorMetaOf(input),
      typographyMeta: typographyMetaOf(input),
      shadows: Object.entries(extension.shadows ?? {}).map(([name, shadow]) => ({
        name,
        value: shadow.value,
      })),
      motion: motionOf(input),
      breakpoints: Object.entries(input.light.breakpoint).map(([name, token]) => ({
        name,
        value: dimensionAsCss(token.$value),
      })),
      ...(ladder.length === 0 ? {} : { typeLadder: ladder }),
    },
    components: componentsOf(input),
    narrative: {
      overview: DESIGN_MD_OVERVIEW_OPENER,
      dos: DESIGN_MD_DOS,
      donts: DESIGN_MD_DONTS,
    },
  }
  return jsonFileContent(sidecar)
}
