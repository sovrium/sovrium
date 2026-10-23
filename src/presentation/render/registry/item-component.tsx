/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveTranslationTokensDeep } from '@/domain/models/app/languages/translation-resolver'
import {
  computeItemActionsClasses,
  computeItemContentClasses,
  computeItemDescriptionClasses,
  computeItemEdgeClasses,
  computeItemMediaClasses,
  computeItemTitleClasses,
  computeItemVariantClasses,
  computeListItemClasses,
} from '../../design/display-default-classes'
import * as Renderers from '../elements'
import { splitSlots } from '../elements/slot-children'
import { mergePrestyle } from './interactive-prestyle-builders'
import type { ComponentRenderer } from './component-dispatch-config'
import type { ReactElement, ReactNode } from 'react'

type ItemVariant = 'default' | 'outline' | 'muted'

/** One slot of the row, drawn only when it holds something. */
const slot = (name: string, className: string, content: ReactNode): ReactElement | undefined =>
  content === undefined || (Array.isArray(content) && content.length === 0) ? undefined : (
    <div
      key={name}
      data-slot={name}
      className={className}
    >
      {content}
    </div>
  )

/** The title and the description, in the content column. */
const renderContent = (title: string | undefined, description: string | undefined) =>
  title === undefined && description === undefined ? undefined : (
    <div
      key="item-content"
      data-slot="item-content"
      className={computeItemContentClasses()}
    >
      {title === undefined ? undefined : (
        <div
          data-slot="item-title"
          className={computeItemTitleClasses()}
        >
          {title}
        </div>
      )}
      {description === undefined ? undefined : (
        <p
          data-slot="item-description"
          className={computeItemDescriptionClasses()}
        >
          {description}
        </p>
      )}
    </div>
  )

/** The row's state, `disabled` winning over `selected`. */
const rowStateOf = (
  elementProps: Readonly<Record<string, unknown>>
): 'disabled' | 'selected' | 'default' =>
  elementProps['disabled'] === true
    ? 'disabled'
    : elementProps['selected'] === true
      ? 'selected'
      : 'default'

/**
 * `item` — one row of a list, on shadcn/ui's Item anatomy: `header` above,
 * then the `media`, the content (`title`, `description`, and any children),
 * the `actions`, and `footer` below. A row bound to an action takes the
 * pointer; `selected` and `disabled` drive its state. `itemVariant` and
 * `itemSize` are named on the row (`data-variant`, `data-size`).
 */
export const itemComponent: ComponentRenderer = (config) => {
  const {
    elementProps,
    content,
    renderedChildren,
    component,
    currentLang,
    languages,
    designStyles,
  } = config
  const source = (component ?? {}) as Readonly<Record<string, unknown>>
  const text = (key: string): string | undefined =>
    typeof source[key] === 'string'
      ? String(resolveTranslationTokensDeep(source[key], currentLang, languages))
      : undefined
  const variant: ItemVariant =
    source['itemVariant'] === 'outline' || source['itemVariant'] === 'muted'
      ? source['itemVariant']
      : 'default'
  const size = source['itemSize'] === 'sm' ? 'sm' : 'default'
  const interactive =
    Boolean(elementProps['onClick']) ||
    Boolean(elementProps['href']) ||
    elementProps['interactive'] === true
  const state = rowStateOf(elementProps)
  const rowClasses = mergePrestyle(
    computeListItemClasses({ state, interactive }),
    computeItemVariantClasses(variant, size)
  )
  const slots = splitSlots('item', component, renderedChildren)
  const children = [
    slot('item-header', computeItemEdgeClasses(), slots['header']),
    slot('item-media', computeItemMediaClasses(), slots['media']),
    renderContent(text('title'), text('description')),
    ...(slots['$children'] ?? []),
    slot('item-actions', computeItemActionsClasses(), slots['actions']),
    slot('item-footer', computeItemEdgeClasses(), slots['footer']),
  ].filter((child): child is ReactElement => child !== undefined)
  return Renderers.renderListItem(
    {
      ...elementProps,
      className: mergePrestyle(
        rowClasses,
        elementProps['className'] as string | undefined,
        designStyles?.replace
      ),
      'data-slot': 'item',
      'data-variant': variant,
      'data-size': size,
    },
    content,
    children
  )
}
