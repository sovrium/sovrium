/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const AppSchemaEnvSchema = Schema.Struct({
  appSchema: Schema.optional(
    Schema.String.pipe(
      Schema.minLength(1),
      Schema.annotations({
        description: 'App schema as inline JSON, inline YAML, or remote URL (APP_SCHEMA)',
        examples: ['{"name":"my-app"}', 'name: my-app', 'https://example.com/app-config.yaml'],
      })
    )
  ),
})

export type AppSchemaEnvConfig = Schema.Schema.Type<typeof AppSchemaEnvSchema>

export const parseAppSchemaEnvConfig = (): AppSchemaEnvConfig =>
  Schema.decodeUnknownSync(AppSchemaEnvSchema)({
    appSchema: process.env.APP_SCHEMA,
  })
