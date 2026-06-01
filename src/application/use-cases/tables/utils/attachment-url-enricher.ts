/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createHmac } from 'node:crypto'
import { resolveStoragePublicAccess } from '@/domain/models/env/storage-public-access'
import type { TransformedRecord, RecordFieldValue, FormattedFieldValue } from './record-transformer'
import type { App } from '@/domain/models/app'


const DEFAULT_EXPIRES_IN_SECONDS = 3600

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
  value: RecordFieldValue | FormattedFieldValue
): value is Readonly<Record<string, unknown>> & { readonly key: string } =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  typeof (value as { key?: unknown }).key === 'string'

const ATTACHMENT_FIELD_TYPES = new Set(['attachment'])

const isAttachmentColumn = (app: Readonly<App>, tableName: string, fieldName: string): boolean => {
  const table = app.tables?.find((t) => t.name === tableName)
  return ATTACHMENT_FIELD_TYPES.has(table?.fields.find((f) => f.name === fieldName)?.type ?? '')
}

const buildPublicUrl = (origin: string, key: string): string => {
  const path = `/api/buckets/default/files/${key}`
  return origin ? `${origin}${path}` : path
}

const buildSignedDownloadUrl = (
  env: Readonly<NodeJS.ProcessEnv>,
  origin: string,
  key: string,
  now: number
): { readonly signedUrl: string; readonly signedUrlExpiresAt: string } => {
  const expires = now + DEFAULT_EXPIRES_IN_SECONDS * 1000
  const token = computeDownloadToken(env, 'default', key, expires)
  const params = new URLSearchParams({
    path: key,
    op: 'download',
    expires: String(expires),
    token,
  })
  const path = `/api/buckets/default/signed?${params.toString()}`
  return {
    signedUrl: origin ? `${origin}${path}` : path,
    signedUrlExpiresAt: new Date(expires).toISOString(),
  }
}

const enrichAttachmentValue = (
  value: Readonly<Record<string, unknown>>,
  options: {
    readonly origin: string
    readonly env: NodeJS.ProcessEnv
    readonly now: number
  }
): Readonly<Record<string, unknown>> => {
  const key = value['key'] as string
  const access = resolveStoragePublicAccess(options.env)
  if (access.defaultPublic) {
    return { ...value, url: buildPublicUrl(options.origin, key) }
  }
  return { ...value, ...buildSignedDownloadUrl(options.env, options.origin, key, options.now) }
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
  const enrichedFields = Object.fromEntries(
    Object.entries(record.fields).map(([name, value]) => {
      if (!isAttachmentColumn(options.app, options.tableName, name)) return [name, value]
      if (!isAttachmentObject(value)) return [name, value]
      return [name, enrichAttachmentValue(value, options)]
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
