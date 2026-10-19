/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  handStarterOfStoredRun,
  type StoredHandStarter,
  type StoredRunStarter,
} from '@/domain/models/app/automations/run-starter-service'

/**
 * Who a resumed segment of a stored run runs and is finalised as: the person
 * who started it by hand, with the `startedByHand` / `startedAsGuest` markers
 * the first segment carried, or the system (`userId: undefined`). The same
 * value feeds the segment's steps and its `finaliseRun`, so a fallback insert
 * keeps the run's starter exactly as the queued row did.
 */
export const segmentStarterOf = (
  run: StoredRunStarter
): StoredHandStarter | { readonly userId: undefined } =>
  handStarterOfStoredRun(run) ?? { userId: undefined }
