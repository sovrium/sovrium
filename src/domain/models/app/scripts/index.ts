/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ExternalScriptSchema, InlineScriptSchema } from '@/domain/models/app/pages/scripts'

export const AppScriptsSchema = Schema.Struct({
  external: Schema.optional(
    Schema.Array(ExternalScriptSchema).pipe(
      Schema.annotations({ description: 'External scripts loaded from URLs' })
    )
  ),

  inline: Schema.optional(
    Schema.Array(InlineScriptSchema).pipe(
      Schema.annotations({ description: 'Inline JavaScript code snippets' })
    )
  ),

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

export type AppScripts = typeof AppScriptsSchema.Type
