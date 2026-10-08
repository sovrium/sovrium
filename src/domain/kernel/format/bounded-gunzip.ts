/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { gunzipSync } from 'node:zlib'

/**
 * Inflate gzip bytes without ever holding more than a set amount of output.
 *
 * gzip shrinks a run of identical bytes about a thousandfold, so a small
 * upload can expand past any memory a host has. zlib's `maxOutputLength`
 * stops inflating the moment the output would pass the cap and throws
 * `ERR_BUFFER_TOO_LARGE`; nothing past the cap is ever allocated.
 *
 * The two limits every reader of a deployable bundle applies, in this order:
 * the stored (compressed) bytes, then what they unpack to.
 */

/** The most a stored bundle may weigh, compressed: 100 MiB. */
export const BUNDLE_MAX_STORED_BYTES = 104_857_600

/** The most a bundle may unpack to — every entry and its tar headers: 256 MiB. */
export const BUNDLE_MAX_UNPACKED_BYTES = 268_435_456

export type BoundedGunzip =
  | { readonly _tag: 'Inflated'; readonly bytes: Uint8Array }
  | { readonly _tag: 'TooLarge' }
  | { readonly _tag: 'NotGzip' }

const isTooLarge = (error: unknown): boolean =>
  error !== null &&
  typeof error === 'object' &&
  'code' in error &&
  error.code === 'ERR_BUFFER_TOO_LARGE'

/** Inflate `bytes`, refusing output past `cap` bytes and input that is not gzip. */
export const gunzipBounded = (bytes: Uint8Array, cap: number): BoundedGunzip => {
  try {
    return { _tag: 'Inflated', bytes: new Uint8Array(gunzipSync(bytes, { maxOutputLength: cap })) }
  } catch (error) {
    return isTooLarge(error) ? { _tag: 'TooLarge' } : { _tag: 'NotGzip' }
  }
}
