/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The component types renamed to the name shadcn/ui gives the same component.
 *
 * Each old name is refused with a sentence naming the new one; nothing but the
 * `type` changes, so renaming it is the whole migration. Read by
 * `retired-types.ts`, which owns the refusal.
 *
 * Two of the old names returned with shadcn's own meaning: `drawer` is the
 * panel rising from the bottom edge, and `calendar` the month of days to pick
 * from. Neither is listed here; the keys of their old meanings are refused on
 * the new types (`repurposed-removed-keys.ts`), naming `sheet` and
 * `event-calendar`.
 */

/** One renamed type: the old name, the new name, and what the component is. */
const RENAMED: readonly (readonly [string, string, string])[] = [
  ['divider', 'separator', 'a hairline between two things'],
  ['empty-state', 'empty', 'what a view says when it has nothing to show'],
  ['list-item', 'item', 'one row of a list'],
  ['split-pane', 'resizable', 'two panels with a draggable handle between them'],
  ['command-palette', 'command', 'a search across everything, opened from the keyboard'],
]

/** The renamed types as retirement entries: `[old name, { replacement, message }]`. */
export const RENAMED_COMPONENT_TYPES: readonly (readonly [
  string,
  { readonly replacement: string; readonly message: string },
])[] = RENAMED.map(
  ([name, replacement, what]) =>
    [
      name,
      {
        replacement,
        message: [
          `\`${name}\` is now \`${replacement}\`, ${what}: the name shadcn/ui gives it.`,
          '',
          `Migration: rename the \`type\` to \`${replacement}\` and change nothing else; every key`,
          'carries over unchanged.',
        ].join('\n'),
      },
    ] as const
)
