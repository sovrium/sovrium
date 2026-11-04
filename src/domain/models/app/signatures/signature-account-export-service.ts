/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The signatures section of an account's data export: each signature she gave
 * from her account, as the evidence tables hold it, shaped into the export
 * contract (`accountExportSignatureSchema`).
 *
 * A signature captured on a record belongs to no flow: its entry names no flow
 * and no signer role. Her contact details are given in clear, since they are
 * hers; an erasure deleted them, and its entry then carries none. A signature
 * the evidence holds no signing instant for (one never given) is left out.
 *
 * Pure: the caller reads the rows.
 */

import { isRecordCaptureFlowName } from './signature-capture-service'
import type { AccountExportSignature } from '@/domain/models/api/auth/account/account'
import type { SignatureIdentity } from '@/domain/models/api/signatures/common'

/** One signature an account gave, as the evidence tables hold it. */
export interface AccountSignatureInput {
  readonly requestId: string
  readonly flowName: string
  readonly signerName: string
  readonly tableName: string
  readonly recordId: string
  readonly fieldName?: string | undefined
  readonly signedAt?: string | undefined
  readonly identityKind: SignatureIdentity['kind']
  /** The frozen statements, by signer name. */
  readonly statements: Readonly<Record<string, string>>
  readonly method?: string | undefined
  readonly contact: {
    readonly name?: string | undefined
    readonly email?: string | undefined
    readonly phone?: string | undefined
  }
}

/** Only the contact details that are there. */
const presentContact = (contact: AccountSignatureInput['contact']) =>
  Object.fromEntries(
    Object.entries(contact).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1] !== ''
    )
  )

/** One export entry, or `undefined` for a signature never given. */
export const accountSignatureEntryOf = (
  input: AccountSignatureInput
): AccountExportSignature | undefined => {
  if (input.signedAt === undefined) return undefined
  const inFlow = !isRecordCaptureFlowName(input.flowName)
  return {
    requestId: input.requestId,
    ...(inFlow ? { flow: input.flowName, signer: input.signerName } : {}),
    ...{ table: input.tableName, recordId: input.recordId },
    ...(input.fieldName === undefined ? {} : { field: input.fieldName }),
    signedAt: input.signedAt,
    method: input.method ?? 'drawn',
    statement: input.statements[input.signerName] ?? Object.values(input.statements)[0] ?? '',
    identity: { kind: input.identityKind },
    contact: presentContact(input.contact),
  }
}

/** The signatures section: every signature given, oldest first. */
export const accountSignatureSection = (
  inputs: readonly AccountSignatureInput[]
): readonly AccountExportSignature[] =>
  inputs
    .map(accountSignatureEntryOf)
    .filter((entry): entry is AccountExportSignature => entry !== undefined)
    .toSorted((a, b) => a.signedAt.localeCompare(b.signedAt))
