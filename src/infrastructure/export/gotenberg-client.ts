/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { withFetchTimeout } from '@/infrastructure/egress/with-fetch-timeout'

/**
 * The one Gotenberg 8 client ([internal ref] D2, D3): a multipart POST to one of its
 * routes, its answer read up to a byte cap.
 *
 * Written once for both env families that can point at Gotenberg —
 * `RENDERER_PROVIDER=gotenberg` (the Chromium routes, full
 * `gotenberg/gotenberg:8` image) and `OFFICE_PROVIDER=gotenberg` (the
 * `/forms/libreoffice/convert` route) — so neither grows its own HTTP code.
 *
 * Gotenberg is an operator-run sidecar on a private network by design
 * (Appendix A), so the URL does not go through the outbound-address guard; it
 * is bounded by `withFetchTimeout`, which aborts, like every egress (E6).
 */

/** One file part of the form. Gotenberg keys Chromium inputs by file NAME (`index.html`, `header.html`). */
export interface GotenbergFile {
  readonly name: string
  readonly bytes: Uint8Array
  readonly contentType: string
}

export interface GotenbergRequest {
  readonly baseUrl: string
  /** e.g. `/forms/chromium/convert/html`, `/forms/libreoffice/convert`. */
  readonly route: string
  readonly files: readonly GotenbergFile[]
  readonly fields: Readonly<Record<string, string>>
  readonly timeoutMs: number
  /** The answer is refused past this many bytes, without reading the rest. */
  readonly maxOutputBytes: number
}

export type GotenbergResult =
  | { readonly ok: true; readonly bytes: Uint8Array; readonly contentType: string }
  | {
      readonly ok: false
      readonly reason: 'status'
      readonly status: number
      readonly message: string
    }
  | { readonly ok: false; readonly reason: 'too-large'; readonly message: string }

/** The form Gotenberg expects: every file under the `files` field, then the plain fields. */
export const buildGotenbergForm = (
  files: readonly GotenbergFile[],
  fields: Readonly<Record<string, string>>
): FormData => {
  const form = new FormData()
  files.forEach((file) =>
    form.append(
      'files',
      new Blob([Uint8Array.from(file.bytes)], { type: file.contentType }),
      file.name
    )
  )
  Object.entries(fields).forEach(([name, value]) => form.append(name, value))
  return form
}

/** Read a body up to `max` bytes; `undefined` once it goes past (the stream is cancelled). */
const readCapped = async (response: Response, max: number): Promise<Uint8Array | undefined> => {
  if (response.body === null) return new Uint8Array()
  const reader = response.body.getReader()
  const read = async (
    chunks: readonly Uint8Array[],
    total: number
  ): Promise<Uint8Array | undefined> => {
    const { done, value } = await reader.read()
    if (done) return new Uint8Array(Buffer.concat(chunks))
    const size = total + value.byteLength
    if (size > max) {
      await reader.cancel()
      return undefined
    }
    return read([...chunks, value], size)
  }
  return read([], 0)
}

/**
 * Send one conversion. Resolves a result for every answer Gotenberg gives;
 * rejects only on transport failure — DNS, refused connection, or the deadline
 * (`AbortError`) — which stays the caller's to map.
 */
export const postGotenbergForm = async (request: GotenbergRequest): Promise<GotenbergResult> => {
  const response = await withFetchTimeout(
    `${request.baseUrl.replace(/\/+$/, '')}${request.route}`,
    { method: 'POST', body: buildGotenbergForm(request.files, request.fields) },
    request.timeoutMs
  )
  if (!response.ok) {
    // The body is not read into the message: Gotenberg echoes what it was sent
    // (the document, its URLs), and the message reaches the run's error. The
    // body is cancelled so the connection is released.
    await response.body?.cancel().catch(() => undefined)
    return {
      ok: false,
      reason: 'status',
      status: response.status,
      message: `Gotenberg answered ${String(response.status)}`,
    }
  }
  const bytes = await readCapped(response, request.maxOutputBytes)
  if (bytes === undefined) {
    return {
      ok: false,
      reason: 'too-large',
      message: `the output is above the ${String(request.maxOutputBytes)}-byte limit`,
    }
  }
  return {
    ok: true,
    bytes,
    contentType: response.headers.get('content-type') ?? 'application/octet-stream',
  }
}
