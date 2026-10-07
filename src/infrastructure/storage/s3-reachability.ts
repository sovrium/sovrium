/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/** What the S3 storage layer checks at construction: the env it needs, and whether the bucket answers. */

import { logWarning } from '@/infrastructure/logging/logger'
import { s3ValidateBucket } from './s3-adapter'
import { probeS3BucketOnce } from './s3-bucket-probe'

/**
 * Find the first missing required S3 environment variable when
 * STORAGE_PROVIDER=s3. Returns the env-var name (e.g. "STORAGE_S3_BUCKET") so
 * startup errors surface with the name the operator actually wrote, instead of
 * a generic Effect Schema decode error reporting the schema-key name (e.g.
 * "bucket") — which names nothing an operator can grep their deployment for.
 *
 * Runs only when the operator has set at least one of the four, so an
 * unconfigured install still reaches `parseStorageEnvConfig` and gets the
 * schema's own message rather than a guess about which var came first.
 */
export const findMissingS3EnvVar = (): string | undefined => {
  if (process.env.STORAGE_PROVIDER !== 's3') return undefined
  const requiredS3Vars: ReadonlyArray<string> = [
    'STORAGE_S3_BUCKET',
    'STORAGE_S3_ENDPOINT',
    'STORAGE_S3_ACCESS_KEY_ID',
    'STORAGE_S3_SECRET_ACCESS_KEY',
  ]
  const anySet = requiredS3Vars.some((name) => process.env[name] !== undefined)
  if (!anySet) return undefined
  return requiredS3Vars.find((name) => !process.env[name])
}

/**
 * Take the advisory S3 bucket probe and warn when it did not answer.
 *
 * Advisory, not fatal, and at most one `LIST` per process per endpoint. A
 * fatal probe would let a briefly unreachable bucket take down every
 * composition holding the storage layer, including routes that never touch
 * storage, and would cost a `LIST` each time the layer is re-provided. The
 * operator still learns about it at boot; a request against a genuinely broken
 * backend still fails with the `StorageError` the operation itself raises,
 * which is the error that can actually be acted on.
 *
 * Never rejects — `probeS3BucketOnce` resolves its failures as values — so the
 * caller's `Effect.promise` cannot become a defect.
 */
export const warnIfS3BucketUnreachable = async (
  client: Bun.S3Client,
  endpoint: string,
  bucket: string
): Promise<void> => {
  const probe = await probeS3BucketOnce(`${endpoint}|${bucket}`, () =>
    s3ValidateBucket(client, bucket)
  )
  if (probe.reachable) return
  logWarning(
    `[storage] S3 bucket "${bucket}" did not answer a reachability probe: ${String(probe.cause)}. Storage operations will surface their own errors.`
  )
}
