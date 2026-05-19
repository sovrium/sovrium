/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'


export const FeatureConfigSchema = Schema.Struct({
  enabled: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Whether the feature is enabled',
    })
  ),
  config: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: Schema.Unknown,
    }).annotations({
      description: 'Feature-specific configuration data',
    })
  ),
}).annotations({
  description: 'Feature configuration with enabled flag and custom config',
})

export const FeatureValueSchema = Schema.Union(
  Schema.Boolean.annotations({
    description: 'Simple feature flag',
  }),
  FeatureConfigSchema
).annotations({
  description: 'Feature value - either a boolean flag or a configuration object',
})

export const FeaturesSchema = Schema.Record({
  key: Schema.String.pipe(
    Schema.pattern(/^[a-zA-Z][a-zA-Z0-9]*$/, {
      message: () =>
        'Feature name must be camelCase starting with a letter (e.g., darkMode, liveChat, cookieConsent)',
    })
  ),
  value: FeatureValueSchema,
}).annotations({
  title: 'Feature Flags',
  description: 'Client-side feature toggles',
})

export type FeatureConfig = Schema.Schema.Type<typeof FeatureConfigSchema>
export type FeatureValue = Schema.Schema.Type<typeof FeatureValueSchema>
export type Features = Schema.Schema.Type<typeof FeaturesSchema>


export const CrossOriginSchema = Schema.Literal('anonymous', 'use-credentials').annotations({
  description: 'CORS setting for cross-origin scripts',
})

export const ScriptPositionSchema = Schema.Literal('head', 'body-start', 'body-end').annotations({
  description: 'Where to insert the script in the document',
})

export const ExternalScriptSchema = Schema.Struct({
  src: Schema.String.annotations({
    description: 'Script source URL',
    format: 'uri',
  }),
  async: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Load script asynchronously',
      default: false,
    })
  ),
  defer: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Defer script execution',
      default: false,
    })
  ),
  module: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Load as ES module',
      default: false,
    })
  ),
  integrity: Schema.optional(
    Schema.String.annotations({
      description: 'Subresource integrity hash',
    })
  ),
  crossorigin: Schema.optional(CrossOriginSchema),
  position: Schema.optional(ScriptPositionSchema),
}).annotations({
  description: 'External JavaScript dependency',
})

export const ExternalScriptsSchema = Schema.Array(ExternalScriptSchema).annotations({
  title: 'External Scripts',
  description: 'External JavaScript dependencies',
})

export type CrossOrigin = Schema.Schema.Type<typeof CrossOriginSchema>
export type ScriptPosition = Schema.Schema.Type<typeof ScriptPositionSchema>
export type ExternalScript = Schema.Schema.Type<typeof ExternalScriptSchema>
export type ExternalScripts = Schema.Schema.Type<typeof ExternalScriptsSchema>


export const InlineScriptSchema = Schema.Struct({
  code: Schema.String.annotations({
    description: 'JavaScript code to execute',
  }),
  position: Schema.optional(ScriptPositionSchema),
  async: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Wrap in async IIFE',
      default: false,
    })
  ),
}).annotations({
  description: 'Inline JavaScript code snippet',
})

export const InlineScriptsSchema = Schema.Array(InlineScriptSchema).annotations({
  title: 'Inline Scripts',
  description: 'Inline JavaScript code snippets',
})

export type InlineScript = Schema.Schema.Type<typeof InlineScriptSchema>
export type InlineScripts = Schema.Schema.Type<typeof InlineScriptsSchema>


export const ScriptsSchema = Schema.Struct({
  features: Schema.optional(FeaturesSchema),
  externalScripts: Schema.optional(ExternalScriptsSchema),
  external: Schema.optional(ExternalScriptsSchema),
  inlineScripts: Schema.optional(InlineScriptsSchema),
  config: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: Schema.Unknown,
    }).annotations({
      description: 'Client-side configuration data',
    })
  ),
}).annotations({
  title: 'Client Scripts Configuration',
  description: 'Client-side scripts, features, and external dependencies',
})

export type Scripts = Schema.Schema.Type<typeof ScriptsSchema>
