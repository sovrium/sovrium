/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The signatures half of the GDPR export: every signature the caller gave from
 * her account, a signing flow's or a record's, with what she signed, how, and
 * the contact details the evidence keeps of her (`signature-account-export-service.ts`).
 * Read by her own id: a signer of the same request is never in her export.
 */

import { Effect } from 'effect'
import { SignatureEvidenceRepository } from '@/application/ports/repositories/signatures/signature-evidence-repository'
import { accountSignatureSection } from '@/domain/models/app/signatures/signature-account-export-service'
import type { AccountExportSignature } from '@/domain/models/api/auth/account/account'

/** The signatures section, as the export payload carries it. */
export interface SignatureExport {
  readonly signatures: readonly AccountExportSignature[]
}

/** Gather and shape the caller's signatures. */
export const loadSignatureExport = Effect.fn('account.load-signature-export')(function* (
  userId: string
) {
  const repo = yield* SignatureEvidenceRepository
  const rows = yield* repo.readAccountSignatures(userId)
  return { signatures: accountSignatureSection(rows) } satisfies SignatureExport
})
