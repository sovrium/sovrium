/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The shape of `embedded-licenses.generated.json`: the third-party license
 * texts the binary carries (`sovrium licenses`).
 *
 * Kept apart from the loader (`embedded-licenses.ts`) because the generator
 * (`scripts/build/generate-embedded-licenses.ts`) needs the shape and the
 * guard, and must not import a module whose top-level import is the very file
 * it is about to write.
 */

/** The payload's `format` marker. */
export const EMBEDDED_LICENSES_FORMAT = 'sovrium-third-party-licenses'

/** One third-party component and the license text that travels with it. */
export interface EmbeddedLicenseNotice {
  /** The npm package name, or the asset's human name for a font. */
  readonly name: string
  /** The resolved npm version, or `null` for an asset with no package. */
  readonly version: string | null
  /** SPDX identifier of the license the component is used under. */
  readonly license: string
  /** Where the component comes from, in one line. */
  readonly source: string
  /** The file under `licenses/` the text was read from. */
  readonly file: string
  /** The license text, verbatim. */
  readonly text: string
}

/** One license body, shared by every component whose notice carries it. */
export interface EmbeddedLicenseText {
  /** sha256 prefix of `text`. */
  readonly id: string
  readonly text: string
}

/**
 * A component attributed from its own license file (or a committed
 * supplement): every production npm package the binary ships that needs no
 * hand-written notice of its own.
 */
export interface EmbeddedComponent {
  readonly name: string
  readonly version: string
  /**
   * The declared license as an SPDX expression: `MIT License` reads `MIT`,
   * `MIT OR Apache` reads `MIT OR Apache-2.0`. Only unambiguous spellings are
   * mapped; the build refuses a package whose license cannot be.
   */
  readonly spdx: string
  /** The license exactly as the package declares it. */
  readonly declared: string
  /** Its copyright line(s), verbatim; may be empty when the file carries none. */
  readonly copyright: readonly string[]
  /** The `id` of its body in `texts`. */
  readonly textId: string
}

export interface EmbeddedLicensesPayload {
  readonly format: typeof EMBEDDED_LICENSES_FORMAT
  readonly schemaVersion: 2
  /** Components with a hand-written notice in `licenses/` (MPL, OFL, PSF, the runtime). */
  readonly notices: readonly EmbeddedLicenseNotice[]
  /** Every other component, grouped by identical license body. */
  readonly texts: readonly EmbeddedLicenseText[]
  readonly components: readonly EmbeddedComponent[]
}

const isNotice = (value: unknown): value is EmbeddedLicenseNotice => {
  if (typeof value !== 'object' || value === null) return false
  const notice = value as Record<string, unknown>
  return (
    typeof notice['name'] === 'string' &&
    (typeof notice['version'] === 'string' || notice['version'] === null) &&
    typeof notice['license'] === 'string' &&
    typeof notice['source'] === 'string' &&
    typeof notice['file'] === 'string' &&
    typeof notice['text'] === 'string' &&
    notice['text'].length > 0
  )
}

const isText = (value: unknown): value is EmbeddedLicenseText =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Record<string, unknown>)['id'] === 'string' &&
  typeof (value as Record<string, unknown>)['text'] === 'string'

const isComponent = (value: unknown): value is EmbeddedComponent => {
  if (typeof value !== 'object' || value === null) return false
  const c = value as Record<string, unknown>
  return (
    typeof c['name'] === 'string' &&
    typeof c['version'] === 'string' &&
    typeof c['spdx'] === 'string' &&
    typeof c['declared'] === 'string' &&
    Array.isArray(c['copyright']) &&
    c['copyright'].every((line) => typeof line === 'string') &&
    typeof c['textId'] === 'string'
  )
}

/** Whether a decoded value is a payload this code can read. */
export const isEmbeddedLicensesPayload = (value: unknown): value is EmbeddedLicensesPayload => {
  if (typeof value !== 'object' || value === null) return false
  const payload = value as Record<string, unknown>
  return (
    payload['format'] === EMBEDDED_LICENSES_FORMAT &&
    payload['schemaVersion'] === 2 &&
    Array.isArray(payload['notices']) &&
    payload['notices'].every(isNotice) &&
    Array.isArray(payload['texts']) &&
    payload['texts'].every(isText) &&
    Array.isArray(payload['components']) &&
    payload['components'].every(isComponent)
  )
}
