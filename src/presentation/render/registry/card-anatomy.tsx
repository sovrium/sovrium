/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveTranslationTokensDeep } from '@/domain/models/app/languages/translation-resolver'
import {
  CARD_SLOT_ATTRIBUTES,
  computeCardActionClasses,
  computeCardClasses,
  computeCardContentClasses,
  computeCardDescriptionClasses,
  computeCardFooterClasses,
  computeCardHeaderClasses,
  computeCardTitleClasses,
} from '../../design/card-default-classes'
import * as Renderers from '../elements'
import { splitSlots } from '../elements/slot-children'
import { mergePrestyle } from './interactive-prestyle-builders'
import type { ComponentDispatchConfig } from './component-dispatch-config'
import type { ReactElement } from 'react'

/** One part of the card, drawn only when it holds something. */
const part = (slot: string, className: string, content: unknown): ReactElement | undefined =>
  content === undefined || (Array.isArray(content) && content.length === 0) ? undefined : (
    <div
      key={slot}
      data-slot={slot}
      className={className}
    >
      {content as ReactElement}
    </div>
  )

/** A string field of the card, with its `$t:` tokens resolved. */
const textReader =
  (source: Readonly<Record<string, unknown>>, context: ComponentDispatchConfig) =>
  (key: string): string | undefined =>
    typeof source[key] === 'string'
      ? String(resolveTranslationTokensDeep(source[key], context.currentLang, context.languages))
      : undefined

/**
 * The ordinary card: shadcn/ui's Card. A card declaring a `title`, a
 * `description`, an `action` or a `footer` is laid out on shadcn's anatomy —
 * a header (title, description, and the action on the title row), the body in
 * `card-content`, then the footer. A card declaring none keeps its children
 * directly inside it, inset by the root.
 */
export function renderCardAnatomy(context: ComponentDispatchConfig): ReactElement {
  const { elementPropsWithSpacing, content, renderedChildren, interactions, component } = context
  const source = (component ?? {}) as Readonly<Record<string, unknown>>
  const text = textReader(source, context)
  const authorClassName = elementPropsWithSpacing['className'] as string | undefined
  const size = source['size'] === 'sm' ? 'sm' : 'default'
  const title = text('title')
  const description = text('description')
  const slots = splitSlots('card', component, renderedChildren)
  const sliced = [title, description, slots['action']?.[0], slots['footer']?.[0]].some(
    (filled) => filled !== undefined
  )
  const attributes = { ...CARD_SLOT_ATTRIBUTES, 'data-size': size }
  if (!sliced) {
    return Renderers.renderHTMLElement({
      type: 'div',
      props: {
        ...elementPropsWithSpacing,
        ...attributes,
        className: mergePrestyle(computeCardClasses(), authorClassName),
      },
      content: content,
      children: renderedChildren,
      interactions: interactions,
    })
  }
  const header = part(
    'card-header',
    computeCardHeaderClasses(),
    [
      part('card-title', computeCardTitleClasses(), title),
      part('card-description', computeCardDescriptionClasses(), description),
      part('card-action', computeCardActionClasses(), slots['action']),
    ].filter((child) => child !== undefined)
  )
  const body = content ?? slots['$children']
  return Renderers.renderHTMLElement({
    type: 'div',
    props: {
      ...elementPropsWithSpacing,
      ...attributes,
      className: mergePrestyle(computeCardClasses({ sliced: true }), authorClassName),
    },
    content: undefined,
    children: [
      header,
      part('card-content', computeCardContentClasses(), body),
      part('card-footer', computeCardFooterClasses(), slots['footer']),
    ].filter((child): child is ReactElement => child !== undefined),
    interactions: interactions,
  })
}
