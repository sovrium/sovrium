/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * PaletteSchema configures the platform-synthesized command palette
 * (the global Cmd+K / Ctrl+K search overlay that Sovrium appends to every page).
 *
 * The palette is enabled by default. Operators only need this block to opt out —
 * for example when an app ships its OWN search modal bound to Cmd+K and wants to
 * avoid two overlays opening on the same keystroke (the docs app's case).
 *
 * @example
 * ```typescript
 * // Disable the platform palette (app provides its own Cmd+K modal)
 * palette: { enabled: false }
 * ```
 */
export const PaletteSchema = Schema.Struct({
  /**
   * Whether the platform command-palette component is appended to every page
   * and its Cmd+K / Ctrl+K keybinding is registered.
   *
   * Defaults to `true`. Set to `false` to suppress the palette entirely — the
   * component is not rendered and no global keybinding is bound, leaving Cmd+K
   * free for an app-provided search overlay.
   */
  enabled: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({
        description: 'Enable the platform Cmd+K command palette (default: true)',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'Palette',
    title: 'Command Palette Configuration',
    description:
      'Configuration for the platform-synthesized Cmd+K command palette appended to every page. Use { enabled: false } to opt out when the app ships its own search overlay.',
    examples: [{ enabled: false }],
  })
)

/**
 * TypeScript type inferred from PaletteSchema.
 * @public
 */
export type Palette = Schema.Schema.Type<typeof PaletteSchema>

/**
 * Encoded type of PaletteSchema (what goes in).
 * @public
 */
export type PaletteEncoded = Schema.Schema.Encoded<typeof PaletteSchema>
