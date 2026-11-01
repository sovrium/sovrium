/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The TEXT files of the portable design-system bundle that are projections of
 * the two token documents: the shadcn theme stylesheet, its Tailwind v4
 * `@theme`, the DTCG resolver that picks a mode, and the `llms.txt` index.
 *
 * Every function here is pure and reads only the documents `buildDesignSystem`
 * produced, so the stylesheet a designer imports and the tokens a tool imports
 * cannot describe two palettes: one builder, several spellings of its answer.
 */

import { codeRolesOf } from './design-system-code-roles-service'
import type { DesignSystemDocument } from '@/domain/models/api/admin/design-system'

/** A DTCG colour `$value`, as the token document carries it. */
interface ColourValue {
  readonly colorSpace: string
  readonly components: ReadonlyArray<number | string>
  readonly alpha?: number
  readonly hex?: string
}

/** A DTCG dimension `$value`. */
interface DimensionValue {
  readonly value: number
  readonly unit: string
}

type TokenGroup = Readonly<Record<string, { readonly $value?: unknown }>>

const groupOf = (document: Readonly<DesignSystemDocument>, name: string): TokenGroup => {
  const groups: Readonly<Record<string, unknown>> = document
  return (groups[name] ?? {}) as TokenGroup
}

/** CSS colour functions for the DTCG colour spaces CSS names differently. */
const CSS_COLOR_SPACES: Readonly<Record<string, string>> = {
  oklch: 'oklch',
  oklab: 'oklab',
  lab: 'lab',
  lch: 'lch',
  hsl: 'hsl',
  hwb: 'hwb',
}

/**
 * One DTCG colour as CSS: the authored hex when the document carries one —
 * which is what keeps a declared `#6b7f5e` raw rather than re-spelt — and the
 * colour function of its space otherwise.
 */
export const cssColorOf = (value: ColourValue): string => {
  const alpha = value.alpha !== undefined && value.alpha < 1 ? ` / ${value.alpha}` : ''
  if (value.hex !== undefined && alpha === '') return value.hex
  const channels = value.components.join(' ')
  const fn = CSS_COLOR_SPACES[value.colorSpace]
  return fn === undefined
    ? `color(${value.colorSpace} ${channels}${alpha})`
    : `${fn}(${channels}${alpha})`
}

/** Every colour token of a document, as `--<name>: <css>` declarations. */
const colourDeclarations = (document: Readonly<DesignSystemDocument>): readonly string[] =>
  Object.entries(groupOf(document, 'color')).flatMap(([name, token]) =>
    typeof token.$value === 'object' && token.$value !== null
      ? [`  --${name}: ${cssColorOf(token.$value as ColourValue)};`]
      : []
  )

/** The base radius shadcn names `--radius`: the document's `lg` step. */
const radiusDeclaration = (document: Readonly<DesignSystemDocument>): readonly string[] => {
  const value = groupOf(document, 'radius')['lg']?.$value as DimensionValue | undefined
  return value === undefined ? [] : [`  --radius: ${value.value}${value.unit};`]
}

/**
 * The family names CSS reads as KEYWORDS: quoting one would turn it into a
 * family of that name, which no system has. `-apple-system` is Safari's
 * system-face keyword and is honoured only unquoted.
 */
const CSS_FONT_KEYWORDS: ReadonlySet<string> = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
  'math',
  'emoji',
  'fangsong',
  '-apple-system',
])

