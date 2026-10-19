/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { foldLineBreaks, escapeMarkdownTableCell } from '@/domain/kernel/markdown/markdown-escaping'
import { SOVRIUM_EXTENSION_KEY } from '@/domain/models/api/admin/design-system/design-system'
import { PLATFORM_TYPE_LADDER } from '@/domain/models/app/design/inherited-tokens'
import { jsonFileContent, type AdapterFile, type DesignTokenModes } from './adapter-export-values'
import { coverPreview } from './claude-design-cover-export'
import { claudeDesignTokens, type ClaudeDesignFontFile } from './claude-design-tokens-export'
import type { ClaudeDesignIndex } from '@/domain/models/api/admin/design-system/adapter-claude-design-index'
import type { ComponentKitEntry } from '@/domain/models/api/admin/design-system/component-kit-manifest'
import type { SovriumDesignExtension } from '@/domain/models/api/admin/design-system/design-system'

/**
 * The Claude Design adapter: a Design System artifact project (contract
 * 0.2.47) under `adapters/claude-design/project/`.
 *
 * - `design-system.json`, the index the page reads first. It carries no clock:
 *   its one date is the Unix epoch and it names no last change, which the page
 *   writes on its first save, so a second export is byte-identical;
 * - `README.md`, the brand book, opening with the `# <app>` heading the
 *   artifact titles its Overview with;
 * - `tokens.json`, see `claude-design-tokens-export.ts`;
 * - `components/bundle.css`, when the kit stylesheet is supplied: the one
 *   stylesheet the supplied previews are drawn with, which the page preloads
 *   into every card, so no card links it. Its `@font-face` rules are dropped:
 *   `tokens.json` lists every face, and a relative `url()` in a preloaded
 *   sheet does not resolve from the card's frame;
 * - `components/Cover/preview.html`, the cover (`claude-design-cover-export.ts`);
 * - `components/<Component>/README.md` and `preview.html` for every type the
 *   kit DRAWS. The folder is the type in PascalCase, the ASCII identifier the
 *   artifact requires.
 *
 * The folder holds no picture, video or sound: a published system keeps those
 * as uploads its index names by blob id, which a folder on disk cannot carry.
 *
 * ─── AN OFFLINE CARD ───────────────────────────────────────────────────────
 *
 * A preview's line 1 is the `@dsCard` marker the artifact reads. The rest is a
 * root element styled by the token variables the artifact's frame preloads
 * (`tokens.css`), and nothing else: no network URL, no `data:` payload. A card
 * must render the day a CDN moves. A caller-supplied fragment that reaches the
 * network or embeds base64 is refused for the generated card.
 */

/** Where the adapter writes, inside the bundle. */
const PROJECT_DIR = 'adapters/claude-design/project'

/**
 * Where the project's font files go, the folder `tokens.json` names each face
 * under (`fonts/<file>`). Binary, so the bundle writer copies them, not this
 * text projection.
 */
export const CLAUDE_DESIGN_FONTS_DIR = `${PROJECT_DIR}/fonts`

/** Where the supplied stylesheet goes, relative to the project: the path the format gives it. */
const KIT_STYLESHEET = 'components/bundle.css'

/** The Unix epoch, the reproducible-build spelling of "no date". */
const NO_DATE = '1970-01-01T00:00:00Z'

/** The row height the card asks for; the artifact grows a row to fit. */
const CARD_HEIGHT = 160

