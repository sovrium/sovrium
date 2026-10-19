/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable react-refresh/only-export-components -- SSR-only field
   components, never part of client-side HMR; same rationale as the sibling
   form-field-elements.tsx. */

/**
 * The two fields of a server-rendered form drawn by the design system rather
 * than by the browser: a choice, as the Select, and a date, as the date
 * picker. The server writes each one's skeleton (see
 * `elements/form-control-skeletons`) inside a `form-field` island host, and
 * the island mounts the real control over it; the page only loads the island
 * runtime when the form carries such a field (`formNeedsFieldIslands`).
 */

import {
  ChoiceSelectSkeleton,
  DateBoxSkeleton,
} from '@/presentation/render/elements/form-control-skeletons'
import {
  ariaRequired,
  FIELD_LABEL_CLASS,
  FIELD_WRAPPER_CLASS,
  fieldWrapperAttributes,
} from './form-field-chrome'
import { RequiredMark } from './form-field-elements-typed'
import { HelpText } from './form-help-text'
import type { ResolvedFormField } from './form-field-elements'
import type { Form } from '@/domain/models/app/forms'
import type { ReactElement, ReactNode } from 'react'

/** The field's label, bound to its control by id, and its required mark. */
function FieldLabel({ field }: { readonly field: ResolvedFormField }): ReactElement {
  return (
    <label
      htmlFor={`field-${field.name}`}
      className={FIELD_LABEL_CLASS}
    >
      {field.label}
      <RequiredMark required={field.required} />
    </label>
  )
}

/** The `form-field` island host: the props it mounts with, around the skeleton it replaces. */
function FieldIslandHost({
  props,
  children,
}: {
  readonly props: Readonly<Record<string, unknown>>
  readonly children: ReactNode
}): ReactElement {
  return (
    <div
      data-island="form-field"
      data-island-props={JSON.stringify(props)}
    >
      {children}
    </div>
  )
}

/**
 * Single-choice field: the Select.
 *
 * Its leading "no answer" choice (value `''`, labelled by the field's
 * `placeholder`) is not decoration — it is what lets a choice express "no
 * answer". Without it the first option would read as chosen before the visitor
 * touched the page: someone who submitted without opening the list would be
 * recorded as having picked it. That is silently WRONG data rather than
 * missing data, and `required` could not catch it.
 *
 * - It LEADS the list and is drawn ALWAYS, not only while nothing is chosen, so
 *   the rule stays one sentence: "the empty choice leads the list; it is chosen
 *   only when nothing else resolves". A visitor may return to a required field
 *   and blank it, and being stopped there is correct.
 * - The held value falls back to `''`, never to the first option. A resolved
 *   prefill or literal default still wins outright, which keeps the prefill
 *   contract intact.
 * - The value rides a named input the browser validates, so a required choice
 *   left on "no answer" is `valueMissing`, exactly as an empty `<select>` was.
 */
export function SelectInput({
  field,
  defaultValue,
  wrapper,
}: {
  readonly field: ResolvedFormField
  readonly defaultValue: string | undefined
  /** The wrapper's own class and markers, when the field has them (a user picker). */
  readonly wrapper?: {
    readonly className: string
    readonly attributes: Readonly<Record<string, string>>
  }
}): ReactElement {
  const options = field.options ?? []
  const value = defaultValue ?? ''
  return (
    <div
      className={wrapper?.className ?? FIELD_WRAPPER_CLASS}
      {...wrapper?.attributes}
      {...fieldWrapperAttributes(field)}
    >
      <FieldLabel field={field} />
      <FieldIslandHost
        props={{
          kind: 'select',
          id: `field-${field.name}`,
          name: field.name,
          value,
          options,
          emptyLabel: field.placeholder,
          required: field.required,
        }}
      >
        <ChoiceSelectSkeleton
          id={`field-${field.name}`}
          name={field.name}
          value={value}
          options={options}
          emptyLabel={field.placeholder}
          required={field.required}
          disabled={field.conditionHidden === true}
        />
      </FieldIslandHost>
      <HelpText html={field.helpTextHtml} />
    </div>
  )
}

