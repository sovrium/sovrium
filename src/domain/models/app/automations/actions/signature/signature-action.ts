/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { SignatureCancelActionSchema } from './cancel'
import { SignatureSendActionSchema } from './send'

/**
 * Signature Action — the operators on a declared signing flow.
 *
 * Only `send` and `cancel` exist: signing and declining are done by the
 * signer, on the signing page, never by a workflow.
 */
export const SignatureActionSchema = Schema.Union([
  SignatureSendActionSchema,
  SignatureCancelActionSchema,
]).pipe(
  Schema.annotate({
    identifier: 'SignatureAction',
    title: 'Signature Action',
    description: 'Start or cancel a signing request through a declared signing flow',
  })
)

/** @public */
export type SignatureAction = Schema.Schema.Type<typeof SignatureActionSchema>
