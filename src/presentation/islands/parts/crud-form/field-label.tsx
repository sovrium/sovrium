/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useContext, useId, type ReactElement, type ReactNode } from 'react'
import { computeFieldLabelClasses } from '@/presentation/design/field-default-classes'
import { SideLabelsContext } from './side-labels-context'

/**
 * Beside from the `md` breakpoint, above below it. The label column — the
 * label and its help text — is a fixed width, so every control in the form
 * starts on one vertical line.
 */
const SIDE_ROW_CLASS = 'flex w-full flex-col gap-1 md:flex-row md:items-start md:gap-4'
const SIDE_LABEL_COLUMN_CLASS = 'flex flex-col gap-1 md:w-48 md:shrink-0 md:pt-2'
const SIDE_CONTROL_CLASS = 'flex min-w-0 flex-1 flex-col'

/** The field's name, as shadcn/ui's `FieldLabel`, pointing at its control by id. */
function FieldLabel({
  htmlFor,
  children,
}: {
  readonly htmlFor: string
  readonly children: ReactNode
}): ReactElement {
  return (
    <label
      data-slot="field-label"
      htmlFor={htmlFor}
      className={computeFieldLabelClasses()}
    >
      {children}
    </label>
  )
}

/**
 * A field's label and its control, laid into the `field` that holds them
 * (shadcn/ui's `Field` anatomy: the label, the control, then its description).
 *
 * The label is a sibling pointing at the control by id rather than wrapping it,
 * above and beside alike: a wrapping label would carry the control and its
 * help inside the label's own box, where the field's parts can no longer be
 * laid out — or styled — one by one.
 */
export function LabelledControl({
  label,
  control,
  help,
}: {
  readonly label: ReactNode
  /** The control, given the id its label points at. */
  readonly control: (id: string) => ReactElement
  readonly help?: ReactNode
}): ReactElement {
  const side = useContext(SideLabelsContext)
  const id = useId()
  if (!side) {
    return (
      <>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {control(id)}
        {help}
      </>
    )
  }
  return (
    <div className={SIDE_ROW_CLASS}>
      <div className={SIDE_LABEL_COLUMN_CLASS}>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {help}
      </div>
      <div className={SIDE_CONTROL_CLASS}>{control(id)}</div>
    </div>
  )
}
