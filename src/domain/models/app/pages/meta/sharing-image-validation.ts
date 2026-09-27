/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Sharing-image format rule for `openGraph.image` and `twitter.image`.
 *
 * X, LinkedIn, Slack and iMessage do not render an AVIF sharing image: the link
 * shares with no picture at all. A committed raster asset is AVIF and the
 * runtime transform pipeline emits WebP, but a social-card image is neither of
 * those decisions — it must be a format every crawler renders. Only the URL's
 * PATH is read, so a query string or fragment (`og.avif?v=2`) does not hide the
 * extension; a `$record.*` substitution is not resolved here.
 */

const pathOf = (url: string): string => url.split(/[?#]/, 1)[0] ?? url

/** True when the image URL's path names an AVIF file. */
export const isAvifSharingImage = (url: string): boolean =>
  pathOf(url).toLowerCase().endsWith('.avif')

/**
 * The refusal message for an AVIF sharing image under `key`
 * (`openGraph.image` or `twitter.image`).
 */
export const avifSharingImageMessage = (key: string): string =>
  `${key} points at an AVIF file, which X, LinkedIn, Slack and iMessage do not render as a sharing image. Use PNG, JPEG or WebP (1200x630 recommended).`

/**
 * Filter predicate: `true` when the URL is an acceptable sharing image,
 * otherwise the refusal message naming `key`.
 */
export const validateSharingImageFormat =
  (key: string) =>
  (url: string): true | string =>
    isAvifSharingImage(url) ? avifSharingImageMessage(key) : true
