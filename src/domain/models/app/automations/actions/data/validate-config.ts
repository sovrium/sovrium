/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

/**
 * Data Validate-Config Action (type: data, operator: validate-config)
 *
 * GAP-J2: decodes a submitted config string against AppSchema via the platform's
 * own decode path (the same one `sovrium validate` uses) and exposes
 * `{ valid: boolean, errors: string[] }` on its step output so later steps can
 * branch on `{{steps.<name>.valid}}` / `{{steps.<name>.errors}}`.
 *
 * Decode-only: no side effects, no boot. The Cloud business app's Configuration
 * tab uses this to validate submitted tenant configs before persisting outcome.
 */
export const DataValidateConfigActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('data'),
  operator: Schema.Literal('validate-config'),
  props: Schema.Struct({
    /** Config string to decode against AppSchema (supports templates). */
    config: TemplateStringSchema.pipe(
      Schema.annotations({
        description: 'Config string to decode against AppSchema (supports templates)',
      })
    ),
    /**
     * Serialization of the config string. Defaults to JSON. `yaml` parses the
     * string via the native YAML parser before decoding.
     */
    format: Schema.optional(
      Schema.Literal('json', 'yaml').pipe(
        Schema.annotations({
          description: 'Config string format — json (default) or yaml',
        })
      )
    ),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'DataValidateConfigAction',
    title: 'Data Validate-Config Action',
    description: 'Decode a config string against AppSchema and expose { valid, errors }',
  })
)

/** @public */
export type DataValidateConfigAction = Schema.Schema.Type<typeof DataValidateConfigActionSchema>
