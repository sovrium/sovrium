/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'


export const AnalyticsProviderNameSchema = Schema.Literal(
  'google',
  'plausible',
  'matomo',
  'fathom',
  'posthog',
  'mixpanel'
).annotations({
  description: 'Analytics provider name',
})

export const AnalyticsScriptSchema = Schema.Struct({
  src: Schema.String.annotations({
    description: 'Script source URL',
    format: 'uri',
  }),
  async: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Load script asynchronously',
      default: true,
    })
  ),
  defer: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Defer script execution',
    })
  ),
}).annotations({
  description: 'Analytics script',
})

export const AnalyticsProviderSchema = Schema.Struct({
  name: AnalyticsProviderNameSchema,
  enabled: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Whether this provider is enabled',
      default: true,
    })
  ),
  scripts: Schema.optional(Schema.Array(AnalyticsScriptSchema)),
  initScript: Schema.optional(
    Schema.String.annotations({
      description: 'Inline JavaScript to initialize the analytics',
    })
  ),
  dnsPrefetch: Schema.optional(
    Schema.String.annotations({
      description: 'Domain to DNS prefetch for this provider',
      format: 'uri',
    })
  ),
  config: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: Schema.Unknown,
    }).annotations({
      description: 'Provider-specific configuration',
    })
  ),
}).annotations({
  description: 'Analytics provider',
})

export const AnalyticsSchema = Schema.Struct({
  providers: Schema.Array(AnalyticsProviderSchema),
}).annotations({
  title: 'Analytics Configuration',
  description: 'Configuration for analytics providers',
})

export type AnalyticsProviderName = Schema.Schema.Type<typeof AnalyticsProviderNameSchema>
export type AnalyticsScript = Schema.Schema.Type<typeof AnalyticsScriptSchema>
export type AnalyticsProvider = Schema.Schema.Type<typeof AnalyticsProviderSchema>
export type Analytics = Schema.Schema.Type<typeof AnalyticsSchema>
