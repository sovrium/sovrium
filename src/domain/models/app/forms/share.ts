/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const ShareOptionsSchema = Schema.Struct({
  embeddable: Schema.optional(
    Schema.Boolean.annotations({
      description: 'When true, /forms/{name}/embed is served',
    })
  ),
  allowedOrigins: Schema.optional(
    Schema.Array(
      Schema.String.pipe(
        Schema.pattern(/^https?:\/\/[^/]+$/, {
          message: () => 'Allowed origin must be a scheme://host (no path)',
        })
      )
    ).annotations({
      description: 'Origins allowed to embed via iframe (frame-ancestors header)',
    })
  ),
  password: Schema.optional(
    Schema.String.pipe(Schema.minLength(1)).annotations({
      description: 'Optional password gate (Phase 3)',
    })
  ),
}).annotations({
  identifier: 'ShareOptions',
  title: 'Share Options',
  description: 'Controls iframe embedding and external sharing for a form',
})

export type ShareOptions = Schema.Schema.Type<typeof ShareOptionsSchema>
