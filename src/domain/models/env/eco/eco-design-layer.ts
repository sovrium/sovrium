/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

export type EcoDesignLayerMode = 'on' | 'off'

export const DEFAULT_ECO_DESIGN_LAYER: EcoDesignLayerMode = 'on'

export const parseEcoDesignLayer = (
  processEnv: Readonly<Record<string, string | undefined>>
): EcoDesignLayerMode => {
  const raw = processEnv['ECO_DESIGN_LAYER']?.trim().toLowerCase()
  return raw === 'off' ? 'off' : DEFAULT_ECO_DESIGN_LAYER
}
