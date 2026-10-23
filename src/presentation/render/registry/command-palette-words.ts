/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The ⌘K palette's own words, resolved on the server in the page language and
 * stamped into what the island reads: the create dialog's labels, the
 * keyboard-hint footer, and a search palette's table names and kind words.
 */

import { adminSearchEntityTypes } from '@/domain/models/api/admin/search/search'
import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'
import type { ComponentDispatchConfig } from './component-dispatch-config'

/**
 * The create dialog's own words in the page language, stamped into the inline
 * runtime's config as the confirm gate's labels are. `{table}` is filled there.
 */
export const paletteStrings = (
  config: ComponentDispatchConfig
): Readonly<Record<string, string>> => {
  const resolve = (key: string) =>
    resolveInterpreterString(key, config.currentLang ?? config.languages?.default, config.languages)
  return {
    createTitle: resolve('commandPalette.createTitle'),
    create: resolve('commandPalette.create'),
    cancel: resolve('commandPalette.cancel'),
    ...Object.fromEntries(BUILT_IN_WORDS.map((word) => [word, resolve(`commandPalette.${word}`)])),
  }
}

/**
 * The built-in palette's own words beyond the create dialog's: its search
 * field, its two groups, its quick actions (`{table}` and `{page}` filled
 * there) and the toast the colour-scheme toggle ends with.
 */
const BUILT_IN_WORDS = [
  'search',
  'searchPlaceholder',
  'quickActions',
  'pages',
  // The one group every record match is listed in, each naming its table.
  'kind.record',
  'createIn',
  'goTo',
  'toggleDarkMode',
  'darkModeOn',
  'lightModeOn',
] as const

/**
 * The palette words every mode reads (`commandPalette.<word>`): its name, the
 * search and command fields, the empty and searching lines. They ride with the
 * keyboard-hint words, which every mode's host already stamps.
 */
const PALETTE_WORDS = [
  'title',
  'search',
  'searchAll',
  'commandPlaceholder',
  'commandLabel',
  'empty',
  'startTyping',
  'searching',
  'noResultsFor',
] as const

/** The keyboard-hint footer's words and the palette's own, in the page language. */
export type PaletteHints = Readonly<
  Record<'navigate' | 'open' | 'close' | (typeof PALETTE_WORDS)[number], string>
>

/** The command's keyboard-hint words (`commandPalette.hint*`) and its own, in the page language. */
export const paletteHints = (config: ComponentDispatchConfig): PaletteHints => {
  const resolve = (key: string) =>
    resolveInterpreterString(key, config.currentLang ?? config.languages?.default, config.languages)
  return {
    navigate: resolve('commandPalette.hintNavigate'),
    open: resolve('commandPalette.hintOpen'),
    close: resolve('commandPalette.hintClose'),
    ...(Object.fromEntries(
      PALETTE_WORDS.map((word) => [word, resolve(`commandPalette.${word}`)])
    ) as Record<(typeof PALETTE_WORDS)[number], string>),
  }
}

/**
 * Each readable table's plural label, by its name — stamped by the page pass
 * (`withSearchTableLabels`), which holds the app the palette searches.
 */
export const tableLabelsOf = (
  component: ComponentDispatchConfig['component']
): Readonly<Record<string, string>> => {
  const stamped = (component as { readonly props?: Record<string, unknown> } | undefined)?.props?.[
    '_tableLabels'
  ]
  return typeof stamped === 'object' && stamped !== null
    ? (stamped as Readonly<Record<string, string>>)
    : {}
}

/**
 * A search palette's kind words in the page language: the group heading
 * (`commandPalette.kind.<kind>`) and the row badge (`commandPalette.kindOne.<kind>`)
 * for every kind the console search returns. The index stores a kind as its
 * key, so it is named here, per request, in the reader's language. A heading
 * the config writes under `search.kindLabels` wins over the built-in one.
 */
export const searchKindWords = (
  config: ComponentDispatchConfig,
  authored: Readonly<Record<string, string>> | undefined
): {
  readonly kindLabels: Readonly<Record<string, string>>
  readonly kindBadges: Readonly<Record<string, string>>
} => {
  const resolve = (key: string) =>
    resolveInterpreterString(key, config.currentLang ?? config.languages?.default, config.languages)
  const wordsFor = (prefix: string) =>
    Object.fromEntries(
      adminSearchEntityTypes.map((kind) => [kind, resolve(`commandPalette.${prefix}.${kind}`)])
    )
  return {
    kindLabels: { ...wordsFor('kind'), ...authored },
    kindBadges: wordsFor('kindOne'),
  }
}

/** The pages a search palette matches, stamped by the page pass (`props._navPages`). */
export const navPagesOf = (
  component: ComponentDispatchConfig['component']
): ReadonlyArray<{ readonly name: string; readonly path: string; readonly title: string }> => {
  const stamped = (component as { readonly props?: Record<string, unknown> } | undefined)?.props?.[
    '_navPages'
  ]
  return Array.isArray(stamped)
    ? (stamped as ReadonlyArray<{
        readonly name: string
        readonly path: string
        readonly title: string
      }>)
    : []
}

/** The built-in words a search palette's Pages and Quick actions groups speak. */
const SEARCH_ACTION_WORDS = ['pages', 'quickActions', 'toggleDarkMode', 'darkModeOn', 'lightModeOn']

export const searchActionWords = (
  config: ComponentDispatchConfig
): Readonly<Record<string, string>> => {
  const strings = paletteStrings(config)
  return Object.fromEntries(
    SEARCH_ACTION_WORDS.flatMap((word) => {
      const value = strings[word]
      return value === undefined ? [] : [[word, value]]
    })
  )
}
