/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable functional/prefer-immutable-types, functional/no-expression-statements */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadBucketCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { S3StorageEnvConfig } from '@/domain/models/env/storage/storage'

export const createS3Client = (config: S3StorageEnvConfig): S3Client =>
  new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: config.forcePathStyle,
  })

/**
 * Parameters for {@link s3Upload}
 */
export interface S3UploadParams {
  readonly client: S3Client
  readonly bucket: string
  readonly key: string
  readonly content: Uint8Array
  readonly mimeType: string
}

export const s3Upload = async (params: S3UploadParams): Promise<void> => {
  const { client, bucket, key, content, mimeType } = params
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: content,
      ContentType: mimeType,
    })
  )
}

export const s3Download = async (
  client: S3Client,
  bucket: string,
  key: string
): Promise<Uint8Array> => {
  const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  const body = await response.Body?.transformToByteArray()
  return body ?? new Uint8Array(0)
}

export const s3Delete = async (client: S3Client, bucket: string, key: string): Promise<void> => {
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
}

/**
 * Keys returned per `ListObjectsV2` call. 1000 is the S3 API maximum.
 */
const LIST_PAGE_SIZE = 1000

/**
 * Hard ceiling on pages walked by one listing, i.e. 100 000 objects.
 *
 * `ListObjectsV2` is paginated and truncates SILENTLY at `MaxKeys`: a bucket
 * with 1500 objects used to answer with 1000 and no indication that 500 were
 * dropped — so `s3List` under-reported files and `s3GetTotalBytes` returned a
 * quota figure that could never trip its own limit. Following
 * `ContinuationToken` fixes the common case, but an unbounded loop turns a
 * dashboard read into an unbounded round-trip count against a remote endpoint.
 *
 * So: paginate, and STATE the truncation when the ceiling is reached. A bounded
 * number that admits it is a floor is usable; a silent one is not.
 */
const MAX_LIST_PAGES = 100

/**
 * One paginated listing pass over a bucket.
 *
 * `truncated` is `true` when {@link MAX_LIST_PAGES} was exhausted with more
 * pages still pending — the results are then a prefix of the bucket, not the
 * whole of it.
 */
interface S3ListingPage {
  readonly items: ReadonlyArray<{ readonly key: string; readonly size: number }>
  readonly truncated: boolean
}

/**
 * Walk every `ListObjectsV2` page for `bucket`/`prefix`, up to
 * {@link MAX_LIST_PAGES}.
 */
const s3ListAll = async (
  client: S3Client,
  bucket: string,
  prefix?: string
): Promise<S3ListingPage> => {
  const step = async (
    token: string | undefined,
    pagesLeft: number,
    acc: ReadonlyArray<{ readonly key: string; readonly size: number }>
  ): Promise<S3ListingPage> => {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ...(prefix ? { Prefix: prefix } : {}),
        MaxKeys: LIST_PAGE_SIZE,
        ...(token ? { ContinuationToken: token } : {}),
      })
    )
    const items = [
      ...acc,
      ...(response.Contents ?? [])
        .filter((item) => Boolean(item.Key))
        .map((item) => ({ key: item.Key ?? '', size: item.Size ?? 0 })),
    ]
    const next = response.NextContinuationToken
    if (!response.IsTruncated || !next) return { items, truncated: false }
    if (pagesLeft <= 1) return { items, truncated: true }
    return step(next, pagesLeft - 1, items)
  }

  return step(undefined, MAX_LIST_PAGES, [])
}

/**
 * Object keys under `prefix`.
 *
 * `truncated` is `true` when the listing hit {@link MAX_LIST_PAGES} and the
 * keys are therefore a prefix of the bucket rather than all of it.
 */
export const s3List = async (
  client: S3Client,
  bucket: string,
  prefix: string
): Promise<{ readonly keys: readonly string[]; readonly truncated: boolean }> => {
  const page = await s3ListAll(client, bucket, prefix)
  return { keys: page.items.map((item) => item.key), truncated: page.truncated }
}

export const s3ValidateBucket = async (client: S3Client, bucket: string): Promise<void> => {
  await client.send(new HeadBucketCommand({ Bucket: bucket }))
}

/**
 * Sum object sizes across the whole bucket, following `ContinuationToken`.
 * Used for `STORAGE_MAX_TOTAL_SIZE` on the S3 provider and for the footprint
 * dashboard's bucket row.
 *
 * `truncated` is `true` when the walk stopped at {@link MAX_LIST_PAGES}; the
 * byte count is then a LOWER BOUND, and the caller is expected to say so
 * rather than present it as the total.
 */
export const s3GetTotalBytes = async (
  client: S3Client,
  bucket: string
): Promise<{ readonly bytes: number; readonly truncated: boolean }> => {
  const page = await s3ListAll(client, bucket)
  return {
    bytes: page.items.reduce((sum, item) => sum + item.size, 0),
    truncated: page.truncated,
  }
}

export const s3GetSignedUrl = async (
  client: S3Client,
  bucket: string,
  key: string,
  expiresIn: number
): Promise<string> =>
  getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn })

/**
 * Parameters for {@link s3GetSignedUploadUrl}
 */
export interface S3SignedUploadUrlParams {
  readonly client: S3Client
  readonly bucket: string
  readonly key: string
  readonly expiresIn: number
  readonly contentType?: string
}

export const s3GetSignedUploadUrl = async (params: S3SignedUploadUrlParams): Promise<string> => {
  const { client, bucket, key, expiresIn, contentType } = params
  return getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ...(contentType ? { ContentType: contentType } : {}),
    }),
    { expiresIn }
  )
}
