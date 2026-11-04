/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { SOVRIUM_EXTENSION_KEY } from '@/domain/models/api/admin/design-system/design-system'
import { formatColorValue } from '@/domain/models/app/design/token-value-dtcg-service'
import { dimensionAsCss } from './adapter-export-values'
import {
  designMdTypeRoles,
  fontFamilyList,
  monospaceFace,
  runningTextFace,
  type DesignMdExportInput,
  type DesignMdTypeValue,
} from './design-md-values-export'

/**
 * The generated prose of a DESIGN.md: the body of each of its eight sections,
 * before the section's narrative block.
 *
 * Every sentence is drawn from the token documents, so two exports of one
 * config write the same words. What a person adds goes in the narrative block
 * that closes each section, which the next export keeps.
 */

/** The opener of the Overview: what renders the app, and on what. */
export const DESIGN_MD_OVERVIEW_OPENER =
  'This app is rendered by the Sovrium binary from its configuration, on shadcn/ui base-nova on Base UI, set in Geist unless its `design` key names another face.'

/** The sentence before the Do's and Don'ts lists. */
const HOW_IT_CHANGES =
  "How this design changes: in the app's `design` key, in `design.components` for a component everywhere it appears, and in a component's `classes` or `className` for one place. Then regenerate this file with `sovrium design-system --format design-md --output DESIGN.md`."

/** The Do's, each a bullet of the body without its `- `. */
export const DESIGN_MD_DOS: readonly string[] = [
  "**Do** change a colour, radius, spacing step or type rung in the app's `design` key, then regenerate this file.",
  '**Do** restyle a component everywhere through `design.components`.',
  '**Do** adjust one element through its `classes` or `className`, with the token utilities this file names.',
  '**Do** build pages from shadcn/ui components, by their shadcn names.',
  '**Do** refer to colours, radii and spacing by the token names in the front matter.',
]

/** The Don'ts, each a bullet of the body without its `- `. */
export const DESIGN_MD_DONTS: readonly string[] = [
  "**Don't** write a CSS, HTML or font file: the Sovrium binary renders every page and does not load one.",
  "**Don't** invent a new visual world: this app is shadcn/ui base-nova on Base UI.",
  "**Don't** paste a literal colour or size into a page: name its token.",
  "**Don't** edit this file outside its narrative blocks: the next export rewrites it.",
]

/** The fixed text of `## Do's and Don'ts`. */
export const dosAndDontsLines = (): readonly string[] => [
  HOW_IT_CHANGES,
  '',
  '### Do:',
  '',
  ...DESIGN_MD_DOS.map((line) => `- ${line}`),
  '',
  "### Don't:",
  '',
  ...DESIGN_MD_DONTS.map((line) => `- ${line}`),
]

/** The palette group each shadcn/ui colour belongs to; any other colour is the app's own. */
const COLOR_GROUP: Readonly<Record<string, string>> = {
  primary: 'Primary',
  'primary-foreground': 'Primary',
  secondary: 'Secondary',
  'secondary-foreground': 'Secondary',
  accent: 'Tertiary',
  'accent-foreground': 'Tertiary',
  background: 'Neutral',
  foreground: 'Neutral',
  card: 'Neutral',
  'card-foreground': 'Neutral',
  popover: 'Neutral',
  'popover-foreground': 'Neutral',
  muted: 'Neutral',
  'muted-foreground': 'Neutral',
  border: 'Neutral',
  input: 'Neutral',
  ring: 'Neutral',
  destructive: 'Status',
}

/** The groups of `## Colors`, in the format's order, then the app's own colours. */
const COLOR_GROUP_ORDER = ['Primary', 'Secondary', 'Tertiary', 'Neutral', 'Status', 'App colours']

/** The group a colour is listed under, which the sidecar also gives as its role. */
export const colorGroupOf = (name: string): string => COLOR_GROUP[name] ?? 'App colours'

/** Where each shadcn/ui colour is painted, when the app records no usage of its own. */
const COLOR_USAGE: Readonly<Record<string, string>> = {
  primary: 'The fill of the main action of a view, such as the primary button.',
  'primary-foreground': 'Text and icons on a `primary` fill.',
  secondary: 'The fill of a secondary action.',
  'secondary-foreground': 'Text and icons on a `secondary` fill.',
  accent: 'The ground of a hovered or selected menu item or list row.',
  'accent-foreground': 'Text on an `accent` ground.',
  background: 'The page ground.',
  foreground: 'Running text on the page ground.',
  card: 'The ground of a card.',
  'card-foreground': 'Text on a card.',
  popover: 'The ground of menus, popovers and select lists.',
  'popover-foreground': 'Text on a `popover` ground.',
  muted: 'Quiet grounds: table headers, disabled fields, a card footer.',
  'muted-foreground': 'Secondary text: descriptions, placeholders, captions.',
  border: 'Dividers, and the edges of cards, tables and outlined buttons.',
  input: 'The edge of a form field.',
  ring: 'The focus ring.',
  destructive: 'Errors and destructive actions, as text and as a tinted ground.',
}

