/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The ⌘K palette's own words, resolved on the server in the page language and
 * stamped into what the island reads: the create dialog's labels, the
 * keyboard-hint footer, and a search palette's table names.
 */

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
