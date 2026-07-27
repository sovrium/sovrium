/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createHmac } from 'node:crypto'
import { resolveFieldBucket } from '@/domain/models/app/buckets/field-bucket'
import { resolveStoragePublicAccess } from '@/domain/models/env/storage/storage-public-access'
import type { TransformedRecord, RecordFieldValue, FormattedFieldValue } from './record-transformer'
import type { App } from '@/domain/models/app'


const DEFAULT_EXPIRES_IN_SECONDS = 3600

const DEFAULT_BUCKET = 'default'

const signingSecret = (env: Readonly<NodeJS.ProcessEnv>): string =>
  env['AUTH_SECRET'] || 'sovrium-signed-url-dev-secret'

const computeDownloadToken = (
  env: Readonly<NodeJS.ProcessEnv>,
  bucket: string,
  path: string,
  expires: number
): string =>
  createHmac('sha256', signingSecret(env))
    .update(`${bucket}|${path}|download|${expires}`)
    .digest('hex')

const isAttachmentObject = (
  value: unknown
): value is Readonly<Record<string, unknown>> & { readonly key: string } =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  typeof (value as { key?: unknown }).key === 'string'

const ATTACHMENT_FIELD_TYPES: ReadonlySet<string> = new Set([
  'attachment',
  'single-attachment',
  'multiple-attachments',
])

const fieldTypeOf = (
  app: Readonly<App>,
  tableName: string,
  fieldName: string
): string | undefined =>
  app.tables?.find((t) => t.name === tableName)?.fields.find((f) => f.name === fieldName)?.type

interface ColumnContext {
  readonly bucket: string
  readonly isPublic: boolean
  readonly origin: string
  readonly env: NodeJS.ProcessEnv
  readonly now: number
}

const buildPublicUrl = (key: string, ctx: ColumnContext): string => {
  const path = `/api/buckets/${ctx.bucket}/files/${key}`
  return ctx.origin ? `${ctx.origin}${path}` : path
}

const buildSignedDownloadUrl = (
  key: string,
  ctx: ColumnContext
): { readonly signedUrl: string; readonly signedUrlExpiresAt: string } => {
  const expires = ctx.now + DEFAULT_EXPIRES_IN_SECONDS * 1000
  const token = computeDownloadToken(ctx.env, ctx.bucket, key, expires)
  const params = new URLSearchParams({
    path: key,
    op: 'download',
    expires: String(expires),
    token,
  })
  const path = `/api/buckets/${ctx.bucket}/signed?${params.toString()}`
  return {
    signedUrl: ctx.origin ? `${ctx.origin}${path}` : path,
    signedUrlExpiresAt: new Date(expires).toISOString(),
  }
}

const urlPropsForKey = (key: string, ctx: ColumnContext): Readonly<Record<string, unknown>> =>
  ctx.isPublic ? { url: buildPublicUrl(key, ctx) } : buildSignedDownloadUrl(key, ctx)

const enrichAttachmentValue = (value: unknown, ctx: ColumnContext): unknown => {
  if (typeof value === 'string') {
    return value.length > 0 ? { key: value, ...urlPropsForKey(value, ctx) } : value
  }
  if (Array.isArray(value)) return value.map((entry) => enrichAttachmentValue(entry, ctx))
  if (isAttachmentObject(value)) return { ...value, ...urlPropsForKey(value.key, ctx) }
  return value
}

const parseJsonArray = (value: unknown): readonly unknown[] | undefined => {
  if (typeof value !== 'string' || !value.startsWith('[')) return undefined
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

const enrichField = (
  value: RecordFieldValue | FormattedFieldValue,
  fieldType: string,
  ctx: ColumnContext
): RecordFieldValue | FormattedFieldValue => {
  const source = fieldType === 'multiple-attachments' ? (parseJsonArray(value) ?? value) : value
  return enrichAttachmentValue(source, ctx) as RecordFieldValue | FormattedFieldValue
}

const enrichRecordAttachments = (
  record: Readonly<TransformedRecord>,
  options: {
    readonly app: Readonly<App>
    readonly tableName: string
    readonly origin: string
    readonly env: NodeJS.ProcessEnv
    readonly now: number
  }
): TransformedRecord => {
  const { app, tableName } = options
  const { defaultPublic } = resolveStoragePublicAccess(options.env)
  const enrichedFields = Object.fromEntries(
    Object.entries(record.fields).map(([name, value]) => {
      const fieldType = fieldTypeOf(app, tableName, name)
      if (fieldType === undefined || !ATTACHMENT_FIELD_TYPES.has(fieldType)) return [name, value]
      const bucket = resolveFieldBucket(app, tableName, name) ?? DEFAULT_BUCKET
      const isPublic = defaultPublic || app.buckets?.find((b) => b.name === bucket)?.public === true
      return [
        name,
        enrichField(value, fieldType, {
          bucket,
          isPublic,
          origin: options.origin,
          env: options.env,
          now: options.now,
        }),
      ]
    })
  )
  return { ...record, fields: enrichedFields }
}

export const enrichRecordsWithAttachmentUrls = (
  records: readonly TransformedRecord[],
  options: {
    readonly app: Readonly<App> | undefined
    readonly tableName: string | undefined
    readonly origin: string
    readonly env?: NodeJS.ProcessEnv
    readonly now?: number
  }
): readonly TransformedRecord[] => {
  if (!options.app || !options.tableName) return records
  const env = options.env ?? process.env
  const now = options.now ?? Date.now()
  return records.map((record) =>
    enrichRecordAttachments(record, {
      app: options.app!,
      tableName: options.tableName!,
      origin: options.origin,
      env,
      now,
    })
  )
}

export const enrichRecordWithAttachmentUrls = (
  record: Readonly<TransformedRecord>,
  options: {
    readonly app: Readonly<App> | undefined
    readonly tableName: string | undefined
    readonly origin: string
    readonly env?: NodeJS.ProcessEnv
    readonly now?: number
  }
): TransformedRecord => enrichRecordsWithAttachmentUrls([record], options)[0] ?? record
