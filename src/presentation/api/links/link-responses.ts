/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The addresses a short link answers at, and the responses that are not a
 * redirect.
 *
 * Extracted verbatim from `route-setup/link-routes.ts` in W5c, which was 492
 * lines against a 400 ceiling. This half owns ADDRESSING — how `/l/{token}`
 * splits into a slug and a variant, what the one canonical spelling is, and
 * what a QR render or an expired link answers with. The redirect itself stays
 * in `routes.ts`, because deciding where a visitor goes is the handler's job.
 */

import { QR_MARKER_PARAM } from '@/domain/models/app/links/link-resolver'
import { encodeQrSvg } from '@/domain/models/app/links/qr-code-service'
import type { LinkOutcome } from '@/domain/models/app/links/link-resolver'
import type { Context } from 'hono'

/** The fixed, non-configurable base path. */
export const LINK_PREFIX = '/l/'
export const SVG_SUFFIX = '.svg'

/** Shared `gone` outcome for the overlay veto — the QR path needs one too. */
export const GONE: Extract<LinkOutcome, { readonly kind: 'gone' }> = { kind: 'gone' }

/**
 * Split `/l/{token}` into the slug it names and which variant was asked for.
 *
 * The slug charset forbids `.`, so the suffix test is an EXACT discriminator
 * rather than a heuristic — there is no slug for which this split is wrong.
 */
export const splitSvgVariant = (
  raw: string
): { readonly slug: string; readonly isSvg: boolean } => {
  const isSvg = raw.endsWith(SVG_SUFFIX)
  return { slug: isSvg ? raw.slice(0, -SVG_SUFFIX.length) : raw, isSvg }
}

/** The one canonical address for a slug, preserving the variant asked for. */
export const canonicalPath = (slug: string, isSvg: boolean): string =>
  `${LINK_PREFIX}${slug.toLowerCase()}${isSvg ? SVG_SUFFIX : ''}`

/** The absolute address this link is served at, for QR encoding. */
export const absoluteShortUrl = (c: Context, slug: string): string => {
  const url = new URL(c.req.url)
  return `${url.origin}${LINK_PREFIX}${slug}?${QR_MARKER_PARAM}=1`
}

/**
 * Answer the `.svg` variant for an already-resolved link.
 *
 * Split out of the handler so the redirect path reads as one straight line. A
 * render is not a scan, so nothing is recorded here — but the QR endpoint still
 * agrees with the redirect endpoint about LIVENESS, because printing a code for
 * a link that no longer resolves is the worst outcome available: it fails in the
 * field, months later, where nobody can fix it.
 */
export const respondWithQr = (c: Context, outcome: LinkOutcome, slug: string): Response => {
  // eslint-disable-next-line unicorn/no-null -- Hono's empty-body idiom; see analytics.ts
  if (outcome.kind === 'gone') return c.body(null, 410)

  // `encodeQrSvg` returns a result rather than throwing (the domain layer is
  // throw-free); its only failure is a payload past version-40 capacity, which a
  // short URL cannot reach — so it is a 500, not a shaped error.
  const svg = encodeQrSvg(absoluteShortUrl(c, slug))
  if (!svg.ok) return c.text(svg.error.message, 500)

  return c.body(svg.value, 200, {
    'Content-Type': 'image/svg+xml; charset=utf-8',
    'Cache-Control': 'public, max-age=31536000, immutable',
  })
}

/**
 * Answer a link that no longer resolves.
 *
 * 410 Gone, not 404 — the URL genuinely did exist, and 410 tells a crawler to
 * drop it and a human that it expired rather than that they mistyped. A link
 * declaring `expiredTo` redirects there instead, which is the only way an
 * operator has to retire an address that is already in print.
 */
export const respondGone = (c: Context, outcome: { readonly location?: string }): Response =>
  outcome.location === undefined
    ? // eslint-disable-next-line unicorn/no-null -- Hono's empty-body idiom; see analytics.ts
      c.body(null, 410)
    : c.redirect(outcome.location, 302)
