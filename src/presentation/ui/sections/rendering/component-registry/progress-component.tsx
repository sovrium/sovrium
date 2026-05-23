/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import type { ComponentRenderer } from '../component-dispatch-config'
import type { Component } from '@/domain/models/app/pages/components'
import type { ReactElement } from 'react'

const DEFAULT_MAX = 100

const BAR_HEIGHT_PX: Readonly<Record<string, number>> = { sm: 4, md: 8, lg: 12 }

const CIRCLE_SIZE_PX: Readonly<Record<string, number>> = { sm: 48, md: 72, lg: 96 }

interface ProgressFields {
  readonly value: number
  readonly max: number
  readonly percent: number
  readonly variant: 'linear' | 'circle'
  readonly showLabel: boolean
  readonly size: string
  readonly id: string | undefined
  readonly label: string | undefined
}

function resolveProgressNumbers(c: Record<string, unknown>): {
  readonly value: number
  readonly max: number
  readonly percent: number
} {
  const value = typeof c.progressValue === 'number' ? c.progressValue : 0
  const max = typeof c.progressMax === 'number' && c.progressMax > 0 ? c.progressMax : DEFAULT_MAX
  const percent = max > 0 ? Math.round((value / max) * 100) : 0
  return { value, max, percent }
}

function resolveProgressFields(
  component: Component | undefined,
  rawProps: Record<string, unknown> | undefined
): ProgressFields {
  const c = (component ?? {}) as Record<string, unknown>
  const props = rawProps ?? {}
  const { value, max, percent } = resolveProgressNumbers(c)
  return {
    value,
    max,
    percent,
    variant: c.progressVariant === 'circle' ? 'circle' : 'linear',
    showLabel: c.showLabel === true,
    size: typeof c.size === 'string' ? c.size : 'md',
    id: typeof props.id === 'string' ? props.id : undefined,
    label: typeof props.label === 'string' ? props.label : undefined,
  }
}

function renderCircle(f: ProgressFields): ReactElement {
  const diameter = CIRCLE_SIZE_PX[f.size] ?? CIRCLE_SIZE_PX.md ?? 72
  const stroke = 6
  const radius = (diameter - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - f.percent / 100)
  const center = diameter / 2
  return (
    <div
      id={f.id}
      role="progressbar"
      aria-label={f.label}
      aria-valuenow={f.value}
      aria-valuemin={0}
      aria-valuemax={f.max}
      data-component="progress"
      data-progress-variant="circle"
      className="relative inline-flex items-center justify-center"
      style={{ width: diameter, height: diameter }}
    >
      <svg
        width={diameter}
        height={diameter}
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-gray-200"
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
          className="text-blue-600"
        />
      </svg>
      {f.showLabel && (
        <span className="absolute text-sm font-medium text-gray-900">{f.percent}%</span>
      )}
    </div>
  )
}

function renderLinear(f: ProgressFields): ReactElement {
  const height = BAR_HEIGHT_PX[f.size] ?? BAR_HEIGHT_PX.md ?? 8
  return (
    <div className="flex items-center gap-2">
      <div
        id={f.id}
        role="progressbar"
        aria-label={f.label}
        aria-valuenow={f.value}
        aria-valuemin={0}
        aria-valuemax={f.max}
        data-component="progress"
        data-progress-variant="linear"
        className="w-full overflow-hidden rounded-full bg-gray-200"
        style={{ height }}
      >
        <div
          className="h-full rounded-full bg-blue-600"
          style={{ width: `${f.percent}%` }}
        />
      </div>
      {f.showLabel && (
        <span className="shrink-0 text-sm font-medium text-gray-900">{f.percent}%</span>
      )}
    </div>
  )
}

export const progressComponent: ComponentRenderer = ({ component, rawProps }) => {
  const fields = resolveProgressFields(component, rawProps)
  return fields.variant === 'circle' ? renderCircle(fields) : renderLinear(fields)
}
