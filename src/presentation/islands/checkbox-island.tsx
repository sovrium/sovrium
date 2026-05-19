/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Checkbox } from '@base-ui/react/checkbox'
import type { ReactElement } from 'react'

interface CheckboxIslandProps {
  readonly checked?: boolean
  readonly indeterminate?: boolean
  readonly disabled?: boolean
  readonly label?: string
  readonly name?: string
  readonly value?: string
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
}

function IndeterminateIcon(): ReactElement {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
    >
      <path
        d="M2 5H8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function CheckIcon(): ReactElement {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
    >
      <path
        d="M2 5L4 7L8 3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function CheckboxIsland({
  checked,
  indeterminate = false,
  disabled = false,
  label,
  name,
  value,
  className,
  id,
  'data-testid': testId,
}: CheckboxIslandProps): ReactElement {
  return (
    <label
      className={`inline-flex items-center gap-2 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${className ?? ''}`}
      id={id}
      data-testid={testId}
    >
      <Checkbox.Root
        defaultChecked={checked}
        indeterminate={indeterminate}
        disabled={disabled}
        name={name}
        value={value}
        className="flex h-4 w-4 items-center justify-center rounded border border-gray-300 bg-white transition-colors data-[checked]:border-blue-600 data-[checked]:bg-blue-600 data-[indeterminate]:border-blue-600 data-[indeterminate]:bg-blue-600"
      >
        <Checkbox.Indicator className="text-white">
          {indeterminate ? <IndeterminateIcon /> : <CheckIcon />}
        </Checkbox.Indicator>
      </Checkbox.Root>
      {label && <span className="text-sm text-gray-900">{label}</span>}
    </label>
  )
}
