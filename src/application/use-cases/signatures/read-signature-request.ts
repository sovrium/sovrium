/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Where a signing request stands, for whoever may read the record it is for.
 *
 * The caller is judged as the records route judges her: the table's read
 * permission for her role and groups, then the record read with her session,
 * its row-level `read.when` rule applied to her (`readableRows`). Anyone else, a visitor not signed in, and a
 * request that does not exist all get the same not-found. The answer names
 * each signer by her name in the flow and the name the request was sent to
 * her under, with her status; it carries no address, phone or network data.
 */

import { Effect } from 'effect'
import { SignatureEvidenceRepository } from '@/application/ports/repositories/signatures/signature-evidence-repository'
import { SignatureRequestRepository } from '@/application/ports/repositories/signatures/signature-request-repository'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import { readableRows } from '@/application/use-cases/tables/linked-row-visibility'
import { tableReadAdmits } from '@/application/use-cases/tables/table-operations'
import { getUserGroups } from '@/application/use-cases/tables/user-groups'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { NotFoundError } from '@/domain/errors'
import {
  requestStatusOf,
  signerStatusOf,
} from '@/domain/models/app/signatures/signature-request-service'
import { requestEndedAt } from '@/domain/models/app/signatures/signature-request-summary-service'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { SignatureRequestResponse } from '@/domain/models/api/signatures/requests'
import type { App } from '@/domain/models/app'
import type { ChainedSignatureEvent } from '@/domain/models/app/signatures/signature-evidence-chain-service'

const notFound = (requestId: string) =>
  Effect.fail(new NotFoundError('Signature request not found', requestId))

/** The channels each signer verified, by her name, as the chain records them. */
const verifiedChannels = (
  chain: readonly ChainedSignatureEvent[]
): ReadonlyMap<string, readonly ('email' | 'sms')[]> =>
  chain.reduce((byName, event) => {
    const { channel } = event.data
    if (event.type !== 'challenge-verified' || event.signer === undefined) return byName
    if (channel !== 'email' && channel !== 'sms') return byName
    const known = byName.get(event.signer) ?? []
    return known.includes(channel)
      ? byName
      : new Map([...byName, [event.signer, [...known, channel]]])
  }, new Map<string, readonly ('email' | 'sms')[]>())

/** When the request ended, as a reader is shown it: completion, or the deadline of an expiry. */
const endedAtOf = (
  request: Parameters<typeof requestEndedAt>[0]
): { readonly endedAt?: string } => {
  const endedAt = requestEndedAt(request)
  return endedAt === undefined ? {} : { endedAt }
}

/** The request `requestId` as its reader sees it, or the uniform not-found. */
export const readSignatureRequestStatus = Effect.fn('signatures.read-request-status')(
  function* (input: {
    readonly app: App
    readonly requestId: string
    readonly session: Readonly<UserSession> | undefined
  }) {
    const { app, requestId, session } = input
    if (session === undefined) return yield* notFound(requestId)
    const requests = yield* SignatureRequestRepository
    const request = yield* requests.read(requestId)
    const table = app.tables?.find((candidate) => candidate.name === request?.tableName)
    if (request === undefined || request.documentHash === undefined || table === undefined) {
      return yield* notFound(requestId)
    }
    const role = yield* getUserRole(session.userId, app)
    const groups = yield* getUserGroups(session.userId)
    if (!tableReadAdmits(app, table, { role, groups })) return yield* notFound(requestId)
    // The record as the records route reads it for her: the table's row-level
    // `read.when` rule applied (an admin-equivalent role and a table with no
    // rule pass through to the plain read), a soft-deleted record gone.
    const byRule = yield* readableRows(app, table, [request.recordId], { session, role, groups })
    const readable =
      byRule === undefined
        ? (yield* (yield* TableRepository).getRecord(session, table.name, request.recordId)) !==
          null
        : byRule.has(request.recordId)
    if (!readable) return yield* notFound(requestId)
    const signers = yield* requests.signers(requestId)
    const chain = yield* (yield* SignatureEvidenceRepository).readChain(requestId)
    const verified = verifiedChannels(chain)
    // The head is timestamped when the completion recorded a token for it.
    const headStamped = chain.some(
      (event) => event.type === 'completed' && event.data['timestamp'] !== undefined
    )
    return {
      ...{ id: request.id, flow: request.flowName, table: request.tableName },
      ...{ recordId: request.recordId, status: requestStatusOf(request.status) },
      ...{ documentHash: request.documentHash, sentAt: request.createdAt },
      expiresAt: request.expiresAt ?? request.createdAt,
      ...endedAtOf(request),
      sealed: request.sealLevel !== 'none',
      timestamped: headStamped,
      signers: signers.map((signer) => ({
        ...{ name: signer.name, displayName: signer.displayName ?? '' },
        status: signerStatusOf(signer.status),
        ...(signer.signedAt === undefined ? {} : { signedAt: signer.signedAt }),
        verifiedBy: verified.get(signer.name) ?? [],
      })),
    } satisfies SignatureRequestResponse
  }
)
