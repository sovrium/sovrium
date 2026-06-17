/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

export const DataValidateConfigActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('data'),
  operator: Schema.Literal('validate-config'),
  props: Schema.Struct({
    config: TemplateStringSchema.pipe(
      Schema.annotations({
        description: 'Config string to decode against AppSchema (supports templates)',
      })
    ),
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

export type DataValidateConfigAction = Schema.Schema.Type<typeof DataValidateConfigActionSchema>
