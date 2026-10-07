/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  isStorageObjectNotFound,
  UNATTRIBUTED_BUCKET,
} from '@/application/ports/services/storage-service'
import {
  constraintRefusalMessage,
  resolveUploadConstraints,
} from '@/application/use-cases/buckets/signed-upload-constraints'
import {
  MAX_SIGNED_URL_EXPIRES_IN,
  MIN_SIGNED_URL_EXPIRES_IN,
  mintSignedUrl,
  resolveSignBucket,
} from '@/application/use-cases/buckets/signed-url-minting'
import { checkUploadPath, resolveMaxFileSize } from '@/application/use-cases/buckets/upload-policy'
import { resolveStorageSigningSecret } from '@/application/use-cases/storage/signing-secret'
import { SYSTEM_BUCKET_NAME } from '@/domain/models/app/buckets/bucket-identity'
import { logError } from '@/infrastructure/logging/logger'
import type { ActionOutcome } from './shared'
import type { StorageService } from '@/application/ports/services/storage-service'
import type { App } from '@/domain/models/app'
import type { Bucket } from '@/domain/models/app/buckets'

type Storage = Effect.Success<typeof StorageService>

/** The built-in private bucket, as the signed-upload handler resolves it. */
const SYSTEM_BUCKET: Bucket = { name: SYSTEM_BUCKET_NAME, public: false }

/** What an upload link is minted for. */
export interface UploadLinkRequest {
  readonly key: string
  readonly expiresIn: number
  readonly contentType: string | undefined
}

/** A failure that callers may swallow via `output.error` (status stays success). */
const softError = (message: string): ActionOutcome => ({
  status: 'success',
  output: { error: message },
})

/**
 * The lifetime an upload link is given: the requested one, held to the range
 * a signed URL from the sign route may have (one minute to seven days).
 */
export const clampUploadLinkLifetime = (expiresIn: number): number =>
  Math.min(Math.max(expiresIn, MIN_SIGNED_URL_EXPIRES_IN), MAX_SIGNED_URL_EXPIRES_IN)

/**
 * The origin an upload link is built on. A run has no request to take it
 * from, and the link usually leaves the app — an email, a webhook call — so it
 * is the app's `BASE_URL` when one is set, and a path from the site root
 * otherwise.
 */
const linkOrigin = (env: Readonly<Record<string, string | undefined>>): string =>
  env['BASE_URL']?.trim().replace(/\/+$/, '') ?? ''

/**
 * Whether the catalog already holds an object at `key`, in ANY bucket — the
 * read names none, so a key `system` does not hold but another bucket does is
 * refused too. `undefined` when the catalog could not be read: the step then
 * hands out no link rather than one it could not check.
 */
const keyIsStored = (storage: Storage, key: string): Effect.Effect<boolean | undefined, never> =>
  storage.getMetadata(key, UNATTRIBUTED_BUCKET).pipe(
    Effect.map(() => true),
    Effect.catch((error) =>
      isStorageObjectNotFound(error)
        ? Effect.succeed(false)
        : Effect.sync(() => {
            logError('[automations] file.signUrl could not read the storage catalog', error, {
              'sovrium.storage.key': key,
            })
            return undefined
          })
    )
  )

/** The constraints bound into the link: its content type and the deployment's size cap. */
const bindConstraints = (bucket: Bucket, contentType: string | undefined) =>
  resolveUploadConstraints(
    { contentType: contentType ?? '', maxSize: resolveMaxFileSize(bucket)?.limit },
    bucket,
    undefined
  )

/**
 * Mint an upload link for `file.signUrl`: Sovrium's own signed upload URL into
 * the built-in private `system` bucket — the one `POST /api/buckets/system/sign`
 * hands out — so the `PUT` that follows runs the signed-upload handler on every
 * storage provider. The bound content type and the deployment's file size cap
 * hold there, the object is catalogued in `system` with NO uploader (an
 * automation is nobody), and a key already holding an object is refused at
 * `PUT` (409) as it is here, at mint.
 */
export const signUploadLink = (
  storage: Storage,
  app: App,
  request: UploadLinkRequest
): Effect.Effect<ActionOutcome, never> =>
  Effect.gen(function* () {
    const { key } = request
    const invalidPath = checkUploadPath(key)
    if (invalidPath) return softError(invalidPath.message)

    const stored = yield* keyIsStored(storage, key)
    if (stored === undefined) return softError(`failed to sign url for ${key}`)
    if (stored) return softError(`a file is already stored at ${key}`)

    const bucket = resolveSignBucket(app, SYSTEM_BUCKET_NAME) ?? SYSTEM_BUCKET
    const constraints = bindConstraints(bucket, request.contentType)
    if (typeof constraints === 'string') return softError(constraintRefusalMessage(constraints))

    const expiresIn = clampUploadLinkLifetime(request.expiresIn)
    const { signedUrl, expiresAt } = mintSignedUrl(
      {
        bucket: bucket.name,
        path: key,
        operation: 'upload',
        expiresInSeconds: expiresIn,
        constraints,
      },
      {
        secret: resolveStorageSigningSecret(process.env),
        now: Date.now(),
        origin: linkOrigin(process.env),
      }
    )
    return {
      status: 'success',
      output: { url: signedUrl, key, operation: 'upload', expiresIn, expiresAt },
    } as const
  }).pipe(Effect.withSpan('automations.file.sign-upload-link'))
