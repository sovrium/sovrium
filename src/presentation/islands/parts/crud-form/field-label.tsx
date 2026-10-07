/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useContext, useId, type ReactElement, type ReactNode } from 'react'
import { computeFormFieldLabelClasses } from '@/presentation/design/form-layout-classes'
import { LABEL_CLASS } from './field-chrome-classes'
import { SideLabelsContext } from './side-labels-context'

/**
 * Beside from the `md` breakpoint, above below it. The label column — the
 * label and its help text — is a fixed width, so every control in the form
 * starts on one vertical line.
 */
const SIDE_ROW_CLASS = 'flex w-full flex-col gap-1 md:flex-row md:items-start md:gap-4'
const SIDE_LABEL_COLUMN_CLASS = 'flex flex-col gap-1 md:w-48 md:shrink-0 md:pt-2'
const SIDE_CONTROL_CLASS = 'flex min-w-0 flex-1 flex-col'

/**
 * A field's label and its control.
 *
 * Above (the default), the `<label>` WRAPS its control, as it always has.
 * Beside, a wrapping label would span the whole row, so the label is a sibling
 * pointing at the control by id — the only shape in which the name can sit in
 * a column of its own and still name the control for assistive technology.
 */
export function LabelledControl({
  label,
  control,
  help,
}: {
  readonly label: ReactNode
  /** The control, given the id a side label points at (`undefined` above). */
  readonly control: (id: string | undefined) => ReactElement
  readonly help?: ReactNode
}): ReactElement {
  const side = useContext(SideLabelsContext)
  const id = useId()
  if (!side) {
    return (
      <label className={LABEL_CLASS}>
        {label}
        {control(undefined)}
        {help}
      </label>
    )
  }
  return (
    <div className={SIDE_ROW_CLASS}>
      <div className={SIDE_LABEL_COLUMN_CLASS}>
        <label
          htmlFor={id}
          className={computeFormFieldLabelClasses()}
        >
          {label}
        </label>
        {help}
      </div>
      <div className={SIDE_CONTROL_CLASS}>{control(id)}</div>
    </div>
  )
}
