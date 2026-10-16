/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The built-in palette's data: the config the page publishes, the quick
 * actions derived from it, and the record and page matches the search endpoint
 * answers. Pure apart from {@link readPaletteConfig} and {@link fetchCommandMatches}.
 */

/**
 * One table the create dialog can add a record to, with its text columns.
 * `label` (one record) and `labelPlural` (the collection) are the person's
 * words, resolved server-side; `name` is the address.
 */
export interface PaletteTable {
  readonly name: string
  readonly label?: string
  readonly labelPlural?: string
  readonly fields: ReadonlyArray<{ readonly name: string; readonly label?: string }>
}

/** One page the palette can go to. */
export interface PalettePage {
  readonly name: string
  readonly path: string
  readonly title: string
}

/** What the page publishes in `[data-command-palette-config]`. */
export interface PaletteConfig {
  readonly tables: ReadonlyArray<PaletteTable>
  readonly pages: ReadonlyArray<PalettePage>
  readonly strings: Readonly<Record<string, string>>
}

/** A quick action. `action` is `create-record:<table>`, `navigate` or `toggle-dark-mode`. */
export interface QuickAction {
  readonly label: string
  readonly action: string
  readonly href?: string
}

/** One match `GET /api/command-search` answers. */
export interface CommandMatch {
  readonly label: string
  readonly entityType?: string
  readonly tableName?: string
  readonly detailPath?: string
  readonly favorited?: boolean
  readonly excerpt?: string
  readonly matchRange?: readonly [number, number]
}

/** Mirrors the server's selectivity floor: a shorter query is answered with nothing. */
export const MIN_QUERY_LENGTH = 2

const EMPTY_CONFIG: PaletteConfig = { tables: [], pages: [], strings: {} }

const arrayOr = <T>(value: unknown): readonly T[] =>
  Array.isArray(value) ? (value as readonly T[]) : []

/** Read the config block the page published; an absent or broken one reads as empty. */
export function readPaletteConfig(): PaletteConfig {
  const text = document.querySelector('[data-command-palette-config]')?.textContent
  if (!text) return EMPTY_CONFIG
  try {
    const parsed = JSON.parse(text) as Partial<PaletteConfig>
    return {
      tables: arrayOr<PaletteTable>(parsed.tables),
      pages: arrayOr<PalettePage>(parsed.pages),
      strings: typeof parsed.strings === 'object' && parsed.strings !== null ? parsed.strings : {},
    }
  } catch {
    return EMPTY_CONFIG
  }
}

/** One "create" per table, one "go to" per page, and the dark-mode toggle. */
export function quickActions(config: PaletteConfig): readonly QuickAction[] {
  const { strings } = config
  const createIn = strings['createIn'] ?? 'Create new record in {table}'
  const goTo = strings['goTo'] ?? 'Go to {page}'
  return [
    ...config.tables.map((table) => ({
      label: createIn.split('{table}').join(table.labelPlural ?? table.name),
      action: `create-record:${table.name}`,
    })),
    ...config.pages.map((page) => ({
      label: goTo.split('{page}').join(page.title.length > 0 ? page.title : page.name),
      action: 'navigate',
      href: page.path,
    })),
    { label: strings['toggleDarkMode'] ?? 'Toggle dark mode', action: 'toggle-dark-mode' },
  ]
}

/**
 * A quick action matches when every whitespace-separated token of the query
 * appears in its label, so "new task" matches "Create new record in tasks".
 */
export function actionMatchesQuery(label: string, query: string): boolean {
  const haystack = label.toLowerCase()
  return query
    .toLowerCase()
    .split(/\s+/)
    .every((token) => token.length === 0 || haystack.includes(token))
}

/** The record matches grouped by table, in the order their tables first appear. */
export function groupRecordMatches(
  matches: readonly CommandMatch[]
): ReadonlyArray<{ readonly table: string; readonly matches: readonly CommandMatch[] }> {
  const tables = [...new Set(matches.map((match) => match.tableName ?? ''))]
  return tables.map((table) => ({
    table,
    matches: matches.filter((match) => (match.tableName ?? '') === table),
  }))
}

/** The create dialog's title for a table, in the page language, by its singular label. */
export function createTitle(config: PaletteConfig, table: string): string {
  const named = config.tables.find((candidate) => candidate.name === table)?.label ?? table
  return (config.strings['createTitle'] ?? 'New {table} record').split('{table}').join(named)
}

/**
 * The matches for `query`, or an empty list for any failure: a refused or
 * rate-limited request reads as "nothing found", which is all a palette can
 * honestly say about it.
 */
export async function fetchCommandMatches(query: string): Promise<readonly CommandMatch[]> {
  try {
    const response = await fetch(`/api/command-search?q=${encodeURIComponent(query)}`, {
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) return []
    const body = (await response.json()) as unknown
    return arrayOr<CommandMatch>(body).filter((match) => typeof match?.label === 'string')
  } catch {
    return []
  }
}