/** One family of a stack as CSS: a keyword bare, any other name double-quoted. */
export const cssFontFamilyOf = (name: string): string => {
  const bare = name.trim().replace(/^(["'])(.*)\1$/, '$2')
  return CSS_FONT_KEYWORDS.has(bare.toLowerCase())
    ? bare
    : `"${bare.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
}

/**
 * Every font token of a document as `--font-<face>: <stack>`, the families in
 * the order the token's `$value` lists them, so a tool importing only the
 * stylesheet sets the app's type.
 */
const fontDeclarations = (document: Readonly<DesignSystemDocument>): readonly string[] =>
  Object.entries(groupOf(document, 'font')).flatMap(([name, token]) =>
    Array.isArray(token.$value) && token.$value.length > 0
      ? [
          `  --font-${name}: ${token.$value.map((family) => cssFontFamilyOf(String(family))).join(', ')};`,
        ]
      : []
  )

/**
 * Every coloured code role of a document as `--code-<role>: var(--<token>);`.
 * Declared in `.dark` as well as `:root`, so a `.dark` set below the root
 * re-resolves the role against the dark value of its token.
 */
const codeRoleDeclarations = (document: Readonly<DesignSystemDocument>): readonly string[] =>
  codeRolesOf(document).map(({ role, token }) => `  --code-${role}: var(--${token});`)

/**
 * One rule per coloured code role painting the spans the highlighter classes
 * `tok-<role>` with the role's variable, set off by blank lines; none when no
 * role is coloured.
 */
const codeRoleRules = (document: Readonly<DesignSystemDocument>): readonly string[] => {
  const rules = codeRolesOf(document).map(
    ({ role }) => `.tok-${role} { color: var(--code-${role}); }`
  )
  return rules.length === 0 ? [] : [...rules, '']
}

/**
 * `css/theme.css`: shadcn's own variables, light under `:root` and dark under
 * `.dark`, carrying the WHOLE palette — the inherited roles as well as the
 * declared ones — and one `--font-<face>` per family the app declares, so a
 * project importing it paints and sets this app without Sovrium. When
 * `design.code.tokens` colours a syntax role, each mode also maps it to its
 * colour token (`--code-<role>`), and a rule paints its `tok-<role>` spans.
 */
export const renderThemeStylesheet = (
  light: Readonly<DesignSystemDocument>,
  dark: Readonly<DesignSystemDocument>,
  appName: string
): string =>
  [
    `/* ${appName}: design-system theme, in shadcn/ui variable names. */`,
    ':root {',
    ...radiusDeclaration(light),
    ...colourDeclarations(light),
    ...fontDeclarations(light),
    ...codeRoleDeclarations(light),
    '}',
    '',
    ...codeRoleRules(light),
    '.dark {',
    ...colourDeclarations(dark),
    ...codeRoleDeclarations(dark),
    '}',
    '',
  ].join('\n')

/** Sovrium's radius steps, as multiples of `--radius` (the runtime's own ladder). */
const RADIUS_STEPS: ReadonlyArray<readonly [string, string]> = [
  ['sm', 'calc(var(--radius) * 0.6)'],
  ['md', 'calc(var(--radius) * 0.8)'],
  ['lg', 'var(--radius)'],
  ['xl', 'calc(var(--radius) * 1.4)'],
]

/**
 * `css/tailwind.css`: a Tailwind v4 entry registering every colour as an
 * `@theme` utility over `theme.css`, so `bg-primary` works in a project that
 * imports it, and `dark:` follows the `.dark` class. A coloured code role is
 * registered too, as `--color-code-<role>`.
 */
export const renderTailwindStylesheet = (light: Readonly<DesignSystemDocument>): string =>
  [
    '@import "tailwindcss";',
    '@import "./theme.css";',
    '',
    '@custom-variant dark (&:is(.dark *));',
    '',
    '@theme inline {',
    ...Object.keys(groupOf(light, 'color')).map((name) => `  --color-${name}: var(--${name});`),
    ...codeRolesOf(light).map(({ role }) => `  --color-code-${role}: var(--code-${role});`),
    ...RADIUS_STEPS.map(([step, value]) => `  --radius-${step}: ${value};`),
    '}',
    '',
  ].join('\n')

/** The DTCG resolver version the resolver document follows. */
const RESOLVER_VERSION = '2025.10'

/**
 * The published JSON Schema of that version, which the module's own examples
 * name in `$schema`. A plain string: nothing reads it at export time.
 */
export const RESOLVER_SCHEMA_URL = 'https://www.designtokens.org/schemas/2025.10/resolver.json'

/**
 * `tokens/sovrium.resolver.json`, in the DTCG 2025.10 resolver form: one base
 * set, and a `mode` modifier whose dark context layers the dark document over
 * the light one.
 */
export const renderResolverDocument = (appName: string): string =>
  `${JSON.stringify(
    {
      $schema: RESOLVER_SCHEMA_URL,
      name: `${appName} design system`,
      version: RESOLVER_VERSION,
      sets: { base: { sources: [{ $ref: 'base.tokens.json' }] } },
      modifiers: {
        mode: {
          description: 'Colour scheme',
          contexts: {
            light: [{ $ref: 'base.tokens.json' }],
            dark: [{ $ref: 'base.tokens.json' }, { $ref: 'dark.tokens.json' }],
          },
          default: 'light',
        },
      },
      resolutionOrder: [{ $ref: '#/sets/base' }, { $ref: '#/modifiers/mode' }],
    },
    undefined,
    2
  )}\n`

/**
 * `llms.txt`: the index an assistant reads first, in the llms.txt shape — a
 * title, a one-line summary, and the files to read in the order to read them.
 */
export const renderLlmsIndex = (appName: string): string =>
  [
    `# ${appName} design system`,
    '',
    `> How ${appName} looks and speaks: its tokens in both colour modes, the stylesheet it paints with, the rules for writing in its voice, and a rendered kit of every component.`,
    '',
    'Read DESIGN.md first. Build against the tokens and the stylesheet; open the component kit to see what each type looks like in light and in dark.',
    '',
    '## Brief',
    '',
    '- [DESIGN.md](DESIGN.md): principles, voice, colour roles and component guidance, written for an agent',
    '',
    '## Tokens',
    '',
    '- [tokens/base.tokens.json](tokens/base.tokens.json): the light design tokens, W3C DTCG 2025.10',
    '- [tokens/dark.tokens.json](tokens/dark.tokens.json): the same tokens with the dark colours',
    '- [tokens/sovrium.resolver.json](tokens/sovrium.resolver.json): the DTCG resolver choosing a mode',
    '',
    '## Stylesheets',
    '',
    '- [css/theme.css](css/theme.css): shadcn/ui variables, `:root` for light and `.dark` for dark',
    '- [css/tailwind.css](css/tailwind.css): a Tailwind v4 `@theme` over the theme',
    '',
    '## Component kit',
    '',
    '- [components/index.html](components/index.html): the gallery of every drawn component type',
    '- [components/manifest.json](components/manifest.json): every catalogued type, its anatomy, its variants, and why a type is not drawn',
    '',
    '## Optional',
    '',
    '- [manifest.json](manifest.json): every file of this bundle with its size and SHA-256',
    '',
  ].join('\n')
