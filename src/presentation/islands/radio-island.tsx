/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Radio } from '@base-ui/react/radio'
import { RadioGroup } from '@base-ui/react/radio-group'
import type { ReactElement } from 'react'

interface OptionItem {
  readonly label: string
  readonly value: string
  readonly disabled?: boolean
}

interface RadioIslandProps {
  readonly options?: readonly OptionItem[]
  readonly defaultValue?: string
  readonly orientation?: 'horizontal' | 'vertical'
  readonly disabled?: boolean
  readonly name?: string
  readonly label?: string
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
}

/**
 * Radio group island — wraps Base UI RadioGroup + Radio for radio buttons.
 *
 * Supports horizontal/vertical layout, keyboard navigation (arrow keys),
 * and roving tabindex for accessibility.
 */
export default function RadioIsland({
  options = [],
  defaultValue,
  orientation = 'vertical',
  disabled = false,
  name,
  label,
  className,
  id,
  'data-testid': testId,
}: RadioIslandProps): ReactElement {
  return (
    <fieldset
      className={className}
      id={id}
      data-testid={testId}
    >
      {label && <legend className="mb-2 text-sm font-medium text-gray-900">{label}</legend>}
      <RadioGroup
        defaultValue={defaultValue}
        disabled={disabled}
        name={name}
        className={`flex ${orientation === 'horizontal' ? 'flex-row gap-4' : 'flex-col gap-2'}`}
      >
        {options.map((option) => (
          <label
            key={option.value}
            className={`inline-flex items-center gap-2 text-sm ${
              option.disabled || disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
            }`}
          >
            <Radio.Root
              value={option.value}
              disabled={option.disabled}
              className="flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 bg-white transition-colors data-[checked]:border-blue-600"
            >
              <Radio.Indicator className="h-2 w-2 rounded-full bg-blue-600" />
            </Radio.Root>
            <span className="text-gray-900">{option.label}</span>
          </label>
        ))}
      </RadioGroup>
    </fieldset>
  )
}
