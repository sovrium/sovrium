/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { StorageService } from '@/application/ports/services/storage-service'
import { accountAvatarResponseSchema } from '@/domain/models/api/auth/account'
import { successResponseSchema } from '@/domain/models/api/common'
import {
  AVATAR_BUCKET_NAME,
  avatarStorageKeyFromUrl,
  buildIssuedAvatarUrl,
  resolveAvatarBucket,
} from '@/domain/models/app/auth/avatar-url'
import { logError } from '@/infrastructure/logging/logger'
import { readSourceImageMetadata } from '@/infrastructure/storage/bun-image'
import { evictTransformCacheForKey } from '@/infrastructure/storage/transform-cache'
import { acceptsUploadBody } from '@/presentation/api/middleware/request-body-limit'
import { storageErrorBody, unauthorized } from '@/presentation/api/runtime/auth-helpers'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import { readMultipartFile } from '@/presentation/api/runtime/multipart-file'
import {
  answerFailures,
  respondWith,
  runHandlerEffect,
} from '@/presentation/api/runtime/run-effect'
import type { AvatarProfileStore } from '@/application/ports/contracts/avatar-profile-store'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

/** The profile store did not answer a read or a write of the caller's image. */
class AvatarProfileError extends Data.TaggedError('AvatarProfileError')<{
  readonly cause: unknown
}> {}

/** One call to the injected profile store, on the handler's program. */
const profileStep = <A>(run: () => Promise<A>) =>
  Effect.tryPromise({ try: run, catch: (cause) => new AvatarProfileError({ cause }) })

/**
 * `POST` / `DELETE /api/account/avatar` — the only writers of `auth.user.image`.
 *
 * `applyAvatarUrlGuard` refuses every non-null avatar a CLIENT supplies, on all
 * four Better Auth write doors. That leaves the column writable only by code
 * that produced the object itself, which is this file: it decodes the bytes,
 * stores them, mints the URL from the key it just wrote, and persists through
 * the injected {@link AvatarProfileStore}. "The server issued this URL" is
 * therefore a fact about the code path, not a shape the value happens to have —
 * which matters because shape can be forged. The object is also catalogued
 * against its owner (`file_storage_metadata.uploaded_by_id`), which is how
 * erasure finds it with every other file the person uploaded.
 *
 * ## Both verbs are session-scoped by construction
 *
 * Neither route takes a `:userId`. The id comes only from the session, so there
 * is no cross-account write to forget to gate — the same property the rest of
 * `/api/account/*` relies on.
 *
 * ## 401, not 404, for an anonymous caller
 *
 * The anti-enumeration 404 hides the EXISTENCE of a resource whose id a prober
 * might guess. There is no id here and nothing to enumerate: the route is the
 * same route for everybody, and the only thing a 404 would hide is that account
 * self-service exists at all — which `/api/account/export` already announces.
 * This matches `GET /api/users/directory`, and differs from `purge-due`, whose
 * 404 hides a destructive internal trigger.
 */

/**
 * Storing a decoded image means naming a file, and the caller's filename is the
 * one part of an upload that is entirely attacker-chosen. Rather than validating
 * it, this route DISCARDS it and derives the extension from what the bytes
 * actually decoded to. That removes path traversal, null bytes and
 * extension/content mismatch as categories rather than as checks — and it means
 * the suffix the download path reads back (`inferMimeFromKey`) describes the
 * real container.
 *
 * Only the three formats `Bun.Image` can both decode AND encode on every
 * supported backend are accepted. A format it can decode but not re-encode would
 * upload fine and then fail at download time inside the transform pipeline — a
 * defect that only appears later, on another route, for one user.
 */
const AVATAR_EXTENSION_BY_FORMAT: Readonly<Record<string, string>> = {
  png: 'png',
  jpeg: 'jpg',
  jpg: 'jpg',
  webp: 'webp',
}

/**
 * Byte ceiling for an avatar, used when the `avatars` bucket declares no
 * `maxFileSize` of its own.
 *
 * A cap has to exist because the bytes are read fully into memory before they
 * are decoded, so an unbounded upload is a memory-exhaustion vector on a route
 * any signed-in user can reach. 5 MiB is far above any sane profile picture and
 * far below anything that threatens the process.
 */
