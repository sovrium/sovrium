/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

export type EcoImageFormat = 'avif' | 'webp' | 'jpeg' | 'png'

const ECO_IMAGE_FORMATS: readonly EcoImageFormat[] = ['avif', 'webp', 'jpeg', 'png']

export const DEFAULT_ECO_IMAGE_FORMAT: EcoImageFormat = 'avif'

export const parseEcoImageFormat = (
  processEnv: Readonly<Record<string, string | undefined>>
): EcoImageFormat => {
  const raw = processEnv['ECO_IMAGE_FORMAT']?.trim().toLowerCase()
  return raw !== undefined && (ECO_IMAGE_FORMATS as readonly string[]).includes(raw)
    ? (raw as EcoImageFormat)
    : DEFAULT_ECO_IMAGE_FORMAT
}
