/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect, Layer } from 'effect'
import {
  ApprovalRepository,
  type ApprovalDatabaseError,
  type ApprovalMirrorRecord,
} from '@/application/ports/repositories/ai/approval-repository'
import { ApprovalRepositoryLive } from '@/infrastructure/database/repositories/ai/approval-repository-live'

export const MirrorApprovalCreate = (
  record: ApprovalMirrorRecord
): Effect.Effect<void, ApprovalDatabaseError, ApprovalRepository> =>
  Effect.gen(function* () {
    const repo = yield* ApprovalRepository
    yield* repo.insertApprovalRow(record)
  })

export const MirrorApprovalUpdate = (
  record: ApprovalMirrorRecord
): Effect.Effect<void, ApprovalDatabaseError, ApprovalRepository> =>
  Effect.gen(function* () {
    const repo = yield* ApprovalRepository
    yield* repo.updateApprovalRow(record)
  })

export const LookupApproverEmail = (
  userId: string
): Effect.Effect<string, ApprovalDatabaseError, ApprovalRepository> =>
  Effect.gen(function* () {
    const repo = yield* ApprovalRepository
    return yield* repo.lookupUserEmail(userId)
  })

export const ApprovalLayer = Layer.mergeAll(ApprovalRepositoryLive)
