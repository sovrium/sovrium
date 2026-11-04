/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The delivery links of a completed request: each signer who signed gets a
 * fresh token that opens her copies of the signed document and the proof,
 * until it expires.
 *
 * The token goes in `token_hash` (stored only as its SHA-256, like every
 * link token), which her signature cleared (`claimSignerOn`): a signer's row
 * holds one live link at a time, and once she has signed, the only link of
 * hers that may open anything is this one. A signer the delivery skips (no
 * address recorded) or a delivery that failed leaves her with no live link
 * at all, never with her old signing link reopened as a download link.
 */

import { sql } from 'drizzle-orm'
import { issueAccessToken } from '@/infrastructure/forms/access-token'
import { evidenceInstant, evidenceTable } from './signature-evidence-queries'
import { subjectsOfSignerOn } from './signature-request-queries'
import { sentContactOf } from './signature-request-rows'
import { executeRawOn, executeRawTypedOn, type RawSqlRunner } from './sql/dialect-execute'
import type { Dialect } from './drizzle/layer'
import type { InvitedSigner } from '@/application/ports/repositories/signatures/signature-request-repository'

type Runner = Readonly<RawSqlRunner>
type Row = Readonly<Record<string, unknown>>

/** The signers of a completed request who signed, in order. */
const signedSignersOn = (runner: Runner, dialect: Dialect, requestId: string) =>
  executeRawTypedOn<Row>(
    dialect.kind,
    runner,
    sql`SELECT g.id, g.signer_name
        FROM ${evidenceTable(dialect, 'signature_signers')} AS g
        JOIN ${evidenceTable(dialect, 'signature_requests')} AS r ON r.id = g.request_id
        WHERE g.request_id = ${requestId} AND g.status = 'signed' AND r.status = 'completed'
        ORDER BY g.position ASC`
  )

/** Give one signed signer the link token `tokenHash` names, valid until `expiresAtMs`. */
const setDeliveryTokenOn = (
  runner: Runner,
  dialect: Dialect,
  input: { readonly signerId: string; readonly tokenHash: string; readonly expiresAtMs: number }
) =>
  executeRawOn(
    dialect.kind,
    runner,
    sql`UPDATE ${evidenceTable(dialect, 'signature_signers')}
        SET token_hash = ${input.tokenHash},
            token_expires_at = ${evidenceInstant(dialect, input.expiresAtMs)}
        WHERE id = ${input.signerId} AND status = 'signed'
        RETURNING id`
  )

/**
 * Issue each signer of the completed request `requestId` a delivery link
 * valid until `expiresAtMs`; each with the address the send recorded and the
 * token, shown once. A signer with no address recorded is skipped.
 */
export const issueDeliveryLinksOn = async (
  runner: Runner,
  dialect: Dialect,
  input: { readonly requestId: string; readonly expiresAtMs: number }
): Promise<readonly InvitedSigner[]> => {
  const signers = await signedSignersOn(runner, dialect, input.requestId)
  return signers.reduce<Promise<readonly InvitedSigner[]>>(async (previous, row) => {
    const done = await previous
    const signerId = String(row['id'])
    const contact = sentContactOf(await subjectsOfSignerOn(runner, dialect, signerId))
    if (contact.email === undefined) return done
    const issued = issueAccessToken()
    const set = await setDeliveryTokenOn(runner, dialect, {
      ...{ signerId, tokenHash: issued.hash, expiresAtMs: input.expiresAtMs },
    })
    if (set.length === 0) return done
    return [
      ...done,
      {
        name: String(row['signer_name']),
        email: contact.email,
        displayName: contact.name ?? '',
        token: issued.token,
      },
    ]
  }, Promise.resolve([]))
}
