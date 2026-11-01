/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { parsePositiveIntEnv } from '@/domain/models/process-env/positive-int-env'
import type { App } from '@/domain/models/app'

/** The upload limit when neither a bucket nor `STORAGE_MAX_FILE_SIZE` sets one (100 MiB). */
const DEFAULT_UPLOAD_LIMIT_BYTES = 100 * 1024 * 1024

/** The `/api/*` body limit when `API_BODY_LIMIT_BYTES` is unset (1 MiB). */
const DEFAULT_API_BODY_LIMIT_BYTES = 1024 * 1024

/** Room for a multipart envelope around the largest file the deployment accepts. */
const MULTIPART_ENVELOPE_BYTES = 1024 * 1024

/**
 * The listener never refuses below 25 MiB, however small the file limits are.
 * Bun's own refusal is a bare `413` with no body; under this floor, a file a
 * little over a small limit still reaches its route, which refuses it in the
 * API's error shape and says which limit it broke. Every route that does not
 * take a file is held to `API_BODY_LIMIT_BYTES` by `request-body-limit.ts`
 * whatever this floor is.
 */
const LISTENER_FLOOR_BYTES = 25 * 1024 * 1024

/**
 * The largest request body the LISTENER accepts, before any route reads it:
 * the upload ceiling.
 *
 * Bun buffers a request body up to `maxRequestBodySize` (128 MiB when unset)
 * whatever the route, so the listener can only be given ONE size, and it must
 * be the largest any route legitimately receives: the largest file any bucket
 * accepts (a bucket's own `maxFileSize`, or the global `STORAGE_MAX_FILE_SIZE`,
 * else 100 MiB, which the built-in `system` bucket and every bucket without
 * its own limit use) plus 1 MiB for the multipart envelope — never below
 * 25 MiB ({@link LISTENER_FLOOR_BYTES}), and never below
 * `API_BODY_LIMIT_BYTES`, should an operator raise that above it. Anything
 * larger is refused by Bun with `413` before Hono sees it.
 *
 * This is NOT what keeps sign-in or a JSON route small. That is the per-route
 * limit (`request-body-limit.ts`): every `/api/*` route that does not take a
 * file is refused past `API_BODY_LIMIT_BYTES`, 1 MiB by default, before it
 * reads its body.
 *
 * Pure in `app` and `env`, so a `--watch` reload recomputes it from the new
 * config and a test can pin each case.
 */
export const resolveMaxRequestBodySize = (
  app: Readonly<Pick<App, 'buckets'>>,
  env: Readonly<Record<string, string | undefined>> = process.env
): number => {
  const globalUploadLimit =
    parsePositiveIntEnv(env['STORAGE_MAX_FILE_SIZE']) ?? DEFAULT_UPLOAD_LIMIT_BYTES
  const largestUpload = Math.max(
    globalUploadLimit,
    ...(app.buckets ?? []).map((bucket) => bucket.maxFileSize ?? 0)
  )
  const apiBodyLimit =
    parsePositiveIntEnv(env['API_BODY_LIMIT_BYTES']) ?? DEFAULT_API_BODY_LIMIT_BYTES
  return Math.max(largestUpload + MULTIPART_ENVELOPE_BYTES, apiBodyLimit, LISTENER_FLOOR_BYTES)
}
