/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createHmac } from 'node:crypto'
import { resolveStorageSigningSecret } from '@/application/use-cases/storage/signing-secret'
import { parseJsonArrayCell, parseJsonObjectCell } from '@/domain/kernel/sql/sqlite-json-cell'
import { resolveFieldBucket } from '@/domain/models/app/buckets/field-bucket'
import { resolveStoragePublicAccess } from '@/domain/models/process-env/storage/storage-public-access'
import type { TransformedRecord, RecordFieldValue, FormattedFieldValue } from './record-transformer'
import type { App } from '@/domain/models/app'

/**
 * B-01 / [internal ref]: Decorate attachment column values on a transformed record
 * with a downloadable URL, bound to the bucket DECLARED on the column.
 *
 * - Private buckets: add `signedUrl` (absolute, HMAC-bound to
 *   `/api/buckets/<bucket>/signed`) and `signedUrlExpiresAt` (ISO 8601, 1 hour
 *   from now).
 * - Public buckets — either the operator-global `STORAGE_DEFAULT_ACCESS=public`
 *   or the per-bucket `public: true` flag: add a direct `url`
 *   (`/api/buckets/<bucket>/files/<key>`) — no token, no expiry. `signedUrl` is
 *   intentionally NOT emitted in this mode so the spec contract (`url` must not
 *   contain `token=`) round-trips, and so the platform never mints a
 *   session-free download capability for a bucket that needs none.
 *
 * The function is pure-with-respect-to-time once `now` is fixed by the
 * caller: HMAC is the only crypto operation and matches the signer used by
 * `src/presentation/api/routes/buckets/signed-urls.ts` so the resulting URLs
 * verify successfully when `GET`ed through that handler.
 *
 * ── Shape promotion, and its two bounds ──────────────────────
 * The three attachment field types store three different shapes: an object
 * with `key` (the test-only `'attachment'` alias, JSONB), a bare storage-key
 * string (`single-attachment`, VARCHAR) and an array of key strings
 * (`multiple-attachments`, JSONB). Enrichment PROMOTES the latter two into
 * enriched objects. Bounded by:
 *
 *   1. Only a bare STRING is promoted.
 *   2. An object with no string `key` is left untouched — enrichment is always
 *      a spread-merge, never a replace. This is what keeps a
 *      `storeMetadata: true` value (`{ filename, mimeType, size, url }`, no
 * `key`) intact for `[internal ref]`.
 */

/** Default signed-URL lifetime in seconds (mirrors signed-urls.ts). */
const DEFAULT_EXPIRES_IN_SECONDS = 3600

/** The implicit bucket used when a column declares no `bucket` binding. */
const DEFAULT_BUCKET = 'default'

/**
 * Resolve the HMAC secret used to sign storage URL tokens. Shares one resolver
 * with `signingSecret()` in `presentation/api/routes/buckets/signed-urls.ts`, so
 * a token minted here verifies through the bucket-served download handler; see
 * `resolveStorageSigningSecret` for why the previous
 * `'sovrium-signed-url-dev-secret'` fallback had to go.
 */
const signingSecret = (env: Readonly<NodeJS.ProcessEnv>): string => resolveStorageSigningSecret(env)

/**
 * Compute the HMAC-SHA256 download token. Bound to the same payload string
 * the signed-URL serve handler verifies (`bucket|path|operation|expires`).
 */
const computeDownloadToken = (
  env: Readonly<NodeJS.ProcessEnv>,
  bucket: string,
  path: string,
  expires: number
): string =>
  createHmac('sha256', signingSecret(env))
    .update(`${bucket}|${path}|download|${expires}`)
    .digest('hex')

/**
 * Type-guard for an attachment JSONB object carrying a storage key. We
 * intentionally keep this loose so a value that already shipped through the
 * pipeline once (and now carries `signedUrl` / `url`) is still re-enriched on
 * subsequent reads.
 */
const isAttachmentObject = (
  value: unknown
): value is Readonly<Record<string, unknown>> & { readonly key: string } =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  typeof (value as { key?: unknown }).key === 'string'

/**
 * Attachment column types the read path enriches.
 *
 * `'attachment'` is a test-only alias (absent from `KNOWN_FIELD_TYPES`) kept
 * because `uploadInlineAttachmentContent` is its only writer and
 * `[internal ref]` is its only guard —.
 */
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

