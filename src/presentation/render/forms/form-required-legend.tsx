/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeFormHelpTextClasses } from '@/presentation/design/form-layout-classes'
import type { ResolvedFormField } from './form-field-elements'

/**
 * The line that explains the asterisk (WCAG 3.3.2, RGAA 11.10): drawn at the
 * top of a hosted form that has at least one required field, in the page
 * language (`form.requiredLegend`, renamed under `sovrium.form.requiredLegend`).
 *
 * The mark beside each label is `aria-hidden` — the control itself carries
 * `aria-required`, which is what a screen reader announces — so this legend is
 * for the sighted reader who would otherwise have to guess what `*` means.
 * A form with no required field draws nothing.
 *
 * `col-span-full`, inert in the default flex column, keeps the legend on a row
 * of its own when the author lays the `body` part out as a grid — otherwise it
 * takes the first cell and pushes every field one cell along.
 */
export function RequiredLegend({
  text,
  fields,
}: {
  readonly text: string | undefined
  readonly fields: readonly ResolvedFormField[]
}) {
  if (text === undefined || !fields.some((field) => field.required && !field.hidden)) {
    return undefined
  }
  return (
    <p
      data-form-required-legend=""
      className={`${computeFormHelpTextClasses()} col-span-full`}
    >
      {text}
    </p>
  )
}
