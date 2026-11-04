/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The record writer of a move made outside a run (a signer, the sweep): the
 * ordinary update road, as the engine, with the record's automations started
 * in the background.
 *
 * It lives apart from `signature-request-effects.ts` because the update road
 * imports the automation run loop, which imports the step handlers, among
 * them the signing steps, which import those effects: binding the road there
 * would close that cycle. A step writes through its run's channel instead.
 */

import { Effect } from 'effect'
import { buildSystemSession } from '@/application/use-cases/automations/build-guest-session'
import { updateRecordWithSideEffects } from '@/application/use-cases/tables/record-write-roads'
import type { FlowRecordWrite } from './signature-request-effects'

/** The update road, as the engine, its automations started in the background. */
export const roadRecordWriter = (write: FlowRecordWrite) =>
  updateRecordWithSideEffects({
    ...{ session: buildSystemSession(), app: write.app, tableName: write.tableName },
    ...{ recordId: write.recordId, fields: write.fields },
    replacedAttachments: 'keep',
    forgetDerivedVariants: () => undefined,
  }).pipe(Effect.withSpan('signatures.write-record-as-engine'))
