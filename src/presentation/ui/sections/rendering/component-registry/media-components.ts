/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import * as Renderers from '../../renderers/element-renderers'
import type { ComponentRenderer } from '../component-dispatch-config'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * Media components (image, video, audio, iframe, etc.)
 *
 * These components render media content and embedded elements.
 */
export const mediaComponents: Partial<Record<Component['type'], ComponentRenderer>> = {
  image: ({ elementProps, component }) => {
    const variant = (component as Record<string, unknown> | undefined)?.variant as
      | string
      | undefined
    if (variant === 'avatar') return Renderers.renderAvatar(elementProps)
    if (variant === 'thumbnail') return Renderers.renderThumbnail(elementProps)
    if (variant === 'hero') return Renderers.renderHeroImage(elementProps)
    return Renderers.renderImage(elementProps)
  },

  video: ({ elementProps, renderedChildren }) =>
    Renderers.renderVideo(elementProps, renderedChildren),

  audio: ({ elementProps, renderedChildren }) =>
    Renderers.renderAudio(elementProps, renderedChildren),

  iframe: ({ elementProps, renderedChildren }) =>
    Renderers.renderIframe(elementProps, renderedChildren),
}