/** Per-column enrichment context, resolved once per field rather than per value. */
interface ColumnContext {
  readonly bucket: string
  readonly isPublic: boolean
  readonly origin: string
  readonly env: NodeJS.ProcessEnv
  readonly now: number
}

/**
 * Build the public download URL (no token, no expiry) for a stored key.
 * Absolute (origin-prefixed) when `origin` is non-empty so callers can fetch
 * the result directly — required by [internal ref].
 */
const buildPublicUrl = (key: string, ctx: ColumnContext): string => {
  const path = `/api/buckets/${ctx.bucket}/files/${key}`
  return ctx.origin ? `${ctx.origin}${path}` : path
}

/**
 * Build the signed download URL (HMAC-bound, 1-hour expiry) for a stored
 * key. Origin-prefixed for the same reason as {@link buildPublicUrl}.
 */
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

/** The URL properties merged onto an attachment value for a given storage key. */
const urlPropsForKey = (key: string, ctx: ColumnContext): Readonly<Record<string, unknown>> =>
  ctx.isPublic ? { url: buildPublicUrl(key, ctx) } : buildSignedDownloadUrl(key, ctx)

/**
 * Enrich a single attachment value.
 *
 * - a bare storage-key string  → promoted to `{ key, ...urlProps }`
 * - an array                   → each element enriched independently
 * - an object carrying `key`   → spread-merged with the url props
 * - anything else              → returned untouched (rule 2: never replace)
 */
const enrichAttachmentValue = (value: unknown, ctx: ColumnContext): unknown => {
  if (typeof value === 'string') {
    return value.length > 0 ? { key: value, ...urlPropsForKey(value, ctx) } : value
  }
  if (Array.isArray(value)) return value.map((entry) => enrichAttachmentValue(entry, ctx))
  if (isAttachmentObject(value)) return { ...value, ...urlPropsForKey(value.key, ctx) }
  return value
}

/**
 * Enrich one field value, given the column's declared type. Returns the value
 * unchanged for every non-attachment column.
 *
 * SQLite stores both `multiple-attachments` (a JSON array) and a
 * `storeMetadata: true` attachment (a JSONB document) as TEXT, and the record
 * transformer does not deserialize either type — so the value arrives here as
 * `'["a","b"]'` or `'{"key":"…","name":…}'`. Rule 1 of
 * {@link enrichAttachmentValue} ("only a bare STRING is promoted") would then
 * fire on the serialized document itself: the whole JSON blob becomes the `key`
 * and the signed URL points at a path made of URL-encoded JSON. The value was
 * written correctly and reads back mangled, on the engine that ships by
 * DEFAULT — invisible on PostgreSQL, where JSONB deserializes for free.
 *
 * Parsing first restores rule 2 (an object with no string `key` is left
 * untouched), so a `storeMetadata` value carrying no `key` still survives
 * intact. The parsers are the shared ones so the purge path
 * (`record-delete-handlers.ts`), which had the same defect, cannot drift away
 * from this one again.
 */
const enrichField = (
  value: RecordFieldValue | FormattedFieldValue,
  fieldType: string,
  ctx: ColumnContext
): RecordFieldValue | FormattedFieldValue => {
  const source =
    fieldType === 'multiple-attachments'
      ? (parseJsonArrayCell(value) ?? parseJsonObjectCell(value) ?? value)
      : (parseJsonObjectCell(value) ?? value)
  return enrichAttachmentValue(source, ctx) as RecordFieldValue | FormattedFieldValue
}

/**
 * Decorate every attachment field on `record.fields` with a downloadable URL
 * bound to the bucket declared on that column (falling back to the implicit
 * `'default'` bucket — NOT to the first declared bucket; see
 * {@link resolveFieldBucket}).
 */
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
      // Monotone: the operator-global toggle keeps winning, and the per-bucket
      // `public: true` flag only ever turns MORE things public — so no
      // private-path assertion can regress.
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

/**
 * Decorate every transformed record's attachment fields. Pure-ish factory
 * over `now` / `env` / `origin` so callers can mint URLs that round-trip
 * against the same request origin without the transformer itself reaching
 * for `process.env` or `Date.now()`.
 */
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

/**
 * Single-record variant of {@link enrichRecordsWithAttachmentUrls}. Used by
 * the GET-one and create-record paths whose program returns a single
 * transformed record envelope.
 */
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
