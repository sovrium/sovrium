/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveTranslationTokensDeep } from '@/domain/models/app/languages/translation-resolver'
import {
  computeMarkerClasses,
  computeMarkerContentClasses,
  computeMarkerIconClasses,
  type MarkerVariant,
} from '../../design/marker-default-classes'
import { resolveLucideIcon } from '../elements/lucide-resolver'
import { omitInternalMarkers } from '../props/internal-marker-props'
import { mergePrestyle } from './interactive-prestyle-builders'
import type { ComponentRenderer } from './component-dispatch-config'

const VARIANTS: ReadonlySet<string> = new Set(['default', 'border', 'separator'])

/**
 * `marker` — an inline note (`data-slot="marker"`). With `href` the root IS the
 * link, named by the words; with `live` it is a status region. The icon is
 * decorative and hidden from assistive technology.
 *
 * Source: src/domain/models/app/pages/components/component-types/display/marker.ts
 */
const markerComponent: ComponentRenderer = ({
  elementPropsWithSpacing,
  component,
  currentLang,
  languages,
}) => {
  const source = (component ?? {}) as Readonly<Record<string, unknown>>
  const declared = source['variant']
  const variant: MarkerVariant =
    typeof declared === 'string' && VARIANTS.has(declared) ? (declared as MarkerVariant) : 'default'
  const content = String(
    resolveTranslationTokensDeep(
      typeof source['content'] === 'string' ? source['content'] : '',
      currentLang,
      languages
    )
  )
  const Icon = resolveLucideIcon(typeof source['icon'] === 'string' ? source['icon'] : undefined)
  const href = typeof source['href'] === 'string' ? source['href'] : undefined
  const { className: authorClassName, ...rest } = omitInternalMarkers(elementPropsWithSpacing)
  const Root = href === undefined ? 'div' : 'a'
  return (
    <Root
      {...rest}
      href={href}
      data-slot="marker"
      data-variant={variant}
      role={source['live'] === true ? 'status' : undefined}
      className={mergePrestyle(
        computeMarkerClasses(variant),
        authorClassName as string | undefined
      )}
    >
      {Icon === undefined ? undefined : (
        <span
          data-slot="marker-icon"
          aria-hidden="true"
          className={computeMarkerIconClasses()}
        >
          <Icon aria-hidden="true" />
        </span>
      )}
      <span
        data-slot="marker-content"
        className={computeMarkerContentClasses()}
      >
        {content}
      </span>
    </Root>
  )
}

/** The marker renderer, keyed by type. */
export const markerComponents = {
  marker: markerComponent,
} as const satisfies Readonly<Record<string, ComponentRenderer>>
