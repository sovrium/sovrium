/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import { resolveTranslationTokensDeep } from '@/domain/models/app/languages/translation-resolver'
import { openerProp } from '@/presentation/render/resolve/overlay-triggers'
import { hostComponentType } from './island-host-attributes'
import { withOpenSpecimen } from './open-overlay-components'
import type { ComponentRenderer } from './component-dispatch-config'

const HIDDEN_STYLE = { display: 'none' } as const

/**
 * `drawer` — the host of the bottom-drawer island. Its children are drawn here
 * and handed to the island as markup, which it injects when the panel opens
 * (as a dialog's are); `title` and `description` are translated here, so the
 * island receives final text.
 *
 * Source: src/domain/models/app/pages/components/component-types/overlays/bottom-drawer.ts
 */
const bottomDrawerComponent: ComponentRenderer = ({
  elementProps,
  component,
  renderedChildren,
  currentLang,
  languages,
}) => {
  const source = (component ?? {}) as Readonly<Record<string, unknown>>
  const text = (key: string): string | undefined =>
    typeof source[key] === 'string'
      ? String(resolveTranslationTokensDeep(source[key], currentLang, languages))
      : undefined
  const props = {
    title: text('title'),
    description: text('description'),
    childrenHtml: renderedChildren.map((child) => renderToStaticMarkup(child)).join(''),
    side: source['side'],
    snapPoints: source['snapPoints'],
    handle: source['handle'],
    modal: source['modal'],
    swipeToDismiss: source['swipeToDismiss'],
    className: elementProps['className'],
    id: elementProps['id'],
    'data-testid': elementProps['data-testid'],
    ...openerProp(component),
  }
  return (
    <div
      data-island="drawer"
      data-component-type={hostComponentType(elementProps)}
      data-island-props={JSON.stringify(props)}
      style={HIDDEN_STYLE}
    />
  )
}

/** The bottom drawer renderer, keyed by type. */
export const bottomDrawerComponents = {
  drawer: withOpenSpecimen('drawer', bottomDrawerComponent),
} as const satisfies Readonly<Record<string, ComponentRenderer>>
