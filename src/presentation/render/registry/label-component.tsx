/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveTranslationTokensDeep } from '@/domain/models/app/languages/translation-resolver'
import {
  computeFormRequiredMarkClasses,
  computeLabelClasses,
} from '../../design/form-layout-classes'
import { omitInternalMarkers } from '../props/internal-marker-props'
import { mergePrestyle } from './interactive-prestyle-builders'
import type { ComponentRenderer } from './component-dispatch-config'

/**
 * `label` — the visible name of one form control (`data-slot="label"`), wired to
 * it through `for` so a click focuses the control. The required mark is drawn
 * after the text and hidden from assistive technology, so the control's
 * accessible name is the text alone.
 *
 * Source: src/domain/models/app/pages/components/component-types/form-controls/label.ts
 */
const labelComponent: ComponentRenderer = ({
  elementPropsWithSpacing,
  component,
  currentLang,
  languages,
}) => {
  const source = (component ?? {}) as Readonly<Record<string, unknown>>
  const rawText = typeof source['text'] === 'string' ? source['text'] : ''
  const text = String(resolveTranslationTokensDeep(rawText, currentLang, languages))
  const target = typeof source['for'] === 'string' ? source['for'] : undefined
  const { className: authorClassName, ...rest } = omitInternalMarkers(elementPropsWithSpacing)
  return (
    <label
      {...rest}
      data-slot="label"
      htmlFor={target}
      className={mergePrestyle(computeLabelClasses(), authorClassName as string | undefined)}
    >
      {text}
      {source['required'] === true ? (
        <span
          aria-hidden="true"
          data-slot="label-required"
          className={computeFormRequiredMarkClasses()}
        >
          *
        </span>
      ) : undefined}
    </label>
  )
}

/** The label renderer, keyed by type. */
export const labelComponents = {
  label: labelComponent,
} as const satisfies Readonly<Record<string, ComponentRenderer>>
