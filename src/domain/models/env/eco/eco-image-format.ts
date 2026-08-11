/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `ECO_IMAGE_FORMAT` env var — operator default for server-side image
 * transcoding when the caller did not specify an explicit output format
 * (standing rule R1).
 *
 * Sovrium's image transform actions (`file.transformImage`, URL transform
 * presets) accept an optional `outputFormat`. When the caller omits it, the
 * Live `ImageTransformService.transform` honours `ECO_IMAGE_FORMAT` as the
 * default codec. Setting the default to `avif` mirrors the rest of the
 * `ECO_*` family (frugal-by-default): AVIF produces ~50% smaller payloads
 * than JPEG and ~20% smaller than WebP at the same visual quality, cutting
 * delivery bytes and downstream client CPU.
 *
 * Operators opt *out* (to `jpeg` / `png` / `webp` for legacy-browser
 * compatibility), they never opt in to AVIF.
 */
export type EcoImageFormat = 'avif' | 'webp' | 'jpeg' | 'png'

const ECO_IMAGE_FORMATS: readonly EcoImageFormat[] = ['avif', 'webp', 'jpeg', 'png']

/** Default when `ECO_IMAGE_FORMAT` is unset (eco-aligned). */
export const DEFAULT_ECO_IMAGE_FORMAT: EcoImageFormat = 'avif'

/**
 * Resolve `ECO_IMAGE_FORMAT` from a snapshot of env vars. An unset, empty,
 * or unrecognised value resolves to the eco-aligned default (`avif`) —
 * operators opt out, they never opt in.
 *
 * Pure: takes the env snapshot as input rather than reading `process.env`
 * directly, matching the convention of the rest of `src/domain/models/env/`.
 */
export const parseEcoImageFormat = (
  processEnv: Readonly<Record<string, string | undefined>>
): EcoImageFormat => {
  const raw = processEnv['ECO_IMAGE_FORMAT']?.trim().toLowerCase()
  return raw !== undefined && (ECO_IMAGE_FORMATS as readonly string[]).includes(raw)
    ? (raw as EcoImageFormat)
    : DEFAULT_ECO_IMAGE_FORMAT
}
