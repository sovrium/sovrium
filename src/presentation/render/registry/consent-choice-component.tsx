/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { ConsentChoiceControl, type ConsentChoiceComponent } from './consent-choice-control'
import type { ComponentRenderer } from './component-dispatch-config'
import type { ReactElement } from 'react'

/** Renderer for the `consent-choice` component; the control reads the app's purposes. */
export const consentChoiceComponent: ComponentRenderer<'consent-choice'> = ({
  component,
  elementProps,
  currentLang,
  languages,
}): ReactElement => (
  <ConsentChoiceControl
    authored={(component ?? {}) as ConsentChoiceComponent}
    elementProps={elementProps}
    currentLang={currentLang}
    languages={languages}
  />
)
