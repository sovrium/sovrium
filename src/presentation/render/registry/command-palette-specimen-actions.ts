/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/** Minimal navigable-page shape the specimen's quick actions are built from. */
interface SpecimenPage {
  readonly name: string
  readonly path: string
  readonly title: string
}

/** One quick action, as the island's `quickActions()` builds it. */
export interface QuickAction {
  readonly label: string
  readonly action: string
}

/**
 * The quick-action catalogue, derived from the SAME config the live palette
 * reads: one "create" per table, one "go to" per navigable page, and the
 * unconditional dark-mode toggle. A transcription of `quickActions()` in
 * `islands/command/command-actions-data.ts`: a render module may not import an
 * island, and the alternative, rows invented here, would document this file
 * instead of the palette.
 */
export const specimenQuickActions = (
  tables: ReadonlyArray<{ readonly name: string; readonly labelPlural: string }>,
  pages: ReadonlyArray<SpecimenPage>
): readonly QuickAction[] => [
  ...tables.map((table) => ({
    label: `Create new record in ${table.labelPlural}`,
    action: `create-record:${table.name}`,
  })),
  ...pages.map((page) => ({
    label: `Go to ${page.title.length > 0 ? page.title : page.name}`,
    action: 'navigate',
  })),
  { label: 'Toggle dark mode', action: 'toggle-dark-mode' },
]

/** Every whitespace-separated token appears in the label: `actionMatchesQuery`, transcribed. */
export const specimenActionMatches = (label: string, query: string): boolean => {
  const haystack = label.toLowerCase()
  return query
    .toLowerCase()
    .split(/\s+/)
    .every((token) => token.length === 0 || haystack.includes(token))
}
