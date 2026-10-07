/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Admin endpoints for the bucket domain.
 *
 * The three READS — `GET /api/admin/buckets`, `/overview` and
 * `/:bucketName/files` — are admin read-registry entries
 * (`application/use-cases/admin/buckets-read-operations.ts`), mounted here
 * through `chainAdminReadRoutes`: the route, its OpenAPI operation and its MCP
 * admin tool are one entry, each emitting its `bucket.{list|overview|files}.
 * queried` audit entry (canonical `resource.type === 'bucket'`).
 *
 * The console UPLOAD (`POST /api/admin/buckets/:bucketName/files`) is an action
 * and stays hand-written below.
 *
 * Every endpoint is gated upstream by `requireAdminTier()` (admin + operator);
 * unauthenticated and non-admin-tier callers receive 404 per anti-enumeration
 * (S1).
 */

import { Effect } from 'effect'
import { StorageService } from '@/application/ports/services/storage-service'
import { BUCKETS_READ_OPERATIONS } from '@/application/use-cases/admin/admin-read-registry'
import { resolveActor } from '@/application/use-cases/admin/resolve-actor'
import { resolveUploadBucket } from '@/application/use-cases/buckets/resolve-bucket'
import { checkUploadFile } from '@/application/use-cases/buckets/upload-policy'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import { bucketFileUploadResponseSchema } from '@/domain/models/api/admin/buckets/upload'
import { decodeSafe } from '@/domain/models/api/combinators/decode'
import { bucketIdForName, declaredBucketNames } from '@/domain/models/app/buckets/bucket-identity'
import { logError } from '@/infrastructure/logging/logger'
import {
  provideDomain,
  runDomainPromise,
  runRequestEffect,
} from '@/infrastructure/logging/request-effect'
import { buildUploadStorageKey } from '@/infrastructure/storage/upload-key'
import { emitAuditEvent } from '@/presentation/api/admin/audit-events'
import { chainAdminReadRoutes } from '@/presentation/api/admin/read-operation-routes'
import { notFound, payloadTooLarge } from '@/presentation/api/runtime/auth-helpers'
import { requestLogAttributes } from '@/presentation/api/runtime/context-helpers'
import { rejectUpload } from '@/presentation/api/runtime/upload-rejection'
import type { App } from '@/domain/models/app'
import type { ContextWithSession } from '@/presentation/api/middleware/auth'
import type { Context, Hono } from 'hono'

/** Whether `name` is a bucket the app exposes — the built-in `system` or a declared one. */
const isExposedBucket = (app: App, name: string | undefined): name is string =>
  name !== undefined && declaredBucketNames(app.buckets).includes(name)

/**
 * The console's frugal size cap (10 MB) for a bucket that declares no
 * `maxFileSize`, mirroring the signed-URL default. A declared cap and
 * `allowedMimeTypes` are the bucket's own rules, applied as the public upload
 * applies them (`checkUploadFile`, 413 / 400).
 */
const ADMIN_UPLOAD_MAX_SIZE = 10 * 1024 * 1024

const adminErrorBody = (message: string, code: string) => ({ success: false, message, code })

/**
 * POST /api/admin/buckets/:bucketName/files handler — the admin console's file
 * upload. The write counterpart to {@link handleListBucketFiles}; it wires the
 * file browser's "Ajouter un fichier" modal to a real backend.
 *
 * Consumes a `multipart/form-data` body with a single `file` part (the SAME
 * wire format the public upload route accepts). The file is stored under the
 * shared `<uuid>-<filename>` key convention ({@link buildUploadStorageKey}),
 * then the just-written `system.file_storage_metadata` row is read back so the
 * response carries the canonical, list-consistent `bucketFileItemSchema` shape
 * (`{ key, filename, size, mimeType, createdAt }`) under a `{ success, file }`
 * envelope (S4 — never a raw storage row).
 *
 * The bucket's `maxFileSize` and `allowedMimeTypes` are applied before the
 * storage write with the public upload's statuses (413 / 400); a bucket with no
 * declared cap gets the console's 10 MB default. The endpoint is gated
 * upstream by `requireAdminTier()` (admin + operator); unauthenticated and
 * non-admin-tier callers receive 404 per anti-enumeration (S1) — the gate is
 * the method-agnostic `.use('/api/admin/buckets/*', …)` middleware, so the POST
 * is admin-guarded automatically. One `bucket.file.uploaded` audit entry is
 * emitted on success (canonical `resource.type === 'bucket'`).
 */
