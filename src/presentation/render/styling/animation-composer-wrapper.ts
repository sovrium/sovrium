/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { composeAnimation } from '@/presentation/render/styling/animation-composer'
import type { Design } from '@/domain/models/app/design'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * Apply all component-specific animations functionally using composition
 * Compose fadeOut animation for toast components
 * Compose scaleUp animation for card components with scroll trigger
 * Compose float animation for fab components (continuous floating effect)
 */
export function applyComponentAnimations(
  type: Component['type'],
  baseStyle: Record<string, unknown> | undefined,
  design?: Design
): Record<string, unknown> | undefined {
  const styleWithFadeOut =
    type === 'toast'
      ? composeAnimation({
          baseStyle,
          animationName: 'fadeOut',
          design,
          defaultDuration: '300ms',
          defaultEasing: 'ease-out',
        })
      : baseStyle

  const styleWithScaleUp =
    type === 'card'
      ? composeAnimation({
          baseStyle: styleWithFadeOut,
          animationName: 'scaleUp',
          design,
          defaultDuration: '500ms',
          defaultEasing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
          options: {
            animationPlayState: 'paused',
            animationFillMode: 'forwards',
            opacity: 0,
          },
        })
      : styleWithFadeOut

  const finalStyle =
    type === 'fab'
      ? composeAnimation({
          baseStyle: styleWithScaleUp,
          animationName: 'float',
          design,
          defaultDuration: '3s',
          defaultEasing: 'ease-in-out',
          options: {
            infinite: true,
          },
        })
      : styleWithScaleUp

  return finalStyle
}
