/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The download-address signer a page hands its renderer, for `file-preview`.
 *
 * Built here, beside the other readers of the page funnel, because minting
 * needs the storage signing secret, which the renderer may not reach. The address is the ordinary signed download URL
 * (`/api/buckets/<bucket>/signed?…`), so a preview and a link a reader is sent
 * verify through the one route and expire on the one clock.
 *
 * A record attachment is signed once the page has read the record for this
 * caller (its gates have answered); a FIXED file of a bucket is signed only
 * where that bucket's sign permission admits the caller, the rule the
 * signed-URL route itself applies.
 */

import {
  DEFAULT_SIGNED_URL_EXPIRES_IN,
  mintSignedUrl,
  resolveSignBucket,
} from '@/application/use-cases/buckets/signed-url-minting'
import { resolveStorageSigningSecret } from '@/application/use-cases/storage/signing-secret'
import { canSignBucketUrl } from '@/domain/models/app/buckets/bucket-sign-validation'
import type { SignFileUrl } from '@/application/ports/services/page-renderer'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'

export const fileUrlSigner =
  (app: App, session: SessionInfo | undefined): SignFileUrl =>
  async (bucketName, key, scope) => {
    const bucket = resolveSignBucket(app, bucketName)
    if (bucket === undefined) return undefined
    if (scope === 'bucket' && !canSignBucketUrl(bucket, 'download', session?.role, app)) {
      return undefined
    }
    return mintSignedUrl(
      {
        bucket: bucketName,
        path: key,
        operation: 'download',
        expiresInSeconds: DEFAULT_SIGNED_URL_EXPIRES_IN,
      },
      // A root-relative address: the page and the file are served by the one host.
      { secret: resolveStorageSigningSecret(process.env), now: Date.now(), origin: '' }
    ).signedUrl
  }
