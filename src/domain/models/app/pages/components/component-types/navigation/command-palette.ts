/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { coreFields } from '../modules/core'
import { visibilityFields } from '../modules/visibility'

export const CommandPaletteTypeLiteral = Schema.Literal('command-palette')

/**
 * The palette's SEARCH mode: point ⌘K at a read endpoint instead of at the
 * built-in "go to page / create a record" quick actions.
 *
 * Two palettes cannot share one ⌘K — both would open on the same keystroke —
 * so this is a mode, not an addition. Declaring `search` replaces the built-in
 * quick-action runtime with a search affordance backed by `endpoint`; omitting
 * it keeps the built-in palette.
 *
 * The endpoint is called with `?q=<term>` appended and `credentials: 'include'`,
 * and answers results ALREADY GROUPED:
 * `{ query, groups: [{ type, results: [{ type, entityId, title, href, updatedAt }] }] }`.
 * `title` is the row's text and `href` its navigation target; `kindLabels` names
 * each GROUP's `type` for the heading, so a result list reads "Records / Forms"
 * rather than "record / form". Anything that is not a 200 of that shape renders
 * the no-results state.
 *
 * @example
 * ```yaml
 * - type: command-palette
 *   search:
 *     endpoint: /api/admin/search
 *     placeholder: $t:palette.placeholder
 *     kindLabels:
 *       record: Records
 *       form: Forms
 * ```
 */
export const CommandPaletteSearchSchema = Schema.Struct({
  /** Read endpoint the palette queries as the visitor types */
  endpoint: Schema.String.pipe(
    Schema.annotate({
      description: 'Read endpoint the palette queries as the visitor types',
      examples: ['/api/admin/search', '/api/search'],
    }),
    Schema.check(
      Schema.isMinLength(1),
      Schema.isPattern(/^\//, {
        message:
          'command-palette search endpoint must be a path starting with / — the palette queries this instance, never another origin',
      })
    )
  ),
  /** Input placeholder; accepts a `$t:` translation key */
  placeholder: Schema.optional(
    Schema.String.annotate({
      description: 'Search input placeholder; accepts a $t: translation key',
      examples: ['Search everything', '$t:palette.placeholder'],
    })
  ),
  /**
   * Group heading per result group `type`.
   *
   * A group's `type` is a machine token (`record`, `form`); a heading is a
   * human noun. Without the map the headings print the token, which reads as
   * an internal name leaking into the UI.
   */
  kindLabels: Schema.optional(
    Schema.Record(Schema.String, Schema.String).annotate({
      description:
        "Map of a result group's `type` to the heading shown above it; values accept $t: keys. An unmapped type prints as itself.",
    })
  ),
}).annotate({
  identifier: 'CommandPaletteSearch',
  title: 'Command Palette Search',
  description: 'Point the ⌘K palette at a read endpoint instead of the built-in quick actions',
})

/** @public */
export type CommandPaletteSearch = Schema.Schema.Type<typeof CommandPaletteSearchSchema>

/**
 * The global ⌘K command palette, placed by the author.
 *
 * ─── WHY THIS IS AUTHORABLE AND STILL SYNTHESIZED ──────────────────────────
 *
 * The engine appends a palette to every page so ⌘K works app-wide with no
 * authoring at all, and `palette: { enabled: false }` opts the whole app out.
 * Those two states are the entire vocabulary an author had, and neither can
 * say "the palette on THIS page searches MY endpoint" — so an app that wanted
 * its own search overlay had to disable the platform one and hand-build a
 * replacement.
 *
 * Declaring the component is the third state: the page carries exactly the
 * palette it declared, and the engine appends nothing (two palettes on one ⌘K
 * is the defect this replaces, not a feature).
 *
 * ─── IT RENDERS NO VISIBLE MARKUP ──────────────────────────────────────────
 *
 * The palette builds its overlay lazily in the browser on the first ⌘K and
 * caches it. Server-side it emits only a JSON config block and its runtime —
 * pre-rendering a `role="dialog"` and a `role="searchbox"` into every page
 * would put two of each into the document for every unrelated selector to
 * resolve. That is also why it carries no engine-owned element to restyle, and
 * so is absent from `ENGINE_COMPONENT_TYPES`: a `design.components` entry for
 * it could only ever be a no-op.
 */
export const commandPaletteFields = {
  ...coreFields,
  ...visibilityFields,
  /**
   * Point the palette at a read endpoint instead of the built-in quick
   * actions. See {@link CommandPaletteSearchSchema}.
   */
  search: Schema.optional(CommandPaletteSearchSchema),
} as const
