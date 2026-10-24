/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Framing origins and the preview token — two free, generic switches.
 *
 * Env vars: SOVRIUM_FRAME_ANCESTORS, SOVRIUM_PREVIEW_TOKEN.
 *
 * `SOVRIUM_FRAME_ANCESTORS` names the origins allowed to show the instance in
 * a frame (`frame-ancestors <list>` instead of `'none'`, and no
 * `X-Frame-Options`, which cannot express a list). `SOVRIUM_PREVIEW_TOKEN`
 * makes the instance answer `404` to every request that does not carry the
 * token, except a health probe from the machine itself. Both are inert when
 * unset, read once at start, and know nothing about any hosting product: any
 * operator may frame their instance from their own dashboard or hide a staging
 * instance behind a token.
 *
 * ## Why env and NOT AppSchema
 *
 * Both describe the HOSTING ENVIRONMENT, not the application: the same config
 * runs framed in an editor's preview and unframed in production. A config key
 * would ship the preview's framing and gate to every deployment of that config.
 *
 * The grammar and the refusal sentences live here, pure, so the boot check and
 * the manual quote one wording. The token value is never part of a refusal.
 */
export const PreviewEnvSchema = Schema.Struct({
  frameAncestors: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Space-separated origins allowed to show the app in a frame (SOVRIUM_FRAME_ANCESTORS). Each is https://host or https://host:port, or http://localhost or http://127.0.0.1 with an optional port; no path, no wildcard, no keyword. Unset, no other site may frame the app.',
        examples: ['https://editor.example.com https://other.example'],
      })
    )
  ),
  previewToken: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'A secret of at least 32 characters (SOVRIUM_PREVIEW_TOKEN). Set, the app answers 404 to every request that does not carry it, except a health probe from the machine itself. Unset, no gate.',
        examples: ['<a random secret of at least 32 characters>'],
      })
    )
  ),
})

export type PreviewEnvConfig = Schema.Schema.Type<typeof PreviewEnvSchema>

/** Read both variables from an env snapshot (defaults to `process.env`). */
export const parsePreviewEnvConfig = (
  processEnv: Readonly<Record<string, string | undefined>> = process.env
): PreviewEnvConfig =>
  Schema.decodeSync(PreviewEnvSchema)({
    frameAncestors: processEnv['SOVRIUM_FRAME_ANCESTORS'],
    previewToken: processEnv['SOVRIUM_PREVIEW_TOKEN'],
  })

/** The shortest preview token accepted. */
export const PREVIEW_TOKEN_MIN_LENGTH = 32

const VARIABLE = 'SOVRIUM_FRAME_ANCESTORS'
const HTTPS_ORIGIN = /^https:\/\/[a-z0-9.-]+(?::\d{1,5})?$/i
const LOCAL_HTTP_ORIGIN = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/i

/**
 * Why one `SOVRIUM_FRAME_ANCESTORS` entry is refused, or `undefined` when it
 * is an origin the header may name. Origins are not secrets: the entry is
 * echoed.
 */
export const frameAncestorRefusal = (entry: string): string | undefined => {
  if (entry === '*' || entry.startsWith("'")) {
    return `${VARIABLE}: "${entry}" is not allowed (name each origin)`
  }
  if (entry.includes('*')) return `${VARIABLE}: "${entry}" is not allowed (no wildcard host)`
  if (HTTPS_ORIGIN.test(entry) || LOCAL_HTTP_ORIGIN.test(entry)) return undefined
  if (/^[a-z][a-z0-9+.-]*:\/\/[^/?#]+[/?#]/i.test(entry)) {
    return `${VARIABLE}: "${entry}" is not an origin (no path allowed)`
  }
  if (/^http:\/\//i.test(entry)) {
    return `${VARIABLE}: "${entry}" is not allowed (use https, or http only for localhost)`
  }
  return `${VARIABLE}: "${entry}" is not an origin`
}

/**
 * The origins `SOVRIUM_FRAME_ANCESTORS` names, or the sentence that refuses
 * the start. `undefined` (unset) is no list and no refusal; a blank value is a
 * refusal, so a variable set by mistake never silently means "nobody".
 */
export const parseFrameAncestors = (
  value: string | undefined
):
  | { readonly _tag: 'Unset' }
  | { readonly _tag: 'Origins'; readonly origins: readonly string[] }
  | { readonly _tag: 'Refused'; readonly message: string } => {
  if (value === undefined) return { _tag: 'Unset' }
  const entries = value.split(/\s+/).filter((entry) => entry !== '')
  if (entries.length === 0) {
    return { _tag: 'Refused', message: `${VARIABLE} is set but names no origin` }
  }
  const refusal = entries.map(frameAncestorRefusal).find((message) => message !== undefined)
  return refusal === undefined
    ? { _tag: 'Origins', origins: entries }
    : { _tag: 'Refused', message: refusal }
}

/**
 * The sentence that refuses the start for a preview token, or `undefined` when
 * the token is acceptable or unset. It never contains the value or its length.
 */
export const previewTokenRefusal = (value: string | undefined): string | undefined =>
  value === undefined || value.length >= PREVIEW_TOKEN_MIN_LENGTH
    ? undefined
    : `SOVRIUM_PREVIEW_TOKEN must be at least ${PREVIEW_TOKEN_MIN_LENGTH} characters`
