/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import { hostComponentType } from '@/presentation/render/registry/island-host-attributes'
import {
  isOpenSpecimen,
  renderOpenOverlay,
  type OpenOverlayContent,
  type OpenOverlayKind,
} from '@/presentation/render/resolve/open-specimen-markup'
import type { ComponentDispatchConfig, ComponentRenderer } from './component-dispatch-config'
import type { ReactElement } from 'react'

/**
 * `specimenOpen` on an overlay — `dialog`, `alert-dialog`, `sheet`, `drawer` —
 * draws it OPEN inside a bounded frame instead of mounting its island
 * (`open-overlay-specimen.tsx`). The flag is set by the surface drawing a
 * specimen (the component kit of the design-system bundle), never by an author
 * describing a control they want to work, which is why it is read off `props`
 * as the menu's and the date picker's open specimens are.
 *
 * It wraps each overlay renderer rather than branching inside it: the four
 * renderers keep one job (mounting their island), and the depiction stays one
 * reading of one flag. The wrap sits on each registry VALUE, never around a
 * registry object, which the CSS attribution reads as a literal.
 */

/** A string the component declares, top-level first, else in its props. */
const textOf = (context: ComponentDispatchConfig, key: string): string | undefined => {
  const top = (context.component as Readonly<Record<string, unknown>> | undefined)?.[key]
  const fromProps = context.rawProps?.[key]
  return typeof top === 'string' ? top : typeof fromProps === 'string' ? fromProps : undefined
}

/** What the open overlay shows, read off the component as its island would. */
const contentOf = (kind: OpenOverlayKind, context: ComponentDispatchConfig): OpenOverlayContent => {
  const title = textOf(context, 'title')
  const description = textOf(context, 'description') ?? textOf(context, 'content')
  const childrenHtml = context.renderedChildren.map((child) => renderToStaticMarkup(child)).join('')
  return {
    ...(title === undefined ? {} : { title }),
    ...(description === undefined ? {} : { description }),
    ...(childrenHtml === '' ? {} : { childrenHtml }),
    ...(kind === 'alert-dialog' && {
      answers: {
        cancel: textOf(context, 'cancelLabel') ?? 'Cancel',
        confirm: textOf(context, 'confirmLabel') ?? 'Continue',
        destructive: context.rawProps?.['variant'] === 'destructive',
      },
    }),
  }
}

/** The frame holding the open overlay, on the host the renderer would have drawn. */
const openOverlayHost = (kind: OpenOverlayKind, context: ComponentDispatchConfig): ReactElement => (
  <div
    data-component-type={hostComponentType(context.elementProps)}
    data-testid={context.elementProps['data-testid'] as string | undefined}
    // eslint-disable-next-line sovrium/require-sanitized-html -- server-rendered markup: renderToStaticMarkup output, which escapes every text and attribute value
    dangerouslySetInnerHTML={{ __html: renderOpenOverlay(kind, contentOf(kind, context)) }}
  />
)

/** An overlay renderer that draws its open specimen when asked for one. */
export const withOpenSpecimen =
  (kind: OpenOverlayKind, renderer: ComponentRenderer): ComponentRenderer =>
  (context) =>
    isOpenSpecimen(context.rawProps) ? openOverlayHost(kind, context) : renderer(context)
