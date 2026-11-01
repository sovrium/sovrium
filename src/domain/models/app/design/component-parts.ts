/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The part vocabulary of every key of `design.components`: which inner
 * elements each component type draws, and so which part names a class list
 * may be keyed by.
 *
 * ## Why it lives in the domain
 *
 * A part is an element a renderer owns, but the renderers live in the
 * presentation layer, which the domain may not import. Kept there, the list
 * would be invisible to the schema, and a mistyped part such as
 * `code.parts.copyButton` would decode, boot and style nothing. So the list
 * lives here instead: the schema refuses a name it lacks, and the renderers
 * derive their own part types FROM it, so a renderer that reads a
 * part the registry does not list fails to compile.
 *
 * `root` is a part of every key and is never listed. A type absent from
 * {@link COMPONENT_PARTS} draws `root` only.
 */

import type { EngineComponentType } from '../engine-component-types'

/** The prose parts of rendered markdown, in the order the renderer applies them. */
export const PROSE_PARTS = [
  'heading1',
  'heading2',
  'heading3',
  'paragraph',
  'listItem',
  'list',
  'table',
  'link',
  'quote',
  'image',
  'codeBlock',
  'inlineCode',
  'codeFrame',
  'codeCaption',
  'codeCopy',
  'lead',
  'callout',
  'calloutInfo',
  'calloutNote',
  'calloutTip',
  'calloutWarning',
  'calloutDanger',
] as const

/** One prose part of rendered markdown. */
export type ProsePart = (typeof PROSE_PARTS)[number]

/** The regions the markdown reading frame draws around an article. */
export const MARKDOWN_FRAME_PARTS = [
  'frame',
  'sidebar',
  'navGroup',
  'navGroupLabel',
  'navLink',
  'menuButton',
  'toc',
  'tocLinkActive',
  'article',
  'articleHeader',
  'articleActions',
  'articleLinks',
  'lastUpdated',
] as const

/** The pieces a gallery (and a carousel, drawn by the same card grid) draws. */
export const GALLERY_PARTS = ['grid', 'card', 'cover', 'body'] as const

/** The pieces an event calendar draws inside its month grid. */
export const CALENDAR_GRID_PARTS = ['event', 'day', 'dayNumber', 'columnHeader'] as const

/** One key of `design.components`: an engine component type, or `markdown`. */
export type StyledComponentKey = EngineComponentType | 'markdown'

/**
 * The parts each key draws BEYOND `root`. A key absent here draws `root` only.
 */
export const COMPONENT_PARTS = {
  carousel: GALLERY_PARTS,
  code: ['frame', 'caption', 'copy'],
  'event-calendar': [...CALENDAR_GRID_PARTS, 'toolbar'],
  'file-preview': ['stage', 'toolbar'],
  form: ['title', 'description', 'body', 'label', 'input', 'submit', 'error'],
  gallery: GALLERY_PARTS,
  kpi: ['value'],
  'language-switcher': ['link'],
  list: ['list', 'item', 'title', 'subtitle', 'meta'],
  'record-field': PROSE_PARTS,
  select: ['trigger', 'label', 'icon', 'list'],
  sidebar: ['inner', 'nav', 'groupLabel', 'link', 'badge'],
  stepper: ['rail', 'step', 'panel', 'footer'],
  table: ['caption', 'header', 'row', 'cell', 'chip'],
  tabs: ['list', 'panel'],
  text: PROSE_PARTS,
  toc: ['linkActive'],
  markdown: [...PROSE_PARTS, ...MARKDOWN_FRAME_PARTS],
} as const satisfies Partial<Record<StyledComponentKey, readonly string[]>>

/** Every part name `key` accepts, `root` included. */
export type ComponentPartName<K extends StyledComponentKey> =
  'root' | (K extends keyof typeof COMPONENT_PARTS ? (typeof COMPONENT_PARTS)[K][number] : never)

/** Every part name some key draws beyond `root`: the names a renderer may read. */
export type DesignPartName = (typeof COMPONENT_PARTS)[keyof typeof COMPONENT_PARTS][number]

/**
 * One class list per non-root part, keyed by a registry name. The type a
 * renderer reads part classes through, so a part name the registry lacks
 * fails to compile at the read site.
 */
export type PartClassMap = Readonly<Partial<Record<DesignPartName, string>>>

/**
 * Every part name a key accepts, `root` first, then the registry's order.
 *
 * @param key - A key of `design.components`.
 */
export const componentPartsOf = (key: string): readonly string[] => [
  'root',
  ...((COMPONENT_PARTS as Readonly<Record<string, readonly string[]>>)[key] ?? []),
]

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const entriesOf = (value: unknown): ReadonlyArray<readonly [string, unknown]> =>
  isRecord(value) ? Object.entries(value) : []

/**
 * One message per part name under `design.components` that its key does not
 * draw, read under `parts`, every `variants.<v>` and every `states.<s>`:
 *
 *   design.components.code.parts.copyButton: copyButton is not a part of code.
 *   Its parts are: root, frame, caption, copy.
 *
 * Every offender is listed, not only the first. Total over any input: it runs
 * as a check on a value whose shape the schema has already decoded.
 *
 * @param components - The `design.components` block.
 * @returns The messages, empty when every part name is known.
 */
export const unknownComponentPartIssues = (components: unknown): readonly string[] =>
  entriesOf(components).flatMap(([key, style]) => {
    if (!isRecord(style)) return []
    const known = componentPartsOf(key)
    const maps: ReadonlyArray<readonly [string, unknown]> = [
      ['parts', style['parts']],
      ...entriesOf(style['variants']).map(
        ([variant, map]) => [`variants.${variant}`, map] as const
      ),
      ...entriesOf(style['states']).map(([state, map]) => [`states.${state}`, map] as const),
    ]
    return maps.flatMap(([where, map]) =>
      entriesOf(map)
        .map(([part]) => part)
        .filter((part) => !known.includes(part))
        .map(
          (part) =>
            `design.components.${key}.${where}.${part}: ${part} is not a part of ${key}. Its parts are: ${known.join(', ')}.`
        )
    )
  })