const DEFAULT_AVATAR_MAX_BYTES = 5_242_880

const badRequest = (c: Context, error: string) =>
  c.json(storageErrorBody(error, 'BAD_REQUEST'), 400)

/**
 * The avatar bucket, resolved the ONE way — the host's if it declares one,
 * otherwise the engine-owned fallback.
 *
 * Never `undefined`, even for an app with no declared bucket: rather than
 * refusing to mint a URL nothing would serve, the fallback makes the download
 * route serve that URL. Still NOT the built-in `system` bucket: the minted URL names
 * `avatars` literally, and `system` carries record attachments and their own
 * rules.
 */
const resolveAvatarBucketFor = (app: App) => resolveAvatarBucket(app.buckets)

/**
 * Remove a stored avatar object and drop every cached transform derived from it.
 *
 * The eviction is not housekeeping. `serveFileDownload` answers from a
 * process-local LRU BEFORE it touches storage, so a key that has been fetched
 * once keeps serving 200 from memory after the object is deleted — the avatar
 * would look erased in the database and remain readable over HTTP. `no-op` when
 * the stored value is not one this instance issued (a legacy external URL names
 * no local object).
 *
 * Failure is logged, not propagated: the caller has already decided the avatar
 * is going away, and refusing to clear the column because the blob store was
 * briefly unreachable would leave the user pointing at an object that may well
 * be gone anyway.
 */
const removeAvatarObject = (storedImage: string | null) =>
  Effect.gen(function* () {
    const key = avatarStorageKeyFromUrl(storedImage)
    if (key === undefined) return

    const storage = yield* StorageService
    // Bracket notation dodges a `drizzle/enforce-delete-with-where` false
    // positive on the storage port's `delete` — same workaround as `buckets.ts`.
    yield* storage['delete'](key, AVATAR_BUCKET_NAME).pipe(
      Effect.tapCause((cause) =>
        Effect.sync(() => logError('[account] avatar object delete failed', cause))
      ),
      // effect-swallow: logged above; the caller has already decided the avatar is going away.
      Effect.orElseSucceed(() => undefined)
    )
    evictTransformCacheForKey(key)
  })

/**
 * Decode `bytes` and report the extension to store them under, or `undefined`
 * when they are not an image this instance will serve.
 *
 * This is the whole point of `-004`. The declared `Content-Type` on a multipart
 * part is a field the uploader fills in, so gating on it — which is what the
 * buckets route's `isMimeTypeAllowed(bucket, file.type)` does — only refuses an
 * attacker who volunteers the truth. `Bun.Image#metadata()` parses the actual
 * container header and rejects anything it cannot recognise, so HTML that calls
 * itself `image/png` fails here rather than being stored and later served from
 * this instance's own origin.
 */
async function decodeAvatarExtension(bytes: Uint8Array): Promise<string | undefined> {
  const metadata = await readSourceImageMetadata(bytes).catch(() => undefined)
  if (metadata === undefined) return undefined
  return AVATAR_EXTENSION_BY_FORMAT[metadata.format.toLowerCase()]
}

/** Effective byte ceiling: the bucket's own limit when declared, else the default. */
const resolveAvatarMaxBytes = (maxFileSize: number | undefined): number =>
  maxFileSize !== undefined && maxFileSize > 0 ? maxFileSize : DEFAULT_AVATAR_MAX_BYTES

/**
 * Read the multipart `file` part, enforcing presence and the size ceiling.
 * Returns either the bytes or the response that refuses them.
 */
async function readAvatarUpload(
  c: Context,
  maxBytes: number
): Promise<{ readonly bytes: Uint8Array } | { readonly response: Response }> {
  const file = await readMultipartFile(c, 'file')
  if (file === undefined) return { response: badRequest(c, 'No file provided') }
  if (file.size > maxBytes) {
    return {
      response: c.json(
        storageErrorBody(
          `File size ${file.size} bytes exceeds the avatar limit of ${maxBytes} bytes`,
          'PAYLOAD_TOO_LARGE'
        ),
        413
      ),
    }
  }
  return { bytes: new Uint8Array(await file.arrayBuffer()) }
}

