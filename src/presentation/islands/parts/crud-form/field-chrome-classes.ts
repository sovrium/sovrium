/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeFormControlClasses,
  computeFormFieldClasses,
  computeFormFieldLabelClasses,
} from '@/presentation/design/form-layout-classes'

/**
 * The classes every crud-form control shares, in one module so the plain inputs
 * and the typed controls beside them cannot drift apart.
 *
 * - `LABEL_CLASS`: stacked label + control with foreground text, from the shared
 *   form-layout contract so the hydrated island matches the SSR `CrudFieldShell`
 *   exactly — no label-to-control spacing jump on hydration.
 * - `CONTROL_CLASS`: the canonical input/select/textarea surface.
 */
export const LABEL_CLASS = `${computeFormFieldClasses()} ${computeFormFieldLabelClasses()}`
export const CONTROL_CLASS = computeFormControlClasses()
