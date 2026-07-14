/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { buildHoverData } from './hover-interaction-handler'
import type { Interactions } from '@/domain/models/app/pages/components/interactions/interactions'

function mergeHoverAttributes(
  elementProps: Record<string, unknown>,
  hoverData: { readonly attributes: Record<string, string> } | undefined
): Record<string, unknown> {
  return hoverData ? { ...elementProps, ...hoverData.attributes } : elementProps
}

export function buildInteractionProps(
  interactions: Interactions | undefined,
  uniqueId: string,
  elementProps: Record<string, unknown>,
  elementPropsWithSpacing: Record<string, unknown>
): {
  readonly finalElementProps: Record<string, unknown>
  readonly finalElementPropsWithSpacing: Record<string, unknown>
  readonly hoverData:
    { readonly attributes: Record<string, string>; readonly styleContent: string } | undefined
} {
  const hoverData = buildHoverData(interactions?.hover, uniqueId)
  const clickModalProps = interactions?.click?.modal
    ? { 'data-click-modal': interactions.click.modal }
    : {}
  const finalElementProps = { ...mergeHoverAttributes(elementProps, hoverData), ...clickModalProps }
  const finalElementPropsWithSpacing = {
    ...mergeHoverAttributes(elementPropsWithSpacing, hoverData),
    ...clickModalProps,
  }

  return {
    finalElementProps,
    finalElementPropsWithSpacing,
    hoverData,
  }
}
