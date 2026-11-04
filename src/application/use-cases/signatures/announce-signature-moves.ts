/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { startInTrackedBackground } from '@/application/use-cases/automations/tracked-background'
import { triggerSignatureEventAutomations } from '@/application/use-cases/automations/trigger-signature-event'
import type { SignatureMove } from './sign-signature-request'
import type { App } from '@/domain/models/app'

/**
 * Start the signature automations of each move a signer made, one after the
 * other, in the background: the answer she is waiting for never waits on them.
 * Every road a signer signs or declines on announces its moves through here.
 */
export const announceSignatureMoves = (app: App, moves: readonly SignatureMove[]) =>
  moves.length === 0
    ? Effect.void
    : startInTrackedBackground(
        Effect.forEach(
          moves,
          (move) =>
            triggerSignatureEventAutomations({
              ...{ app, flow: move.flow, recordId: move.recordId },
              signature: move.trigger,
            }),
          { discard: true }
        )
      )
