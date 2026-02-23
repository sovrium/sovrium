/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { buildHoverData } from './hover-interaction-handler'
import type { Interactions } from '@/domain/models/app/page/common/interactions/interactions'

/**
 * Merges hover attributes into element props
 *
 * @param elementProps - Base element props
 * @param hoverData - Hover data with attributes
 * @returns Element props with hover attributes merged
 */
function mergeHoverAttributes(
  elementProps: Record<string, unknown>,
  hoverData: { readonly attributes: Record<string, string> } | undefined
): Record<string, unknown> {
  return hoverData ? { ...elementProps, ...hoverData.attributes } : elementProps
}

/**
 * Builds interaction props with hover data merged into element props
 *
 * @param interactions - Component interactions configuration
 * @param uniqueId - Unique ID for hover data
 * @param elementProps - Base element props
 * @param elementPropsWithSpacing - Base element props with spacing
 * @returns Element props with hover attributes and hover data for style injection
 */
export function buildInteractionProps(
  interactions: Interactions | undefined,
  uniqueId: string,
  elementProps: Record<string, unknown>,
  elementPropsWithSpacing: Record<string, unknown>
): {
  readonly finalElementProps: Record<string, unknown>
  readonly finalElementPropsWithSpacing: Record<string, unknown>
  readonly hoverData:
    | { readonly attributes: Record<string, string>; readonly styleContent: string }
    | undefined
} {
  const hoverData = buildHoverData(interactions?.hover, uniqueId)
  const finalElementProps = mergeHoverAttributes(elementProps, hoverData)
  const finalElementPropsWithSpacing = mergeHoverAttributes(elementPropsWithSpacing, hoverData)

  return {
    finalElementProps,
    finalElementPropsWithSpacing,
    hoverData,
  }
}
