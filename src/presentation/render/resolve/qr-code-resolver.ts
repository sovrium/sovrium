/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Resolve a `{ type: 'qr-code' }` component to the payload it encodes and the
 * SVG that encodes it.
 *
 * WHY THIS IS NOT IN THE RENDERER
 * -------------------------------
 * The encoder is a DOMAIN SERVICE (`@/domain/services/qr-code`), and
 * `boundaries.config.ts` does not let a `presentation-component`
 * (`src/presentation/ui/**`) reach `domain-service` — components may import
 * domain MODELS and utils only. `presentation-rendering` may reach the whole
 * domain layer, and components may import `presentation-rendering`, so this
 * module is the sanctioned hop rather than a workaround: the same shape as
 * `toc-resolver`, which computes for the `toc` renderer what that renderer may
 * not compute itself.
 *
 * It is a pure function — no I/O, no clock, no request — so it stays testable in
 * isolation and the renderer stays purely presentational.
 */

import { encodeQrSvg, type EccLevel } from '@/domain/models/app/links/qr-code-service'

/** The `qr-code` fields that determine what gets encoded and how. */
export interface QrCodeSpec {
  readonly link?: string
  readonly value?: string
  readonly size?: number
  readonly ecc?: EccLevel
  /** Accessible name, taken from the component's generic `props` bag. */
  readonly title?: string
}

/** What the renderer needs in order to paint (or to explain why it cannot). */
export type QrCodeResolution =
  | { readonly kind: 'encoded'; readonly payload: string; readonly svg: string }
  | { readonly kind: 'failed'; readonly payload: string; readonly errorCode: string }
  | { readonly kind: 'nothing-to-encode' }

/**
 * The payload the symbol carries.
 *
 * A `link` becomes `/l/{slug}?qr=1` — RELATIVE, and built from the slug alone.
 * Nothing here resolves the slug against `app.links[]` and nothing absolutizes
 * it: the render config carries neither the link table nor the request origin,
 * and that constraint is also the feature. A component may reference a link no
 * config declares, because a poster is designed before its
 * campaign is set up more often than the reverse.
 *
 * This DELIBERATELY differs from the `/l/{slug}.svg` route, which encodes an
 * ABSOLUTE URL and no `qr=1` marker. That route answers a standalone image
 * request where the origin is known and the fetch is not itself a scan; this
 * payload is inlined into a page and must carry the marker so `link-routes.ts`
 * records a `qr_scan` rather than a `link_click`. The two are not out of step
 * and should not be "aligned".
 *
 * The SHORT url is encoded rather than the destination because a QR carrying a
 * destination can never be re-pointed once printed, and its scans can never be
 * counted apart from clicks.
 *
 * `link` is read first only because the decode-time rule
 * (`@/domain/models/app/qr-code-validation`) guarantees the two are never both
 * present. This is not a precedence, and there is deliberately none.
 */
export const resolveQrPayload = (spec: QrCodeSpec): string | undefined => {
  if (spec.link !== undefined) return `/l/${spec.link}?qr=1`
  return spec.value
}

/**
 * Resolve a component to its symbol.
 *
 * Never throws: `encodeQrSvg` returns its one failure — a payload past
 * version-40 capacity — as a value, because the domain layer is throw-free. That
 * failure is passed through rather than swallowed so the renderer can leave the
 * reason in the markup instead of rendering a silently empty box.
 */
export const resolveQrCode = (spec: QrCodeSpec): QrCodeResolution => {
  const payload = resolveQrPayload(spec)
  // Unreachable for a decoded config — the decode-time rule refuses a component
  // declaring neither `link` nor `value`. Guarded anyway so no render-time
  // synthesis path can hand the encoder an empty string and get a scannable
  // symbol for "".
  if (payload === undefined) return { kind: 'nothing-to-encode' }

  const encoded = encodeQrSvg(payload, {
    ...(spec.size === undefined ? {} : { size: spec.size }),
    ...(spec.ecc === undefined ? {} : { ecc: spec.ecc }),
    // Omitted rather than defaulted: the encoder already falls back to the
    // payload itself, and a default in two places is a default that drifts.
    ...(spec.title === undefined ? {} : { title: spec.title }),
  })

  if (!encoded.ok) return { kind: 'failed', payload, errorCode: encoded.error.code }
  return { kind: 'encoded', payload, svg: encoded.value }
}