type Extension = DesignMdExportInput['light']['$extensions'][typeof SOVRIUM_EXTENSION_KEY]

const extensionOf = (input: DesignMdExportInput): Extension =>
  input.light.$extensions[SOVRIUM_EXTENSION_KEY]

/** The usage line of one colour: the app's own when it records one. */
const colorUsage = (name: string, extension: Extension): string => {
  const role = extension.colorRoles?.[name]
  const usage =
    role?.usage ??
    COLOR_USAGE[name] ??
    `An app colour, painted with \`bg-${name}\`, \`text-${name}\` or \`border-${name}\`.`
  return role?.pairsWith === undefined ? usage : `${usage} Pairs with \`${role.pairsWith}\`.`
}

/** The Overview body. */
export const overviewLines = (input: DesignMdExportInput): readonly string[] => {
  const principles = extensionOf(input).principles ?? []
  return [
    DESIGN_MD_OVERVIEW_OPENER,
    '',
    'The front matter above is normative: every colour, type role, radius and spacing step a page may use, under the token name pages write it with. The sections below say where each applies. The sidecar `.impeccable/design.json` carries what the front matter cannot: the dark value of each colour, the shadows, the motion and the breakpoints.',
    ...(principles.length === 0
      ? []
      : ['', '**Key Characteristics:**', '', ...principles.map((line) => `- ${line}`)]),
  ]
}

/** The Colors body: each colour by group, with its light and dark value and its usage. */
export const colorsLines = (input: DesignMdExportInput): readonly string[] => {
  const extension = extensionOf(input)
  const colors = Object.entries(input.light.color)
  const bullet = ([name, token]: Readonly<(typeof colors)[number]>): string => {
    const dark = input.dark.color[name]
    const darkText = dark === undefined ? '' : `, dark \`${formatColorValue(dark.$value)}\``
    return `- **${name}** (\`${formatColorValue(token.$value)}\`${darkText}): ${colorUsage(name, extension)}`
  }
  return [
    'Each colour is a CSS custom property of the same name, painted through Tailwind utilities such as `bg-primary` and `text-muted-foreground`. The front matter gives its light value; the `.dark` scheme paints the dark value named beside it.',
    ...COLOR_GROUP_ORDER.flatMap((group) => {
      const members = colors.filter(([name]) => colorGroupOf(name) === group)
      return members.length === 0 ? [] : ['', `### ${group}`, '', ...members.map(bullet)]
    }),
  ]
}

/** A face as the format's headers write it: `Geist Variable (with sans-serif)`. */
const faceLabel = (face: string): string => {
  const [first, ...fallbacks] = face.split(', ')
  return fallbacks.length === 0 ? (first ?? face) : `${first} (with ${fallbacks.join(', ')})`
}

/** One role's measures, in the order a reader compares them. */
const measures = (value: DesignMdTypeValue): string =>
  [
    value.fontFamily === undefined ? undefined : `set in ${value.fontFamily}`,
    value.fontWeight === undefined ? undefined : `weight ${value.fontWeight}`,
    value.fontSize,
    value.lineHeight === undefined ? undefined : `line height ${value.lineHeight}`,
    value.letterSpacing === undefined ? undefined : `tracking ${value.letterSpacing}`,
  ]
    .filter((part): part is string => part !== undefined)
    .join(', ')

/** A role name with its first letter upper-cased, as the format's hierarchy lists it. */
const roleLabel = (role: string): string => `${role.charAt(0).toUpperCase()}${role.slice(1)}`