/**
 * A `multi-select` column keeps the browser's `<select>`: the Select draws one
 * choice, and a set of choices is not part of this change.
 */
export function MultiChoiceInput({
  field,
  defaultValue,
}: {
  readonly field: ResolvedFormField
  readonly defaultValue: string | undefined
}): ReactElement {
  return (
    <div
      className={FIELD_WRAPPER_CLASS}
      {...fieldWrapperAttributes(field)}
    >
      <FieldLabel field={field} />
      <select
        id={`field-${field.name}`}
        data-component-type="select"
        name={field.name}
        required={field.required}
        {...ariaRequired(field.required)}
        disabled={field.conditionHidden}
        defaultValue={defaultValue ?? ''}
      >
        <option value="">{field.placeholder}</option>
        {(field.options ?? []).map((option) => (
          <option
            key={option.value}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </select>
      <HelpText html={field.helpTextHtml} />
    </div>
  )
}

/**
 * A `date` field: the date picker — a box typed in the PAGE's date format,
 * with the calendar beside it — never the browser's date input, which follows
 * the browser's locale and draws the browser's control. The day is held, and
 * submitted, as `YYYY-MM-DD` by a named input beside the box.
 */
export function DateInput({
  field,
  defaultValue,
}: {
  readonly field: ResolvedFormField
  readonly defaultValue: string | undefined
}): ReactElement {
  const value = defaultValue ?? ''
  const pickLabel = field.pickDateLabel ?? 'Pick a date'
  return (
    <div
      className={FIELD_WRAPPER_CLASS}
      {...fieldWrapperAttributes(field)}
    >
      <FieldLabel field={field} />
      <FieldIslandHost
        props={{
          kind: 'date',
          id: `field-${field.name}`,
          name: field.name,
          value,
          required: field.required,
          ...(field.placeholder === '' ? {} : { placeholder: field.placeholder }),
          uiStrings: {
            'datePicker.pick': pickLabel,
            'datePicker.choose': field.chooseDateLabel ?? 'Choose date',
          },
        }}
      >
        <DateBoxSkeleton
          id={`field-${field.name}`}
          valueName={field.name}
          value={value}
          required={field.required}
          disabled={field.conditionHidden === true}
          pickLabel={pickLabel}
          {...(field.placeholder === '' ? {} : { placeholder: field.placeholder })}
        />
      </FieldIslandHost>
      <HelpText html={field.helpTextHtml} />
    </div>
  )
}

/** A field the design system draws over its skeleton: a single choice, or a date. */
export function isDesignField(field: ResolvedFormField): boolean {
  if (field.inputElement === 'date') return true
  if (field.inputElement === 'user') return field.allowMultiple !== true
  return (
    field.inputElement === 'select' &&
    field.multiChoice !== true &&
    field.column?.type !== 'multi-select'
  )
}

/**
 * Whether a form draws a field through the `form-field` island, and so needs
 * the island runtime: a date, or a choice of one (a single-select, a status, a
 * relationship, a standalone select, a single user). A cheap read of the
 * declared fields, before anything is resolved.
 */
export function formNeedsFieldIslands(
  form: Readonly<Pick<Form, 'fields'>>,
  columnTypeOf: (column: string) => string | undefined
): boolean {
  return form.fields.some((field) => {
    const f = field as {
      readonly kind?: string
      readonly inputType?: string
      readonly column?: string
      readonly hidden?: boolean
    }
    if (f.hidden === true) return false
    if (f.kind === 'standalone') return f.inputType === 'date' || f.inputType === 'select'
    if (f.column === undefined) return false
    return DESIGN_COLUMN_TYPES.has(columnTypeOf(f.column) ?? '')
  })
}

/** The column types a form draws as the Select or the date picker. */
const DESIGN_COLUMN_TYPES: ReadonlySet<string> = new Set([
  'date',
  'single-select',
  'status',
  'relationship',
  'user',
])
