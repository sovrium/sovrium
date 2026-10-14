/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Context } from 'hono'

/**
 * The one binary part a `multipart/form-data` upload carries under `field`, or
 * `undefined` when the body is not multipart or that part is not a file.
 *
 * Decoded here, in the request runtime, because a multipart body has no Effect
 * Schema: the only shape a single-file upload route accepts is "a `File` under
 * this name", and anything else — a text value, a missing part, a body that does
 * not parse — is answered as absent rather than handed on unchecked.
 */
export const readMultipartFile = async (c: Context, field: string): Promise<File | undefined> => {
  const body = await c.req.parseBody().catch(() => undefined)
  const part = body?.[field]
  return part instanceof File ? part : undefined
}