/** What the Claude Design adapter reads. */
export interface ClaudeDesignExportInput extends DesignTokenModes {
  /** The app name: the system's name and the brand book's title. */
  readonly appName: string
  /** The kit's catalogued types; only the drawn ones get a card. */
  readonly components: readonly ComponentKitEntry[]
  /**
   * Optional static markup per type, such as the kit page's own specimen. A
   * fragment loading from the network or embedding base64 is ignored.
   */
  readonly previews?: Readonly<Record<string, string>>
  /**
   * Optional stylesheet the supplied markup is drawn with, written as the
   * project's `components/bundle.css`, which the page preloads into every
   * card. A stylesheet loading from the network, or holding the `</style`
   * that would end the element the page inlines it into, is ignored, and the
   * cards then fall back to the generated ones.
   */
  readonly stylesheet?: string
  /**
   * The font files the bundle copies into the project's `fonts/`, listed in
   * `tokens.json` `type.fonts` (each `file` its `fonts/<file>` path) so the
   * artifact declares a face for each.
   */
  readonly fonts?: readonly ClaudeDesignFontFile[]
}

/** `form-controls` → `FormControls`, prefixed when it would start with a digit. */
export const componentFolderName = (type: string): string => {
  const pascal = type
    .split(/[^A-Za-z0-9]+/)
    .filter((part) => part.length > 0)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join('')
  return /^[A-Za-z_$]/.test(pascal) ? pascal : `_${pascal}`
}

