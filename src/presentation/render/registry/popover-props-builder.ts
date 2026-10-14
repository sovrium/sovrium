/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import type { Component } from '@/domain/models/app/pages/components'
import type { ReactElement } from 'react'

/** The five characters React escapes in an attribute value, and what each stands for. */
const ATTRIBUTE_ENTITIES: Readonly<Record<string, string>> = {
  '&amp;': '&',
  '&quot;': '"',
  '&#x27;': "'",
  '&lt;': '<',
  '&gt;': '>',
}

/**
 * The class list of the first tag of `html`: a rendered button's own recipe,
 * unescaped — it is handed on as a value and escaped again where it is drawn,
 * so a class such as `[&>svg]:size-4` must not arrive as `[&amp;>svg]:size-4`.
 */
const firstTagClass = (html: string): string | undefined =>
  /^<[a-z]+[^>]*?\sclass="([^"]*)"/
    .exec(html)?.[1]
    ?.replace(/&(?:amp|quot|#x27|lt|gt);/g, (entity) => ATTRIBUTE_ENTITIES[entity] ?? entity)

type PopoverComponent =
  | {
      readonly children?: readonly { readonly props?: Record<string, unknown> }[]
      readonly floatingSide?: string
      readonly floatingAlign?: string
    }
  | undefined

/** The popover's trigger: the first child's label, id and own button recipe. */
function popoverTrigger(comp: PopoverComponent, rendered: ReactElement | undefined) {
  const props: Record<string, unknown> = comp?.children?.[0]?.props ?? {}
  const label = (props['label'] ?? props['text'] ?? 'Open') as string
  const html = rendered === undefined ? '' : renderToStaticMarkup(rendered)
  return {
    label,
    id: props['id'] as string | undefined,
    recipe: firstTagClass(html) ?? computeButtonDefaultClasses(),
  }
}

/**
 * Builds the props payload for the `popover` island. The first child is the
 * trigger: its label and id drive the trigger, and its own button recipe (its
 * variant, the default one when unset), under the popover's own `className`,
 * is what the trigger wears — so it looks like the button it was declared as,
 * before the island mounts and after. The remaining children form the panel.
 */
export function buildPopoverProps(
  rawProps: Record<string, unknown> | undefined,
  elementProps: Record<string, unknown>,
  component: Component | undefined,
  renderedChildren: readonly ReactElement[]
) {
  const comp = component as PopoverComponent
  const trigger = popoverTrigger(comp, renderedChildren[0])
  return {
    title: rawProps?.['title'],
    description: rawProps?.['description'],
    // `floatingSide`/`floatingAlign` are top-level component fields, not props.
    floatingSide: comp?.floatingSide,
    floatingAlign: comp?.floatingAlign,
    triggerLabel: trigger.label,
    triggerId: trigger.id,
    childrenHtml: renderedChildren
      .slice(1)
      .map((c) => renderToStaticMarkup(c))
      .join(''),
    className: resolveClasses(
      trigger.recipe,
      undefined,
      elementProps['className'] as string | undefined
    ),
    id: elementProps['id'],
    'data-testid': elementProps['data-testid'],
  }
}
