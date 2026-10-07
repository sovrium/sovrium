/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { splitFormRegions, type FormAsideLayout } from './main-aside-regions'
import type { FieldDef } from './fields'
import type { CSSProperties, ReactElement, ReactNode } from 'react'

/**
 * The two columns of a `main-aside` form: the main fields, and beside them from
 * the lg breakpoint up a narrow column holding the aside fields and the submit
 * button. Below lg the two stack, the aside after the main fields.
 *
 * The width travels as a custom property so one static class (harvested by the
 * build-time candidate scan) serves every length an author can write.
 */
function MainAsideColumns({
  width,
  main,
  aside,
}: {
  readonly width: string | undefined
  readonly main: ReactNode
  readonly aside: ReactNode
}): ReactElement {
  return (
    <div
      data-form-layout="main-aside"
      className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_var(--sv-form-aside-width,20rem)] lg:items-start lg:gap-6"
      style={
        width === undefined
          ? undefined
          : ({ ['--sv-form-aside-width' as string]: width } as CSSProperties)
      }
    >
      <div
        data-form-region="main"
        className="flex min-w-0 flex-col gap-4"
      >
        {main}
      </div>
      <div
        data-form-region="aside"
        className="flex min-w-0 flex-col gap-4"
      >
        {aside}
      </div>
    </div>
  )
}

/**
 * A form's fields in their regions: one run for every layout but `main-aside`,
 * two columns for it — the submit button closing the aside.
 */
export function FormRegions({
  fields,
  aside,
  fieldsOf,
  submit,
}: {
  readonly fields: readonly FieldDef[]
  /** The resolved aside, present only under `main-aside` (see `formAsideOf`). */
  readonly aside: FormAsideLayout | undefined
  readonly fieldsOf: (subset: readonly FieldDef[]) => ReactNode
  readonly submit: ReactNode
}): ReactElement {
  if (aside === undefined) return <>{fieldsOf(fields)}</>
  const split = splitFormRegions(fields, aside)
  return (
    <MainAsideColumns
      width={aside.width}
      main={fieldsOf(split.main)}
      aside={
        <>
          {fieldsOf(split.aside)}
          {submit}
        </>
      }
    />
  )
}