/** `form-controls` → `Form controls`. */
const groupLabel = (category: string): string => {
  const words = category.replace(/[-_]+/g, ' ').trim()
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`
}

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** A markdown table cell: one line, pipes escaped. */
const cell = escapeMarkdownTableCell

/** The artifact's cap on one preview is 256 KB; a larger fragment falls back to the generated card. */
const MAX_FRAGMENT_LENGTH = 200_000

/** A fragment that stays offline and small: no network `src`/`href`, no base64 payload. */
const isOfflineFragment = (html: string): boolean =>
  html.length <= MAX_FRAGMENT_LENGTH &&
  !/(?:src|href)\s*=\s*["']?\s*(?:https?:)?\/\//i.test(html) &&
  !html.includes(';base64,')

/**
 * A stylesheet that stays offline and inlines safely: no `@import`, no `url()`
 * reaching the network, no `</style`.
 */
const isOfflineStylesheet = (css: string): boolean =>
  !/@import\b/i.test(css) &&
  !/url\(\s*["']?\s*(?:https?:)?\/\//i.test(css) &&
  !/<\/style/i.test(css)

/** The stylesheet without its `@font-face` rules: the page declares each face from `tokens.json`. */
const withoutFontFaces = (css: string): string => css.replace(/@font-face\s*\{[^}]*\}\s*/gi, '')

type DrawnEntry = Extract<ComponentKitEntry, { readonly renders: true }>

/** Folder names the format gives entries of `components/` that are not components. */
const RESERVED_FOLDERS: ReadonlySet<string> = new Set(['Cover', 'lib'])

/**
 * The drawn types, one per folder name: the first type to claim a name keeps
 * it, and no type takes a name the format reserves.
 */
const drawnEntries = (components: readonly ComponentKitEntry[]): readonly DrawnEntry[] =>
  components
    .filter((entry): entry is DrawnEntry => entry.renders)
    .filter((entry) => !RESERVED_FOLDERS.has(componentFolderName(entry.type)))
    .filter(
      (entry, index, all) =>
        all.findIndex(
          (other) => componentFolderName(other.type) === componentFolderName(entry.type)
        ) === index
    )

const bulletList = (items: readonly string[]): readonly string[] =>
  items.map((item) => `- ${foldLineBreaks(item)}`)

const section = (heading: string, body: readonly string[]): readonly string[] =>
  body.length === 0 ? [] : [`## ${heading}`, '', ...body, '']

/**
 * What the text renders at when the app declares no type scale: the
 * platform's text utilities, named as such, never published as tokens.
 */
const platformTypeLines = (input: ClaudeDesignExportInput): readonly string[] =>
  Object.keys(input.light.typography).length > 0
    ? []
    : [
        'This app declares no type scale, so `tokens.json` lists no text style. ' +
          "Its text renders with the platform's text utilities:",
        '',
        '| Utility | Size | Leading |',
        '| --- | --- | --- |',
        ...PLATFORM_TYPE_LADDER.map(
          ([utility, size, leading]) => `| \`${utility}\` | ${size}px | ${leading}px |`
        ),
      ]

/** What spaces the app when it declares no spacing step. */
const platformSpacingLines = (input: ClaudeDesignExportInput): readonly string[] =>
  Object.keys(input.light.spacing).length > 0
    ? []
    : [
        'This app declares no spacing step, so `tokens.json` lists none. ' +
          "It spaces with the platform's spacing utilities; do not invent a scale for it.",
      ]

/** A labelled list, or nothing when there is no list. */
const listedLines = (label: string, items: readonly string[] | undefined): readonly string[] =>
  items === undefined ? [] : ['', `${label}:`, '', ...bulletList(items)]

/** The voice section's lines, from the design system's voice. */
const voiceLines = (voice: SovriumDesignExtension['voice']): readonly string[] =>
  voice === undefined
    ? []
    : [
        ...(voice.personality === undefined
          ? []
          : [`Personality: ${foldLineBreaks(voice.personality.join(', '))}.`]),
        ...(voice.pronoun === undefined
          ? []
          : [`Address the reader as "${foldLineBreaks(voice.pronoun)}".`]),
        ...listedLines('Prefer', voice.prefer),
        ...listedLines('Avoid', voice.avoid),
        ...Object.entries(voice.tone ?? {}).flatMap(([state, line]) =>
          line === undefined ? [] : [`- ${state}: ${foldLineBreaks(line)}`]
        ),
      ]

/** The brand book: what the design system says about itself, then where its parts are. */
const brandBook = (input: ClaudeDesignExportInput, drawn: readonly DrawnEntry[]): string => {
  const extension = input.light.$extensions[SOVRIUM_EXTENSION_KEY]
  const roles = Object.entries(extension.colorRoles ?? {}).filter(
    ([, role]) => role.usage !== undefined || role.pairsWith !== undefined
  )
  const lines = [
    `# ${input.appName}`,
    '',
    `The design system of ${input.appName}, exported from its Sovrium config. ` +
      'Colours have two themes, Light and Dark; every token in `tokens.json` says what it is for.',
    '',
    ...section('Principles', bulletList(extension.principles ?? [])),
    ...section('Voice', voiceLines(extension.voice)),
    ...section(
      'Colour roles',
      roles.length === 0
        ? []
        : [
            '| Token | Usage | Pairs with |',
            '| --- | --- | --- |',
            ...roles.map(
              ([name, role]) =>
                `| \`${cell(name)}\` | ${cell(role.usage ?? '')} | ${role.pairsWith === undefined ? '' : `\`${cell(role.pairsWith)}\``} |`
            ),
          ]
    ),
    ...section('Type', platformTypeLines(input)),
    ...section('Spacing', platformSpacingLines(input)),
    ...section(
      'Components',
      drawn.map((entry) => `- **${componentFolderName(entry.type)}**: ${cell(entry.purpose)}`)
    ),
  ]
  return `${lines.join('\n').trimEnd()}\n`
}

/** A component's guidelines. Its first sentence, the purpose, is the artifact's summary. */
const componentReadme = (entry: DrawnEntry): string => {
  const lines = [
    `# ${componentFolderName(entry.type)}`,
    '',
    foldLineBreaks(entry.purpose),
    '',
    `The \`${entry.type}\` component type of the config.`,
    '',
    ...section(
      'When to use',
      entry.guidance.usage === undefined ? [] : [foldLineBreaks(entry.guidance.usage)]
    ),
    ...section('Do', bulletList(entry.guidance.do)),
    ...section("Don't", bulletList(entry.guidance.dont)),
    ...section('Variants', bulletList(entry.variants.map((variant) => `\`${variant}\``))),
    ...section('Anatomy', bulletList(entry.slots.map((slot) => `\`${slot}\``))),
  ]
  return `${lines.join('\n').trimEnd()}\n`
}

/** The generated card: the type's name and purpose, and one chip per variant. */
const generatedCard = (entry: DrawnEntry): string => {
  const chips = (entry.variants.length === 0 ? ['default'] : entry.variants)
    .map((variant) => `    <span class="ds-chip">${escapeHtml(variant)}</span>`)
    .join('\n')
  return [
    `  <p class="ds-title">${escapeHtml(componentFolderName(entry.type))}</p>`,
    `  <p class="ds-purpose">${escapeHtml(entry.purpose)}</p>`,
    '  <div class="ds-chips">',
    chips,
    '  </div>',
  ].join('\n')
}

/** The card's own styles, reading only the token variables the frame preloads. */
const CARD_STYLE = [
  '  <style>',
  '    #root { font-family: var(--font-sans, system-ui, sans-serif); color: var(--foreground); background: var(--background); padding: 16px; }',
  '    #root .ds-title { margin: 0 0 4px; font-weight: 600; }',
  '    #root .ds-purpose { margin: 0 0 12px; color: var(--muted-foreground); }',
  '    #root .ds-chips { display: flex; flex-wrap: wrap; gap: 8px; }',
  '    #root .ds-chip { padding: 4px 10px; border: 1px solid var(--border); border-radius: var(--radius-md, 8px); background: var(--secondary); color: var(--secondary-foreground); }',
  '  </style>',
].join('\n')

/** A component's `preview.html`: the marker on line 1, then one offline root element. */
const componentPreview = (entry: DrawnEntry, fragment: string | undefined): string => {
  const supplied = fragment !== undefined && isOfflineFragment(fragment)
  return [
    `<!-- @dsCard group="${escapeHtml(groupLabel(entry.category))}" height=${CARD_HEIGHT} -->`,
    '<div id="root">',
    ...(supplied ? [fragment.trim()] : [CARD_STYLE, generatedCard(entry)]),
    '</div>',
    '',
  ].join('\n')
}

/** The index the page reads first: the system's name, and nothing the page owns. */
export const claudeDesignIndex = (appName: string): ClaudeDesignIndex => ({
  v: 3,
  layout: 'files',
  createdOnFiles: { v: 1, at: NO_DATE },
  title: appName,
  namespace: componentFolderName(appName),
  libraries: [],
  sections: {},
  groups: [],
  assetGroups: {},
  blobs: {},
  docs: { readme: 'project/README.md', sections: [] },
})

/**
 * The Claude Design subtree: the index, the brand book, the tokens, the
 * stylesheet, the cover, then one guideline and one preview per drawn
 * component, in catalogue order.
 */
export const exportClaudeDesign = (input: ClaudeDesignExportInput): readonly AdapterFile[] => {
  const drawn = drawnEntries(input.components)
  const stylesheet =
    input.stylesheet !== undefined && isOfflineStylesheet(input.stylesheet)
      ? withoutFontFaces(input.stylesheet)
      : undefined
  return [
    {
      path: `${PROJECT_DIR}/design-system.json`,
      content: jsonFileContent(claudeDesignIndex(input.appName)),
    },
    { path: `${PROJECT_DIR}/README.md`, content: brandBook(input, drawn) },
    {
      path: `${PROJECT_DIR}/tokens.json`,
      content: jsonFileContent(claudeDesignTokens(input.appName, input, input.fonts)),
    },
    ...(stylesheet === undefined
      ? []
      : [{ path: `${PROJECT_DIR}/${KIT_STYLESHEET}`, content: stylesheet }]),
    {
      path: `${PROJECT_DIR}/components/Cover/preview.html`,
      content: coverPreview(input.appName, input.light),
    },
    ...drawn.flatMap((entry) => {
      const folder = `${PROJECT_DIR}/components/${componentFolderName(entry.type)}`
      return [
        { path: `${folder}/README.md`, content: componentReadme(entry) },
        {
          path: `${folder}/preview.html`,
          content: componentPreview(
            entry,
            stylesheet === undefined ? undefined : input.previews?.[entry.type]
          ),
        },
      ]
    }),
  ]
}
