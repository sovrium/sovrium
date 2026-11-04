/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ErasureCoverageEntry } from './account-purge-coverage'

/**
 * The erasure verdicts of the signature evidence tables, spread into
 * `ERASURE_COVERAGE` (`account-purge-coverage.ts`).
 *
 * Only `system.signature_signers` carries a user column. Its row is part of a
 * request other people sign too, and the chain it anchors must keep verifying,
 * so the row stays and the FK's `ON DELETE SET NULL` clears the account.
 *
 * The signer's name, address and device are not on that row: they live in
 * `system.signature_subjects`, which carries no user column and is reached
 * through its `signer_id`, so the census scan does not flag it. Its `delete`
 * verdict is listed here all the same, and the purge runs it
 * (`eraseSignatureSubjectsOf`, called from `account-purge.ts`).
 */
export const SIGNATURE_ERASURE_COVERAGE: Readonly<Record<string, ErasureCoverageEntry>> = {
  'system.signature_signers': {
    verdict: 'shed',
    columns: ['user_id'],
    reason:
      'A signer of a request that other people sign too, and a link in a hash chain that must ' +
      'keep verifying. The FK is `ON DELETE SET NULL`, so the account goes and the signer ' +
      'row stands; the evidence guard on the table allows exactly that clearing.',
  },
  'system.signature_subjects': {
    verdict: 'delete',
    columns: ['signer_id'],
    reason:
      'Her name, address, phone, network address and browser as she signed, with the salts ' +
      'that open the commitments the chain keeps of them. Deleted through her signer rows ' +
      'before the account goes, and an `erased` event appended to each chain, which then ' +
      'still verifies and no longer identifies her. The chain, the frozen and sealed ' +
      'documents, the proof file and her mark are kept until the request retention ends. ' +
      'Before that, her export offers them in clear, with each signature she gave from her ' +
      'account (`signatures`, read through the signer rows her account is linked to).',
  },
}
