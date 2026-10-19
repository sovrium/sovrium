/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Reading a signed download link back: the bucket its token was minted for.
 * One reading for the route that serves the link and for an automation that
 * is handed one, so both recognise exactly the links the app signed.
 */

import {
  UNATTRIBUTED_BUCKET,
  type BucketBinding,
} from '@/application/ports/services/storage-service'
import { resolveStorageSigningSecret } from '@/application/use-cases/storage/signing-secret'
import { verifySignedUrl } from '@/domain/models/app/buckets/signed-url-service'
import type {
  SignedUrlClaims,
  SignedUrlDisplay,
} from '@/domain/models/app/buckets/signed-url-service'

/** Whether `token` is the one minted for these claims (constant-time). */
const tokenVerifies = (claims: SignedUrlClaims, token: string): boolean =>
  verifySignedUrl(resolveStorageSigningSecret(process.env), claims, token)

/**
 * The display a link claims (`display=inline`). It is verified with the rest of
 * its claims, so a holder cannot add it to an ordinary download link.
 */
export const signedLinkDisplay = (
  query: Readonly<Record<string, string>>
): SignedUrlDisplay | undefined => (query['display'] === 'inline' ? 'inline' : undefined)

/**
 * The bucket a verified download link reads its object through, or `undefined`
 * when the token does not verify. A link an automation step minted carries the
 * `automation` scope and reaches its object as the automation's `file` actions
 * do, bucket-less; the scope is bound into the token, so no link signed for a
 * bucket can claim it. The display the link claims is bound the same way.
 * Expiry is the caller's to judge.
 */
export const verifiedDownloadBinding = (
  query: Readonly<Record<string, string>>,
  claims: { readonly bucket: string; readonly path: string; readonly expires: number },
  token: string
): BucketBinding | undefined => {
  const download = {
    ...claims,
    operation: 'download' as const,
    display: signedLinkDisplay(query),
  }
  if (query['scope'] === 'automation') {
    return tokenVerifies({ ...download, scope: 'automation' }, token)
      ? UNATTRIBUTED_BUCKET
      : undefined
  }
  return tokenVerifies(download, token) ? claims.bucket : undefined
}
