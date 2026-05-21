/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { cn } from '@/presentation/islands/lib/cn'
import { type FieldDef, labelOf } from '../components/crud-form/fields'
import { type SuccessPageConfig } from './types'

function SuccessCheckmark() {
  return (
    <svg
      data-testid="success-checkmark"
      className="success-icon"
      aria-label="success"
      role="img"
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

function SubmittedSummary(props: {
  readonly fields: readonly FieldDef[]
  readonly values: Record<string, string>
}) {
  const { fields, values } = props
  const rows = fields
    .filter((f) => !f.hidden && (values[f.name] ?? '').trim() !== '')
    .map((f) => ({ name: f.name, label: labelOf(f), value: values[f.name] ?? '' }))
  return (
    <dl data-success-summary>
      {rows.map((row) => (
        <div
          key={row.name}
          data-summary-row={row.name}
        >
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function SuccessPage(props: {
  readonly config: SuccessPageConfig
  readonly fields: readonly FieldDef[]
  readonly submittedValues: Record<string, string>
  readonly onReset: () => void
  readonly className?: string
  readonly id?: string
  readonly testId?: string
}) {
  const { config, fields, submittedValues, onReset, className, id, testId } = props
  return (
    <div
      data-success-page
      className={cn(className)}
      id={id}
      data-testid={testId}
    >
      <SuccessCheckmark />
      {config.title && <h2 data-success-title>{config.title}</h2>}
      {config.message && <p data-success-message>{config.message}</p>}
      {config.showSummary && (
        <SubmittedSummary
          fields={fields}
          values={submittedValues}
        />
      )}
      {config.actions && config.actions.length > 0 && (
        <div data-success-actions>
          {config.actions.map((action) =>
            action.action === 'navigate' ? (
              <a
                key={action.label}
                href={action.url ?? '/'}
                data-success-action="navigate"
              >
                {action.label}
              </a>
            ) : (
              <button
                key={action.label}
                type="button"
                data-success-action="reset"
                onClick={onReset}
              >
                {action.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  )
}
