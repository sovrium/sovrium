/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeFormFieldClasses,
  computeFormFieldLabelClasses,
} from '@/presentation/design/form-layout-classes'
import {
  computeInputDefaultClasses,
  computeTextareaDefaultClasses,
} from '@/presentation/design/input-default-classes'

/**
 * The classes every crud-form control shares, in one module so the plain inputs
 * and the typed controls beside them cannot drift apart.
 *
 * - `LABEL_CLASS`: a label that still wraps its control (a rating scale, a set
 *   of checkboxes), stacked with foreground text.
 * - `CONTROL_CLASS`: shadcn/ui's `Input`, for an input or a native select.
 * - `TEXTAREA_CLASS`: shadcn/ui's `Textarea`.
 */
export const LABEL_CLASS = `${computeFormFieldClasses()} ${computeFormFieldLabelClasses()}`
export const CONTROL_CLASS = computeInputDefaultClasses()
export const TEXTAREA_CLASS = computeTextareaDefaultClasses()
