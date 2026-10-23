/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { serializeJsonForScript } from '@/domain/kernel/sanitize/json-script-serialization'
import { resolveTranslationPattern } from '@/domain/models/app/languages/translation-resolver'
import {
  resolvedTableLabels,
  type TableDisplayNames,
} from '@/domain/models/app/tables/table-display-name-service'
import {
  COMMAND_GROUP_CLASSES,
  COMMAND_INPUT_CLASSES,
  COMMAND_INPUT_GROUP_CLASSES,
  COMMAND_INPUT_WRAPPER_CLASSES,
  COMMAND_ITEM_CLASSES,
  COMMAND_LIST_CLASSES,
  COMMAND_ROOT_CLASSES,
} from '@/presentation/design/command-default-classes'
import { authoredGroupsOf, renderAuthoredGroups } from './command-groups-host'
import {
  specimenActionMatches,
  specimenQuickActions,
  type QuickAction,
} from './command-palette-specimen-actions'
import {
  paletteHints,
  navPagesOf,
  paletteStrings,
  searchActionWords,
  searchKindWords,
  tableLabelsOf,
  type PaletteHints,
} from './command-palette-words'
import type { ComponentDispatchConfig, ComponentRenderer } from './component-dispatch-config'
import type { ReactElement } from 'react'

/** Field types whose physical columns surface as text inputs in the form. */
const TEXT_FIELD_TYPES = new Set([
  'single-line-text',
  'long-text',
  'rich-text',
  'email',
  'url',
  'number',
  'phone-number',
])

/** Minimal table shape consumed by the quick-action creation dialogs. */
interface PaletteTable extends TableDisplayNames {
  readonly fields?: ReadonlyArray<{
    readonly name: string
    readonly type: string
    readonly label?: string
  }>
}

/** Minimal navigable-page shape carried in the synthesized component props. */
interface PalettePage {
  readonly name: string
  readonly path: string
  readonly title: string
}

/** The palette's declared search mode, as it reaches the renderer. */
interface PaletteSearch {
  readonly endpoint: string
  readonly placeholder?: string
  readonly kindLabels?: Readonly<Record<string, string>>
}

/**
 * The admin console's own search binding.
 *
 * The console still reaches this renderer through a builder-set
 * `props.adminSearch` flag rather than through an authored `search` block.
 * Mapping the flag onto the SAME shape an authored palette uses is what keeps
 * one code path: when the console becomes config, the flag disappears and the
 * block is authored instead, with no renderer change at all.
 */
const ADMIN_SEARCH: PaletteSearch = { endpoint: '/api/admin/search' }

/**
 * SEARCH mode: point ⌘K at a read endpoint instead of at the built-in quick
 * actions. The `data-command-palette-config` marker carries the binding, and
 * the `command` island mounts with the page carrying the authored `groups` it
 * draws above the results — already gated, so a row a gate removed is in
 * neither. The built-in quick actions are omitted: `search` is a MODE.
 */
function renderSearchPalette(
  search: PaletteSearch,
  words: {
    readonly hints: PaletteHints
    readonly tableLabels: Readonly<Record<string, string>>
    readonly groups: ReturnType<typeof authoredGroupsOf>
    readonly kinds: ReturnType<typeof searchKindWords>
    readonly pages: readonly PalettePage[]
    readonly strings: Readonly<Record<string, string>>
  }
): ReactElement {
  const configJson = serializeJsonForScript({ search })
  const islandProps = serializeJsonForScript({
    endpoint: search.endpoint,
    hints: words.hints,
    tableLabels: words.tableLabels,
    ...(words.groups === undefined ? {} : { groups: words.groups }),
    pages: words.pages,
    strings: words.strings,
    ...(search.placeholder !== undefined ? { placeholder: search.placeholder } : {}),
    ...words.kinds,
  })
  return (
    <>
      <script
        type="application/json"
        data-command-palette-config="true"
        dangerouslySetInnerHTML={{ __html: configJson }}
      />
      <div
        data-island="command"
        data-component-type="command"
        data-island-props={islandProps}
        className="hidden"
      >
        <span className="sr-only" />
      </div>
    </>
  )
}