/**
 * Store the decoded bytes and persist the URL they were issued under.
 *
 * Order is load-bearing. The object is written FIRST, so the column never names
 * an object that does not exist; the PREVIOUS object is removed LAST, so a
 * failure part-way through leaves a replaceable orphan rather than a user whose
 * avatar 404s. Extracted from the handler to keep it under the statement cap.
 */
const persistAvatar = (
  c: Context,
  store: AvatarProfileStore,
  userId: string,
  upload: { readonly bytes: Uint8Array; readonly extension: string }
) =>
  Effect.gen(function* () {
    const key = `${crypto.randomUUID()}-avatar.${upload.extension}`
    const mimeType = upload.extension === 'jpg' ? 'image/jpeg' : `image/${upload.extension}`
    const storage = yield* StorageService
    const stored = yield* Effect.result(
      storage.upload(key, upload.bytes, mimeType, {
        bucket: AVATAR_BUCKET_NAME,
        uploadedById: userId,
      })
    )
    if (stored._tag === 'Failure') {
      logError('[account] avatar upload failed', stored.failure)
      return c.json(storageErrorBody('Avatar upload failed', 'STORAGE_ERROR'), 500)
    }

    const previous = yield* profileStep(() => store.readImage(userId))
    const image = buildIssuedAvatarUrl(key)
    yield* profileStep(() => store.writeImage(userId, image))
    // Only once the column points at the NEW object is the old one collectable.
    yield* removeAvatarObject(previous)

    return yield* respondWith(
      c,
      Effect.succeed({ success: true, image }),
      accountAvatarResponseSchema,
      201
    )
  })

/** `POST /api/account/avatar` — upload and set the caller's profile image. */
function createHandleUploadAvatar(app: App, store: AvatarProfileStore) {
  return async (c: Context): Promise<Response> => {
    const session = getSessionContext(c)
    if (session === undefined) return unauthorized(c)

    // Never `undefined`: an app declaring no bucket gets the engine-owned one.
    // A 404 here would report a MISCONFIGURED host, which is the wrong answer
    // for the operator console —
    // it ships inside every binary and cannot require its host to have declared
    // a bucket on its behalf.
    const bucket = resolveAvatarBucketFor(app)

    const read = await readAvatarUpload(c, resolveAvatarMaxBytes(bucket.maxFileSize))
    if ('response' in read) return read.response

    const extension = await decodeAvatarExtension(read.bytes)
    if (extension === undefined) {
      return badRequest(c, 'File is not a decodable PNG, JPEG or WebP image')
    }

    return runHandlerEffect(
      c,
      answerFailures(c, persistAvatar(c, store, session.userId, { bytes: read.bytes, extension }))
    )
  }
}

/** `DELETE /api/account/avatar` — clear the column and remove the object. */
function createHandleDeleteAvatar(store: AvatarProfileStore) {
  return (c: Context): Promise<Response> | Response => {
    const session = getSessionContext(c)
    if (session === undefined) return unauthorized(c)
    const { userId } = session

    return runHandlerEffect(
      c,
      answerFailures(
        c,
        Effect.gen(function* () {
          const previous = yield* profileStep(() => store.readImage(userId))
          // Clear the column first: it is the value every reader projects, so it is
          // the one that must stop naming the object even if the blob store is down.
          yield* profileStep(() => store.writeImage(userId, null))
          yield* removeAvatarObject(previous)

          return yield* respondWith(c, Effect.succeed({ success: true }), successResponseSchema)
        })
      )
    )
  }
}

/**
 * Chain the two avatar routes onto a Hono app.
 *
 * `authMiddleware` for `/api/account/*` is installed upstream in
 * `createApiRoutes`, so the handlers can read the session and answer 401
 * themselves — the same arrangement the rest of the account routes use.
 */
export function chainAccountAvatarRoutes<T extends Hono>(
  honoApp: T,
  app: App,
  store: AvatarProfileStore
): T {
  // DELETE registered via `.on()` to avoid a `drizzle/enforce-delete-with-where`
  // false positive on the Hono builder — same workaround as `chainBucketRoutes`.
  return honoApp
    .post('/api/account/avatar', acceptsUploadBody(createHandleUploadAvatar(app, store)))
    .on('DELETE', '/api/account/avatar', createHandleDeleteAvatar(store)) as T
}
