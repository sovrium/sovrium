/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Radio } from '@base-ui/react/radio'
import { RadioGroup } from '@base-ui/react/radio-group'
import { cn } from '@/presentation/islands/lib/cn'
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
      className={cn(className)}
      id={id}
      data-testid={testId}
    >
      {label && <legend className="text-fg mb-2 text-sm font-medium">{label}</legend>}
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
              className="border-border bg-bg-raised data-[checked]:border-primary flex h-4 w-4 items-center justify-center rounded-full border transition-colors"
            >
              <Radio.Indicator className="bg-primary h-2 w-2 rounded-full" />
            </Radio.Root>
            <span className="text-fg">{option.label}</span>
          </label>
        ))}
      </RadioGroup>
    </fieldset>
  )
}
