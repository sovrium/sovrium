/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const PaletteSchema = Schema.Struct({
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

export type Palette = Schema.Schema.Type<typeof PaletteSchema>

export type PaletteEncoded = Schema.Schema.Encoded<typeof PaletteSchema>