/** The specimen's "Quick actions" group, in cmdk's own markup. */
function renderSpecimenActionGroup(actions: readonly QuickAction[]): ReactElement {
  return (
    <div
      cmdk-group=""
      data-slot="command-group"
      className={COMMAND_GROUP_CLASSES}
    >
      <div cmdk-group-heading="">Quick actions</div>
      <div
        cmdk-group-items=""
        role="group"
        aria-label="Quick actions"
      >
        {actions.map((action) => (
          <div
            key={action.label}
            cmdk-item=""
            role="option"
            aria-selected="false"
            aria-label={action.label}
            data-command-action={action.action}
            data-slot="command-item"
            className={COMMAND_ITEM_CLASSES}
          >
            <span>{action.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * SPECIMEN mode: the palette's command menu as a still picture, in place,
 * wired to nothing.
 *
 * The live palette renders nothing until it is opened, so a specimen of its
 * resting state would draw nothing at all. This draws the menu's own markup,
 * cmdk's attributes and the same slot classes the live menu wears
 * (`design/command-default-classes.ts`), and withholds everything that makes it
 * a palette: no `[data-command-palette-config]` block (the page still
 * advertises exactly one palette, its own), no island, and no `role="dialog"`
 * (one keystroke still opens exactly one dialog, and this is not it).
 *
 * `query` is what the menu is drawn WITH, and it is what makes the `empty`
 * cell a real state: the live filter drops every action that does not match,
 * and a query matching none leaves the list the palette shows when it has
 * nothing to offer.
 */
function renderSpecimenOverlay(
  tables: ReadonlyArray<{ readonly name: string; readonly labelPlural: string }>,
  pages: ReadonlyArray<PalettePage>,
  query: string
): ReactElement {
  const matched = specimenQuickActions(tables, pages).filter(
    (action) => query.trim().length === 0 || specimenActionMatches(action.label, query)
  )
  return (
    <div
      data-command-palette-specimen="true"
      data-component="command"
      className="flex justify-center p-4"
    >
      <div
        cmdk-root=""
        data-slot="command"
        className={`${COMMAND_ROOT_CLASSES} ring-foreground/10 max-w-lg ring-1`}
      >
        <div className={COMMAND_INPUT_WRAPPER_CLASSES}>
          <div className={COMMAND_INPUT_GROUP_CLASSES}>
            <input
              cmdk-input=""
              data-slot="command-input"
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-label="Search"
              placeholder="Search…"
              defaultValue={query}
              readOnly
              className={COMMAND_INPUT_CLASSES}
            />
          </div>
        </div>
        <div
          cmdk-list=""
          role="listbox"
          aria-label="Suggestions"
          data-slot="command-list"
          className={COMMAND_LIST_CLASSES}
        >
          {matched.length > 0 && renderSpecimenActionGroup(matched)}
        </div>
      </div>
    </div>
  )
}

/**
 * Is this drawing a SPECIMEN, and with what search text?
 *
 * Reached through `props` for the same reason `props.adminSearch` is: it is set
 * by the surface DRAWING the palette, never by an app author describing one
 * they want to work.
 */
const specimenQueryOf = (component: ComponentDispatchConfig['component']): string | undefined => {
  const props = (component as { readonly props?: Record<string, unknown> } | undefined)?.props
  if (props?.['specimen'] !== true) return undefined
  const query = props['specimenQuery']
  return typeof query === 'string' ? query : ''
}

/**
 * The palette's search binding, reached two ways that produce the same output:
 * an authored `search` block, and the console's builder-set `props.adminSearch`
 * flag — the same binding written in TypeScript rather than in config.
 */
function resolveSearchMode(
  component: ComponentDispatchConfig['component']
): PaletteSearch | undefined {
  const node = component as
    | { readonly search?: PaletteSearch; readonly props?: { readonly adminSearch?: boolean } }
    | undefined
  if (node?.search !== undefined) return node.search
  return node?.props?.adminSearch === true ? ADMIN_SEARCH : undefined
}

/**
 * The fields, per table, the page pass found this reader may not read — stamped
 * on the palette's props, because the renderer holds the tables but not the
 * app's roles. Empty when the reader may read every field.
 */
const unreadableFieldsOf = (
  component: ComponentDispatchConfig['component']
): Readonly<Record<string, readonly string[]>> => {
  const stamped = (component as { readonly props?: Record<string, unknown> } | undefined)?.props?.[
    '_unreadableFields'
  ]
  return typeof stamped === 'object' && stamped !== null
    ? (stamped as Readonly<Record<string, readonly string[]>>)
    : {}
}

/** The tables the page pass stamped under `key`: those this reader may not read, or not create in. */
const stampedTablesOf = (
  component: ComponentDispatchConfig['component'],
  key: '_unreadableTables' | '_uncreatableTables'
): readonly string[] => {
  const stamped = (component as { readonly props?: Record<string, unknown> } | undefined)?.props?.[
    key
  ]
  return Array.isArray(stamped) ? (stamped as readonly string[]) : []
}

/**
 * The tables the create dialogs offer — those the reader may read and create
 * in — each named
 * in the page language, with its readable text columns labelled as the hosted
 * form labels them: by the column's label, its name when it has none.
 */
const paletteTables = (config: ComponentDispatchConfig) => {
  const lang = config.currentLang ?? config.languages?.default ?? ''
  const unreadable = unreadableFieldsOf(config.component)
  const hiddenTables = new Set([
    ...stampedTablesOf(config.component, '_unreadableTables'),
    ...stampedTablesOf(config.component, '_uncreatableTables'),
  ])
  const readable = ((config.tables ?? []) as ReadonlyArray<PaletteTable>).filter(
    (table) => !hiddenTables.has(table.name)
  )
  const translate = (text: string) => resolveTranslationPattern(text, lang, config.languages)
  return readable.map((table) => ({
    name: table.name,
    ...resolvedTableLabels(table, translate),
    fields: (table.fields ?? [])
      .filter((field) => TEXT_FIELD_TYPES.has(field.type))
      .filter((field) => !(unreadable[table.name] ?? []).includes(field.name))
      .map((field) => ({
        name: field.name,
        ...(field.label !== undefined && {
          label: resolveTranslationPattern(field.label, lang, config.languages),
        }),
      })),
  }))
}

/**
 * Renderer for the `command` component: the ⌘K palette, synthesized on every
 * page unless the app opts out or the page places its own.
 *
 * The BUILT-IN mode emits two things: a JSON config block (tables + their text
 * fields + navigable pages + the dialog's words) and a DEFERRED island host.
 * The host is `data-island-deferred`, not `data-island`, so nothing mounts and
 * nothing loads until a reader opens the palette: the head capture script turns
 * it into a `data-island` on the first ⌘K (see `COMMAND_PALETTE_CAPTURE_SCRIPT`).
 * No overlay, dialog or input is pre-rendered: a `role="dialog"` and a search
 * field on every page would be a second match for every unrelated selector.
 */
export const commandPaletteComponent: ComponentRenderer = (
  config: ComponentDispatchConfig
): ReactElement => {
  const search = resolveSearchMode(config.component)
  const specimenQuery = specimenQueryOf(config.component)
  if (search !== undefined && specimenQuery === undefined) {
    return renderSearchPalette(search, {
      hints: paletteHints(config),
      tableLabels: tableLabelsOf(config.component),
      groups: authoredGroupsOf(config),
      kinds: searchKindWords(config, search.kindLabels),
      pages: navPagesOf(config.component),
      strings: searchActionWords(config),
    })
  }

  const authored =
    specimenQuery === undefined ? renderAuthoredGroups(config, paletteHints(config)) : undefined
  if (authored !== undefined) return authored
  const tables = paletteTables(config)
  const componentProps = (config.component?.props ?? {}) as { readonly pages?: PalettePage[] }
  const pages = Array.isArray(componentProps.pages) ? componentProps.pages : []
  if (specimenQuery !== undefined) return renderSpecimenOverlay(tables, pages, specimenQuery)
  const paletteConfig = {
    tables,
    pages: pages.map((page) => ({ name: page.name, path: page.path, title: page.title })),
    strings: paletteStrings(config),
  }
  // `serializeJsonForScript` escapes `<` so a value containing `</script>`
  // cannot break out of the JSON config `<script>` block. It is the shared
  // serializer every script-body emission in src/ uses, not a local one-off.
  const paletteConfigJson = serializeJsonForScript(paletteConfig)
  return (
    <>
      <script
        type="application/json"
        data-command-palette-config="true"
        dangerouslySetInnerHTML={{ __html: paletteConfigJson }}
      />
      <div
        data-island-deferred="command"
        data-component-type="command"
        data-island-props={serializeJsonForScript({ hints: paletteHints(config) })}
        className="hidden"
      >
        <span className="sr-only" />
      </div>
    </>
  )
}
