/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Zero-dependency QR encoding.
 *
 * A pure function of its input: no Effect, no I/O, no clock, no randomness —
 * which is what lets it sit in the domain layer and be shared unchanged by the
 * `/l/{slug}.svg` route, the admin preview and the page component, with no port
 * between them.
 *
 * Deliberately NOT an npm dependency. The algorithm is fully specified and
 * stable, the output is deterministic SVG, and the project has been actively
 * shrinking its dependency surface — so the trade is a few hundred lines of
 * well-tested code against a supply-chain surface that never stops needing
 * attention.
 */

import { dataCodewordStream, interleave, selectVersion } from './qr-code-encode'
import { buildMatrix } from './qr-code-matrix'
import { matrixToSvg, type QrSvgOptions } from './qr-code-svg'
import type { EccLevel } from './qr-code-tables'

export type { EccLevel } from './qr-code-tables'
export type { QrSvgOptions } from './qr-code-svg'
export { matrixToSvg } from './qr-code-svg'

/** Encoding options. */
export interface QrOptions extends QrSvgOptions {
  /**
   * Error-correction level. `M` is the print/scan sweet spot and the industry
   * default; `H` becomes necessary the moment a logo is overlaid.
   */
  readonly ecc?: EccLevel
}

/** Why an encode could not produce a symbol. */
export type QrErrorCode = 'payload-too-large'

/** A failed encode, with a message suitable for a log line. */
export interface QrError {
  readonly code: QrErrorCode
  readonly message: string
}

/**
 * Success, or a stated reason — never a throw.
 *
 * `functional/no-throw-statements` is an ERROR across `src/`, and a route that
 * renders a QR must not be crashed by an oversized payload. So the
 * over-capacity case is a VALUE, exactly as `@/domain/kernel/format/date-tokens`
 * returns a `DateTokenResult`: the caller decides the fallback.
 */
export type QrResult<A> =
  { readonly ok: true; readonly value: A } | { readonly ok: false; readonly error: QrError }

/** Encode a payload as a module matrix. `true` is a dark module. */
export const encodeQrMatrix = (
  text: string,
  options: QrOptions = {}
): QrResult<readonly (readonly boolean[])[]> => {
  const ecc = options.ecc ?? 'M'
  const bytes = new TextEncoder().encode(text)
  const version = selectVersion(bytes.length, ecc)
  if (version === undefined) {
    return {
      ok: false,
      error: {
        code: 'payload-too-large',
        message: `QR payload of ${String(bytes.length)} bytes exceeds the capacity of a version-40 symbol at error-correction level ${ecc}`,
      },
    }
  }

  const data = dataCodewordStream(bytes, version, ecc)
  return { ok: true, value: buildMatrix(interleave(data, version, ecc), version, ecc) }
}

/** Encode a payload directly as an SVG document. */
export const encodeQrSvg = (text: string, options: QrOptions = {}): QrResult<string> => {
  const matrix = encodeQrMatrix(text, options)
  if (!matrix.ok) return matrix
  return {
    ok: true,
    value: matrixToSvg(matrix.value, { ...options, title: options.title ?? text }),
  }
}
