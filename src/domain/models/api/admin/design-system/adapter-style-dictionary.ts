/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

/**
 * Contract for a Style Dictionary `config.json` (Style Dictionary 5).
 *
 * The bundle's Style Dictionary adapter writes two:
 * `adapters/style-dictionary/config.json` for the light tokens, and
 * `adapters/style-dictionary/config.dark.json` for the dark ones, whose
 * `css/variables` file is scoped by `options.selector: ".dark"`. Style
 * Dictionary has no modes, so each config reads one document. Neither carries
 * a token of its own: its `source` globs point at the bundle's `tokens/`
 * documents, relative to the config, so running Style Dictionary on the bundle
 * builds from the same tokens every other adapter was projected from.
 *
 * Style Dictionary reads token sources in two forms, legacy `value`/`type` and
 * DTCG `$value`/`$type`, never mixed in one run. The import side reads both;
 * see the token-tree shapes of the import report.
 */

/** One output file of a platform. */
export const styleDictionaryFileSchema = Schema.Struct({
  destination: Schema.String.annotate({
    description: 'The file name written under the platform `buildPath`',
    examples: ['variables.css'],
  }),
  format: Schema.String.annotate({
    description: 'The Style Dictionary format',
    examples: ['css/variables', 'javascript/es6'],
  }),
  filter: optionalField(Schema.Unknown.annotate({ description: 'A token filter' })),
  options: optionalField(
    Schema.Record(Schema.String, Schema.Unknown).annotate({ description: 'Format options' })
  ),
}).annotate({ identifier: 'StyleDictionaryFile' })

/** One build platform. */
export const styleDictionaryPlatformSchema = Schema.Struct({
  transformGroup: optionalField(
    Schema.String.annotate({ description: 'A built-in transform group', examples: ['css'] })
  ),
  transforms: optionalField(
    Schema.Array(Schema.String).annotate({ description: 'Transforms, by name' })
  ),
  buildPath: optionalField(
    Schema.String.annotate({ description: 'The output directory, ending in `/`' })
  ),
  prefix: optionalField(Schema.String.annotate({ description: 'A variable prefix' })),
  files: optionalField(
    Schema.Array(styleDictionaryFileSchema).annotate({ description: 'The files to write' })
  ),
}).annotate({ identifier: 'StyleDictionaryPlatform' })

/**
 * A Style Dictionary `config.json`.
 *
 * @public The adapter types both of its configs with the inferred type; the
 * schema value decodes them in the tests that hold the adapter's output.
 */
export const styleDictionaryConfigSchema = Schema.Struct({
  source: Schema.Array(Schema.String)
    .annotate({
      description: 'Token source paths or globs, relative to the config',
      examples: [['../../tokens/base.tokens.json']],
    })
    .check(Schema.isMinLength(1)),
  include: optionalField(
    Schema.Array(Schema.String).annotate({
      description: 'Paths read before `source`, which `source` overrides',
    })
  ),
  platforms: Schema.Record(Schema.String, styleDictionaryPlatformSchema).annotate({
    description: 'Platform name to its build settings',
  }),
}).annotate({ identifier: 'StyleDictionaryConfig' })

/** @public */
export type StyleDictionaryConfig = typeof styleDictionaryConfigSchema.Type
