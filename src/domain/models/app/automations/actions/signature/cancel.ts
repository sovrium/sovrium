/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'
import { signatureFlowProp, signatureRecordIdProp } from './props'

/**
 * Signature Action (type: signature, operator: cancel)
 *
 * Cancel the open signing request a record has for a flow: every unused link
 * stops working at once, signatures already given stay in the evidence, and
 * the request ends `cancelled`. A record with no open request is a no-op.
 */
export const SignatureCancelActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('signature').pipe(
    Schema.annotate({
      description: "Constant value 'signature' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('cancel').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'signature' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    flow: signatureFlowProp,
    recordId: signatureRecordIdProp,
    reason: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          description:
            'Why the request is cancelled, recorded in the evidence and passed to signature triggers. A signer who opens her link sees the not-found page, which gives no reason.',
          examples: ['The contract terms changed.'],
        })
      )
    ),
  }).annotate({ description: 'Which request to cancel, and why.' }),
}).pipe(
  Schema.annotate({
    identifier: 'SignatureCancelAction',
    title: 'Signature Cancel Action',
    description:
      'Cancel the open signing request of a record: unused links stop working and the request ends cancelled',
  })
)

/** @public */
export type SignatureCancelAction = Schema.Schema.Type<typeof SignatureCancelActionSchema>
