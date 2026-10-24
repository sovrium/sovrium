/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A choice question of the one-question layout, drawn as the design system's
 * radio group (the `radio-group` island, shadcn/ui's `RadioGroup` on Base UI)
 * rather than the browser's own radios. Each option still posts through a
 * radio input named after the field — Base UI draws one beside every item —
 * so the layout's runtime keeps reading the choice, moving its highlight with
 * the arrow keys and advancing once an option is chosen.
 *
 * The server writes the browser's radios inside the island host, which the
 * island reads when it mounts: a choice made on them while its chunk was still
 * loading is the one it starts on.
 */

import { computeFormFieldClasses } from '@/presentation/design/form-layout-classes'
import { FIELD_LABEL_CLASS, fieldWrapperAttributes } from './form-field-chrome'
import { RequiredMark } from './form-field-elements-typed'
import { HelpText } from './form-help-text'
import type { ResolvedFormField } from './form-field-elements'
import type { ReactElement } from 'react'

/** The browser's radios, held until the island mounts over them. */
function NativeRadios({
  field,
  defaultValue,
}: {
  readonly field: ResolvedFormField
  readonly defaultValue: string | undefined
}): ReactElement {
  return (
    <div>
      {(field.options ?? []).map((option) => {
        const optionId = `field-${field.name}-${option.value}`
        return (
          <div
            key={option.value}
            className="form-radio-option"
          >
            <input
              id={optionId}
              type="radio"
              name={field.name}
              value={option.value}
              required={field.required}
              disabled={field.conditionHidden}
              defaultChecked={defaultValue === option.value}
            />
            <label htmlFor={optionId}>{option.label}</label>
          </div>
        )
      })}
    </div>
  )
}

export function DesignedRadioQuestion({
  field,
  defaultValue,
}: {
  readonly field: ResolvedFormField
  readonly defaultValue: string | undefined
}): ReactElement {
  const props = {
    options: field.options ?? [],
    name: field.name,
    ariaLabel: field.label,
    nativeButtons: true,
    ...(defaultValue === undefined ? {} : { defaultValue }),
    ...(field.conditionHidden === true ? { disabled: true } : {}),
  }
  return (
    <div
      className={`form-field form-field-radio ${computeFormFieldClasses()}`}
      {...fieldWrapperAttributes(field)}
    >
      <div
        id={`field-${field.name}-legend`}
        className={`form-field-legend ${FIELD_LABEL_CLASS}`}
      >
        {field.label}
        <RequiredMark required={field.required} />
      </div>
      <div
        id={`field-${field.name}-choices`}
        data-island="radio-group"
        data-island-props={JSON.stringify(props)}
      >
        <NativeRadios
          field={field}
          defaultValue={defaultValue}
        />
      </div>
      <HelpText html={field.helpTextHtml} />
    </div>
  )
}
