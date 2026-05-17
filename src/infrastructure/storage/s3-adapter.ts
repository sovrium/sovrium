/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable functional/prefer-immutable-types, functional/no-expression-statements, max-params */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadBucketCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { S3StorageEnvConfig } from '@/domain/models/env/storage'

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

export const s3Upload = async (
  client: S3Client,
  bucket: string,
  key: string,
  content: Uint8Array,
  mimeType: string
): Promise<void> => {
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

export const s3List = async (
  client: S3Client,
  bucket: string,
  prefix: string
): Promise<readonly string[]> => {
  const response = await client.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      MaxKeys: 1000,
    })
  )
  return (response.Contents ?? []).map((item) => item.Key ?? '').filter(Boolean)
}

export const s3ValidateBucket = async (client: S3Client, bucket: string): Promise<void> => {
  await client.send(new HeadBucketCommand({ Bucket: bucket }))
}

/**
 * Sum object sizes in the bucket (capped at 1000 keys per page — the test fixture
 * is per-bucket so this is sufficient for quota enforcement). Used for
 * `STORAGE_MAX_TOTAL_SIZE` on the S3 provider.
 */
export const s3GetTotalBytes = async (client: S3Client, bucket: string): Promise<number> => {
  const response = await client.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      MaxKeys: 1000,
    })
  )
  return (response.Contents ?? []).reduce((sum, item) => sum + (item.Size ?? 0), 0)
}

export const s3GetSignedUrl = async (
  client: S3Client,
  bucket: string,
  key: string,
  expiresIn: number
): Promise<string> =>
  getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn })

export const s3GetSignedUploadUrl = async (
  client: S3Client,
  bucket: string,
  key: string,
  expiresIn: number,
  contentType?: string
): Promise<string> =>
  getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ...(contentType ? { ContentType: contentType } : {}),
    }),
    { expiresIn }
  )
