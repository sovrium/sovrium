/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import * as Renderers from '../../renderers/element-renderers'
import {
  computeAudioPlayerClasses,
  computeIframeClasses,
  computeImageClasses,
  computeVideoPlayerClasses,
} from '../../renderers/element-renderers/interactive-content-default-classes'
import { mergePrestyle } from './interactive-prestyle-builders'
import type { ComponentRenderer } from '../component-dispatch-config'
import type { Component } from '@/domain/models/app/pages/components'

export const mediaComponents: Partial<Record<Component['type'], ComponentRenderer>> = {
  image: ({ elementProps, component }) => {
    const variant = (component as Record<string, unknown> | undefined)?.variant as
      | string
      | undefined
    if (variant === 'avatar') return Renderers.renderAvatar(elementProps)
    if (variant === 'thumbnail') return Renderers.renderThumbnail(elementProps)
    if (variant === 'hero') return Renderers.renderHeroImage(elementProps)
    const authorClassName = elementProps['className'] as string | undefined
    const mergedClassName = mergePrestyle(computeImageClasses(), authorClassName)
    return Renderers.renderImage({ ...elementProps, className: mergedClassName })
  },

  video: ({ elementProps, renderedChildren }) => {
    const authorClassName = elementProps['className'] as string | undefined
    const mergedClassName = mergePrestyle(computeVideoPlayerClasses(), authorClassName)
    return Renderers.renderVideo({ ...elementProps, className: mergedClassName }, renderedChildren)
  },

  audio: ({ elementProps, renderedChildren }) => {
    const authorClassName = elementProps['className'] as string | undefined
    const mergedClassName = mergePrestyle(computeAudioPlayerClasses(), authorClassName)
    return Renderers.renderAudio({ ...elementProps, className: mergedClassName }, renderedChildren)
  },

  iframe: ({ elementProps, renderedChildren }) => {
    const authorClassName = elementProps['className'] as string | undefined
    const mergedClassName = mergePrestyle(computeIframeClasses(), authorClassName)
    return Renderers.renderIframe({ ...elementProps, className: mergedClassName }, renderedChildren)
  },
}