/** The Typography body: the faces, then each role with the rung it was read from. */
export const typographyLines = (input: DesignMdExportInput): readonly string[] => {
  const body = runningTextFace(input.light)
  const mono = monospaceFace(input.light)
  const roles = designMdTypeRoles(input.light)
  const { title } = input.light.font
  const display = title === undefined ? undefined : fontFamilyList(title.$value)
  const faces = [
    ...(body === undefined ? [] : [`**Body Font:** ${faceLabel(body)}`]),
    ...(display === undefined || display === body
      ? []
      : [`**Display Font:** ${faceLabel(display)}`]),
    ...(mono === undefined ? [] : [`**Mono Font:** ${faceLabel(mono)}`]),
  ]
  const hierarchy =
    roles.length === 0
      ? [
          "The app declares no type ladder (`design.typeScale.steps`), so text keeps the platform's sizes, set with Tailwind's `text-*` utilities, in the faces named above.",
        ]
      : [
          '### Hierarchy',
          '',
          ...roles.map(
            (role) =>
              `- **${roleLabel(role.role)}** (\`${role.rung}\` rung: ${measures(role.value)})`
          ),
        ]
  return [...faces.flatMap((line, index) => (index === 0 ? [line] : ['', line])), '', ...hierarchy]
}

/** A dimension list: `- **step** (`value`)`. */
const lengthBullets = (group: DesignMdExportInput['light']['radius']): readonly string[] =>
  Object.entries(group).map(
    ([step, token]) => `- **${step}** (\`${dimensionAsCss(token.$value)}\`)`
  )

/** The zones of the app, each with its patterns. */
const zoneBullets = (input: DesignMdExportInput): readonly string[] => {
  const zones = extensionOf(input).zones ?? []
  const names = [...new Set(zones.map((entry) => entry.zone))]
  return names.map((name) => {
    const patterns = zones.filter((entry) => entry.zone === name).map((entry) => entry.pattern)
    return `- **${name}**: ${patterns.map((pattern) => `\`${pattern}\``).join(', ')}`
  })
}

/** The Layout body: spacing, breakpoints and the zones a page belongs to. */
export const layoutLines = (input: DesignMdExportInput): readonly string[] => {
  const spacing = lengthBullets(input.light.spacing)
  const breakpoints = Object.entries(input.light.breakpoint).map(
    ([name, token]) => `- **${name}** (from \`${dimensionAsCss(token.$value)}\`)`
  )
  const zones = zoneBullets(input)
  return [
    "Gaps and padding use Tailwind's spacing utilities (`p-4`, `gap-6`). A step the app names is in the front matter's `spacing`, written as its own utility.",
    ...(spacing.length === 0 ? [] : ['', '### Spacing', '', ...spacing]),
    ...(breakpoints.length === 0 ? [] : ['', '### Breakpoints', '', ...breakpoints]),
    ...(zones.length === 0
      ? []
      : [
          '',
          '### Zones',
          '',
          "Each page belongs to the zone its path matches, and a zone's surface brief under `.impeccable/surfaces/` says what kind of surface it is.",
          '',
          ...zones,
        ]),
  ]
}

/** The Elevation & Depth body: the shadow ladder the app ships. */
export const elevationLines = (input: DesignMdExportInput): readonly string[] => {
  const shadows = Object.entries(extensionOf(input).shadows ?? {})
  if (shadows.length === 0) {
    return [
      'The app ships no shadow ladder: depth comes from the `card` and `popover` grounds and the `border` colour.',
    ]
  }
  return [
    'Cards and panels sit flat on the page ground, edged by a hairline rather than lifted; a shadow lifts what floats over the page, such as a menu, a select list or a dialog.',
    '',
    '### Shadow Vocabulary',
    '',
    ...shadows.map(([name, shadow]) => `- **${name}** (\`box-shadow: ${shadow.value}\`)`),
  ]
}

/** The Shapes body: the radius ladder. */
export const shapesLines = (input: DesignMdExportInput): readonly string[] => [
  "Corners are set with Tailwind's `rounded-*` utilities, each reading the radius step of the same name.",
  '',
  ...lengthBullets(input.light.radius),
]

/** The Components body: the front-matter components, then the guidance the app records. */
export const componentsLines = (
  input: DesignMdExportInput,
  components: readonly string[]
): readonly string[] => {
  const guidance = Object.entries(extensionOf(input).components ?? {})
  return [
    "Pages are built from Sovrium components that render shadcn/ui's anatomy. The front matter draws the canonical ones: " +
      `${components.map((name) => `\`${name}\``).join(', ')}. ` +
      'Each paints with the tokens it names, and states such as hover and focus come from the same tokens.',
    ...(guidance.length === 0
      ? []
      : [
          '',
          '### Guidance',
          '',
          ...guidance.map(([type, entry]) =>
            [
              `- **${type}**:`,
              entry.usage,
              entry.when === undefined ? undefined : `When: ${entry.when}`,
              entry.dont === undefined ? undefined : `Don't: ${entry.dont}`,
            ]
              .filter((part): part is string => part !== undefined)
              .join(' ')
          ),
        ]),
  ]
}
