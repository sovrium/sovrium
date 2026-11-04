/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TriggerHistorySchema } from './trigger-history'
import { TriggerNameSchema } from './trigger-name'

/** The events of a signing request a trigger can start on. */
export const SIGNATURE_TRIGGER_EVENTS = [
  'sent',
  'signed',
  'declined',
  'cancelled',
  'completed',
  'sealed',
  'expired',
] as const

/**
 * Signature Trigger
 *
 * Starts a run when a request of a declared signing flow moves on. `signed`
 * fires once per signer; `sealed` fires only when the organisation seal was
 * applied, just before `completed`; `completed` fires once every signer has
 * signed and the signed document and proof file are written.
 *
 * | Path                              | Description                                   |
 * | --------------------------------- | --------------------------------------------- |
 * | `$trigger.record.*`              | The record the request is for, as it is now   |
 * | `$trigger.signature.requestId`   | Id of the request                             |
 * | `$trigger.signature.event`       | The event that started the run                |
 * | `$trigger.signature.status`      | The request status after the event            |
 * | `$trigger.signature.signer`      | The signer concerned (`signed`, `declined`) |
 * | `$trigger.signature.reason`      | The reason given (`declined`, `cancelled`)  |
 */
export const SignatureTriggerSchema = Schema.Struct({
  type: Schema.Literal('signature').pipe(
    Schema.annotate({
      description: "Constant value 'signature' for type discrimination in discriminated unions",
    })
  ),
  name: Schema.optional(TriggerNameSchema),
  history: Schema.optional(TriggerHistorySchema),
  flow: Schema.String.pipe(
    Schema.annotate({
      description:
        'Name of the signing flow, declared under signatures, whose requests start the run.',
      examples: ['employment_contract'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
  event: Schema.Literals(SIGNATURE_TRIGGER_EVENTS).pipe(
    Schema.annotate({
      description:
        'The event that starts the run: sent, signed (once per signer), declined, cancelled, completed, sealed (only when a seal key is configured) or expired.',
    })
  ),
}).pipe(
  Schema.annotate({
    identifier: 'SignatureTrigger',
    title: 'Signature Trigger',
    description:
      'Trigger automation when a signing request moves on. Provides $trigger.record.* and $trigger.signature.{requestId,event,status,signer,reason}.',
  })
)

/** @public */
export type SignatureTrigger = Schema.Schema.Type<typeof SignatureTriggerSchema>
