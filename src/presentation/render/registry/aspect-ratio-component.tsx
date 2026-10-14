/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  aspectRatioCssValue,
  computeAspectRatioClasses,
} from '../../design/aspect-ratio-default-classes'
import { omitInternalMarkers } from '../props/internal-marker-props'
import { mergePrestyle } from './interactive-prestyle-builders'
import type { ComponentRenderer } from './component-dispatch-config'
import type { CSSProperties } from 'react'

/**
 * `aspect-ratio` — one medium held at a fixed width-to-height ratio
 * (`data-slot="aspect-ratio"`). The ratio is set as `--ratio` on the frame's own
 * style, so the height follows the width at every screen size with no script.
 *
 * Source: src/domain/models/app/pages/components/component-types/layout/aspect-ratio.ts
 */
const aspectRatioComponent: ComponentRenderer = ({
  elementPropsWithSpacing,
  renderedChildren,
  component,
}) => {
  const declared = (component as { ratio?: unknown } | undefined)?.ratio
  const ratio = typeof declared === 'number' || typeof declared === 'string' ? declared : 1
  const {
    className: authorClassName,
    style: authorStyle,
    ...rest
  } = omitInternalMarkers(elementPropsWithSpacing)
  const style = {
    ...(typeof authorStyle === 'object' && authorStyle !== null ? authorStyle : {}),
    '--ratio': aspectRatioCssValue(ratio),
  } as CSSProperties
  return (
    <div
      {...rest}
      data-slot="aspect-ratio"
      style={style}
      className={mergePrestyle(computeAspectRatioClasses(), authorClassName as string | undefined)}
    >
      {renderedChildren}
    </div>
  )
}

/** The aspect-ratio renderer, keyed by type, for the structural registry. */
export const aspectRatioComponents = {
  'aspect-ratio': aspectRatioComponent,
} as const satisfies Readonly<Record<string, ComponentRenderer>>
