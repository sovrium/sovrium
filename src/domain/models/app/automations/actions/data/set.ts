/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

export const DataSetActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('data'),
  operator: Schema.Literal('set'),
  props: Schema.Struct({
    value: TemplateStringSchema.pipe(
      Schema.annotations({
        description: 'Value to compute and expose as steps.<name>.value (supports templates)',
      })
    ),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'DataSetAction',
    title: 'Data Set Action',
    description: 'Compute a value and expose it for downstream actions',
  })
)

export type DataSetAction = Schema.Schema.Type<typeof DataSetActionSchema>
