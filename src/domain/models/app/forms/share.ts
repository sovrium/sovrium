/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Share Options — controls iframe embedding and external sharing.
 *
 * - `embeddable`: when true, `/forms/{name}/embed` is enabled.
 * - `allowedOrigins`: list of origins allowed to embed (used to set
 *   `Content-Security-Policy: frame-ancestors`). Default disallows all.
 * - `password`: optional password gate (Phase 3 — stub today).
 */
export const ShareOptionsSchema = Schema.Struct({
  /** Whether the embed route is enabled. */
  embeddable: Schema.optional(
    Schema.Boolean.annotations({
      description: 'When true, /forms/{name}/embed is served',
    })
  ),
  /**
   * Origins allowed to iframe-embed this form. Set the
   * `Content-Security-Policy: frame-ancestors` header from this list.
   */
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
  /** Password gate (Phase 3). */
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

/** @public */
export type ShareOptions = Schema.Schema.Type<typeof ShareOptionsSchema>
