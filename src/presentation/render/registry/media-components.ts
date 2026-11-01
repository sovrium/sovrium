/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createElement, Fragment, type ReactElement } from 'react'
import {
  computeAudioPlayerClasses,
  computeIframeClasses,
  computeImageClasses,
  computeVideoPlayerClasses,
} from '../../design/interactive-content-default-classes'
import { resolveClasses } from '../../design/resolve-classes'
import * as Renderers from '../elements'
import { inlineDrawingOf } from '../resolve/inline-svg-resolver'
import { mergePrestyle } from './interactive-prestyle-builders'
import { qrCodeComponent } from './qr-code-component'
import type { ComponentRenderer, DispatchableComponentType } from './component-dispatch-config'
import type { ElementProps } from '../elements/html-element-renderer'

/** One image in its variant's renderer: `avatar`, `thumbnail`, `hero`, or the bare default. */
const renderImageVariant = (variant: string | undefined, props: ElementProps): ReactElement => {
  if (variant === 'avatar') return Renderers.renderAvatar(props)
  if (variant === 'thumbnail') return Renderers.renderThumbnail(props)
  if (variant === 'hero') return Renderers.renderHeroImage(props)
  const authorClassName = props['className'] as string | undefined
  return Renderers.renderImage({
    ...props,
    className: mergePrestyle(computeImageClasses(), authorClassName),
  })
}

/**
 * An image with `props.srcDark` renders twice under one `alt`, as the app's
 * logo does: the `src` file hidden once the page carries `.dark`, the `srcDark`
 * file shown only then. The scheme classes are merged LAST, so an author's own
 * display class can never reveal both. `srcDark` is spent here: it never
 * reaches the markup, neither as written nor as the `data-src-dark` the generic
 * prop conversion derives from it. The dark copy drops the `id`, which must
 * stay unique on the page.
 */
const renderImage = (variant: string | undefined, elementProps: ElementProps): ReactElement => {
  const { srcDark, 'data-src-dark': _dataSrcDark, ...props } = elementProps
  if (typeof srcDark !== 'string' || srcDark === '') return renderImageVariant(variant, props)
  const author = props['className'] as string | undefined
  const { id: _id, ...darkProps } = props
  return createElement(
    Fragment,
    undefined,
    createElement(
      Fragment,
      { key: 'light' },
      renderImageVariant(variant, {
        ...props,
        className: resolveClasses('', undefined, author, 'dark:hidden'),
      })
    ),
    createElement(
      Fragment,
      { key: 'dark' },
      renderImageVariant(variant, {
        ...darkProps,
        src: srcDark,
        className: resolveClasses('', undefined, author, 'hidden dark:block'),
      })
    )
  )
}

/**
 * Media components (image, video, audio, iframe, etc.)
 *
 * These components render media content and embedded elements. Each variant
 * gets a prestyled default className from
 * `interactive-content-default-classes.ts` (the prestyled-islands rule, prestyled-by-default)
 * so a bare schema-author `{ type: 'image', src: '...' }` renders with the
 * canonical Sovrium surface chrome (radius / border / object-fit) without
 * the author spelling any classes.
 *
 * The `image` variant branches (`avatar` / `thumbnail` / `hero`) keep their
 * existing dedicated renderers because those already paint their own radius
 * recipe (full / md / lg-top). Only the bare `default` variant routes through
 * `computeImageClasses` — applying the helper across all four variants would
 * fight the radius these renderers already set.
 */
export const mediaComponents: Partial<Record<DispatchableComponentType, ComponentRenderer>> = {
  image: ({ elementProps, component }) => {
    const node = component as Record<string, unknown> | undefined
    const variant = node?.variant as string | undefined
    if (typeof node?.inlineSvg !== 'string') return renderImage(variant, elementProps)
    // A drawing the resolver could not read is the plain image it would have been.
    const drawing = inlineDrawingOf(node)
    return drawing === undefined
      ? renderImage(variant, { ...elementProps, src: node.inlineSvg })
      : Renderers.renderInlineDrawing(elementProps, drawing)
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

  // `qr-code` — a scannable symbol rendered inline. Grouped with the media
  // components because it is a static rendering of a value, but delegated to its
  // own `.tsx` file: it needs JSX for `dangerouslySetInnerHTML`, which this `.ts`
  // module cannot carry. Deliberately emits NO `data-island` — see the renderer.
  'qr-code': qrCodeComponent,
}
