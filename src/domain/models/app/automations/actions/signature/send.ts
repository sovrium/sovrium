/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionBaseFields } from '../base'
import { signatureFlowProp, signatureRecordIdProp } from './props'

/**
 * Signature Action (type: signature, operator: send)
 *
 * Start a signing request for one record: the document is copied and
 * fingerprinted, the statement resolved per signer, and the first links sent
 * (every link at once with `order: parallel`). A record that already has an
 * open request for the flow fails the step; the request already sent is kept.
 * The step's output is the request id and its status.
 */
export const SignatureSendActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('signature').pipe(
    Schema.annotate({
      description: "Constant value 'signature' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('send').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'signature' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    flow: signatureFlowProp,
    recordId: signatureRecordIdProp,
  }).annotate({ description: 'Which flow to start, and for which record.' }),
}).pipe(
  Schema.annotate({
    identifier: 'SignatureSendAction',
    title: 'Signature Send Action',
    description:
      'Send a signing request for one record through a declared signing flow; outputs the request id and status',
  })
)

/** @public */
export type SignatureSendAction = Schema.Schema.Type<typeof SignatureSendActionSchema>
