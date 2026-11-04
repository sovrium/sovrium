/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'

/** The signing flow a step acts on, by name. */
export const signatureFlowProp = Schema.String.pipe(
  Schema.annotate({
    description: 'Name of a signing flow declared under signatures.',
    examples: ['employment_contract'],
  }),
  Schema.check(Schema.isMinLength(1))
)

/** The record a step acts on; the run's own record when left out. */
export const signatureRecordIdProp = Schema.optional(
  TemplateStringSchema.pipe(
    Schema.annotate({
      defaultNote: '{{trigger.record.id}}',
      description:
        "Id of the record of the flow's table the request is for. Left out, the record that started the run.",
      examples: ['{{trigger.record.id}}', '{{create_contract.record.id}}'],
    })
  )
)