async function handleUploadBucketFile(c: Context, app: App): Promise<Response> {
  const bucket = c.req.param('bucketName')
  if (!isExposedBucket(app, bucket)) return notFound(c, 'Not found')
  // Parse the multipart body and assert the `file` part is a binary File.
  const body = await c.req.parseBody()
  const { file } = body
  if (!file || !(file instanceof File)) {
    return c.json({ success: false, message: 'No file provided', code: 'BAD_REQUEST' }, 400)
  }

  // The bucket's own rules first (filename, declared size cap, MIME types),
  // answered with the public upload's statuses; then the console default cap.
  if (file.name.length === 0) return c.json(adminErrorBody('Invalid filename', 'BAD_REQUEST'), 400)
  const rules = resolveUploadBucket(app, bucket)
  const rejection = rules && checkUploadFile(rules, file)
  if (rejection) return rejectUpload(c, rejection, adminErrorBody)
  if (rules?.maxFileSize === undefined && file.size > ADMIN_UPLOAD_MAX_SIZE) {
    return payloadTooLarge(
      c,
      `File size ${file.size} bytes exceeds the ${ADMIN_UPLOAD_MAX_SIZE}-byte limit`
    )
  }

  return persistAdminUpload(c, file, bucket)
}

/**
 * Persist a validated admin-console upload via the configured `StorageService`,
 * read back the catalog metadata, validate the response against
 * `bucketFileUploadResponseSchema`, emit the `bucket.file.uploaded` audit entry,
 * and return the 201 response. Extracted from {@link handleUploadBucketFile} to
 * keep that handler under the per-function statement/line thresholds — mirrors
 * the public route's `persistUpload` extraction.
 */
async function persistAdminUpload(c: Context, file: File, bucket: string): Promise<Response> {
  const session = (c as ContextWithSession).var.session!
  const arrayBuffer = await file.arrayBuffer()
  const content = new Uint8Array(arrayBuffer)
  const mimeType = file.type || 'application/octet-stream'
  const key = buildUploadStorageKey(file.name)

  // Upload, then read back the catalog metadata so the response carries the
  // canonical size/createdAt from `system.file_storage_metadata` (the same
  // source the list endpoint reads) rather than echoing request-side values.
  const program = Effect.gen(function* () {
    const storage = yield* StorageService
    yield* storage.upload(key, content, mimeType, { bucket, uploadedById: session.userId })
    return yield* storage.getMetadata(key, bucket)
  })

  const result = await runRequestEffect(c, provideDomain(c, program).pipe(Effect.result))
  if (result._tag === 'Failure') {
    const { cause } = result.failure as { readonly cause?: unknown }
    const message = cause instanceof Error ? cause.message : String(cause)
    logError('[admin] bucket upload failed', result.failure, requestLogAttributes(c))
    return c.json(
      { success: false, message: `Upload failed: ${message}`, code: 'STORAGE_ERROR' },
      500
    )
  }

  const meta = result.success
  const parsed = decodeSafe(bucketFileUploadResponseSchema)({
    success: true,
    file: {
      key: meta.key,
      filename: file.name,
      size: meta.size,
      mimeType: meta.contentType,
      createdAt: meta.lastModified,
    },
  })
  if (!parsed.success) {
    logError('[admin] bucket upload response validation failed', parsed.error)
    return c.json(
      { success: false, message: 'Failed to build upload response', code: 'INTERNAL_ERROR' },
      500
    )
  }

  // Emit one audit entry (canonical resource.type 'bucket' — derived by the
  // emit use-case from the ACTION_CATALOG entry for BUCKET_FILE_UPLOADED).
  const actor = await runDomainPromise(c, resolveActor(session.userId))
  await emitAuditEvent({
    action: AUDIT_ACTIONS.BUCKET_FILE_UPLOADED,
    actor,
    resourceId: bucketIdForName(bucket),
    severity: 'info',
    result: 'success',
  })

  return c.json(parsed.data, 201)
}

/**
 * Chain the admin/buckets routes onto a Hono app.
 *
 * `app` is threaded in because a bucket is a DECLARATION (`app.buckets[]`), not
 * a storage backend: without it the list and the overview could only ever report
 * the one env-resolved backend, contradicting the public upload route and the
 * admin Files sidebar, which both address every declared bucket by name.
 *
 * Auth gating is wired upstream in `createApiRoutes` (authMiddleware +
 * requireAuth + requireAdminTier on the matching paths). The three reads come
 * from the registry; none of their paths overlaps another, and the POST upload
 * never shadows — nor is shadowed by — a GET.
 */
export function chainAdminBucketsRoutes<T extends Hono>(honoApp: T, app: App): T {
  return chainAdminReadRoutes(honoApp, () => app, BUCKETS_READ_OPERATIONS).post(
    '/api/admin/buckets/:bucketName/files',
    (c) => handleUploadBucketFile(c, app)
  ) as T
}
