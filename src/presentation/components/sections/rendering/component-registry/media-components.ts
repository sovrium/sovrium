/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import * as Renderers from '../../renderers/element-renderers'
import type { ComponentRenderer } from '../component-dispatch-config'
import type { Component } from '@/domain/models/app/page/sections'

/**
 * Media components (image, video, audio, iframe, etc.)
 *
 * These components render media content and embedded elements.
 */
export const mediaComponents: Partial<Record<Component['type'], ComponentRenderer>> = {
  image: ({ elementProps }) => Renderers.renderImage(elementProps),

  img: ({ elementProps }) => Renderers.renderImage(elementProps),

  avatar: ({ elementProps }) => Renderers.renderAvatar(elementProps),

  thumbnail: ({ elementProps }) => Renderers.renderThumbnail(elementProps),

  'hero-image': ({ elementProps }) => Renderers.renderHeroImage(elementProps),

  video: ({ elementProps, renderedChildren }) =>
    Renderers.renderVideo(elementProps, renderedChildren),

  audio: ({ elementProps, renderedChildren }) =>
    Renderers.renderAudio(elementProps, renderedChildren),

  iframe: ({ elementProps, renderedChildren }) =>
    Renderers.renderIframe(elementProps, renderedChildren),
}
