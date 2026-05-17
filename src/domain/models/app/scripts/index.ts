/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ExternalScriptSchema, InlineScriptSchema } from '@/domain/models/app/pages/scripts'

/**
 * App-Level Scripts Schema
 *
 * Global scripts that load on all pages before page-level scripts.
 * Used for analytics, tracking, and global configuration.
 *
 * Reuses the same ExternalScriptSchema and InlineScriptSchema as page-level
 * scripts to ensure consistent configuration (position, async, defer, module,
 * integrity, crossorigin).
 */
export const AppScriptsSchema = Schema.Struct({
  /** External scripts loaded from CDN or other URLs */
  external: Schema.optional(
    Schema.Array(ExternalScriptSchema).pipe(
      Schema.annotations({ description: 'External scripts loaded from URLs' })
    )
  ),

  /** Inline JavaScript code snippets */
  inline: Schema.optional(
    Schema.Array(InlineScriptSchema).pipe(
      Schema.annotations({ description: 'Inline JavaScript code snippets' })
    )
  ),

  /** Global configuration object accessible from scripts */
  config: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }).pipe(
      Schema.annotations({ description: 'Global configuration object for scripts' })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'AppScripts',
    title: 'App-Level Scripts',
    description: 'Global scripts loaded on all pages (analytics, tracking, configuration)',
  })
)

/** @public */
export type AppScripts = typeof AppScriptsSchema.Type
