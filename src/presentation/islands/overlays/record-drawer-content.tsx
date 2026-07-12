/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */



import { useCallback, useState, type ReactElement } from 'react'
import { executeFetchAction } from '../shared/action-executor'
import { InlineConfirmDialog, ObjectConfirmDialog } from '../shared/inline-confirm-dialog'
import type { Action, FetchAction } from '@/domain/models/app/pages/components/action'
import type { ConfirmObject } from '@/domain/models/app/pages/components/confirm-gate'

export interface RecordDrawerField {
  readonly name: string
  readonly type: string
  readonly renderAs?: 'text' | 'json' | 'list' | 'key-value' | 'code'
}

export interface DrawerAction {
  readonly label: string
  readonly action: Action
  readonly variant?: string
  readonly confirm?: string | ConfirmObject
}

type Values = Record<string, string>
type RawRecord = Record<string, unknown>

export function isStructured(field: RecordDrawerField): boolean {
  return field.renderAs !== undefined && field.renderAs !== 'text'
}


function coerceStructured(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function formatScalar(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function PairLine({
  name,
  value,
}: {
  readonly name: string
  readonly value: unknown
}): ReactElement {
  return (
    <span className="text-foreground text-xs">
      <span className="text-foreground-muted">{name}</span>
      {`: ${formatScalar(value)}`}
    </span>
  )
}

function renderObjectPairs(value: unknown): ReactElement[] {
  if (typeof value !== 'object' || value === null) {
    return [
      <span
        key="_scalar"
        className="text-foreground text-xs"
      >
        {formatScalar(value)}
      </span>,
    ]
  }
  return Object.entries(value as RawRecord).map(([key, val]) => (
    <PairLine
      key={key}
      name={key}
      value={val}
    />
  ))
}

const PRE_CLASS = 'text-foreground overflow-auto text-xs'

function StructuredList({ data }: { readonly data: unknown }): ReactElement {
  if (!Array.isArray(data)) {
    return <pre className={PRE_CLASS}>{JSON.stringify(data, undefined, 2)}</pre>
  }
  return (
    <ul className="flex flex-col gap-2">
      {data.map((item, index) => (
        <li
          key={index}
          className="border-border flex flex-col gap-1 rounded border p-2"
        >
          {renderObjectPairs(item)}
        </li>
      ))}
    </ul>
  )
}

function StructuredValue({
  renderAs,
  data,
}: {
  readonly renderAs: string
  readonly data: unknown
}): ReactElement {
  if (renderAs === 'list') return <StructuredList data={data} />
  if (renderAs === 'key-value') {
    return <div className="flex flex-col gap-1">{renderObjectPairs(data)}</div>
  }
  if (renderAs === 'code') {
    return (
      <pre className={PRE_CLASS}>
        {typeof data === 'string' ? data : JSON.stringify(data, undefined, 2)}
      </pre>
    )
  }
  return <pre className={PRE_CLASS}>{JSON.stringify(data, undefined, 2)}</pre>
}

function StructuredFieldDisplay({
  field,
  value,
}: {
  readonly field: RecordDrawerField
  readonly value: unknown
}): ReactElement {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="text-foreground-muted">{field.name}</span>
      <StructuredValue
        renderAs={field.renderAs ?? 'json'}
        data={coerceStructured(value)}
      />
    </div>
  )
}


function FieldInput({
  field,
  value,
  onChange,
}: {
  readonly field: RecordDrawerField
  readonly value: string
  readonly onChange: (name: string, value: string) => void
}): ReactElement {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-foreground-muted">{field.name}</span>
      <input
        type="text"
        aria-label={field.name}
        name={field.name}
        value={value}
        onChange={(event) => onChange(field.name, event.target.value)}
        className="border-border rounded border px-2 py-1"
      />
    </label>
  )
}

function toReadOnlyText(value: unknown): string {
  return value === null || value === undefined ? '' : String(value)
}

function ReadOnlyField({
  field,
  value,
}: {
  readonly field: RecordDrawerField
  readonly value: unknown
}): ReactElement {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="text-foreground-muted">{field.name}</span>
      <span
        data-field={field.name}
        className="text-foreground"
      >
        {toReadOnlyText(value)}
      </span>
    </div>
  )
}


function dispatchDrawerAction(action: Action, record: RawRecord): void {
  if ('type' in action && action.type === 'fetch') {
    void executeFetchAction(action as FetchAction, { record })
  }
}

const ACTION_BUTTON_CLASS =
  'border-border text-foreground hover:bg-background-subtle rounded border px-3 py-1.5 text-sm transition-colors'

function DrawerActionButton({
  item,
  record,
}: {
  readonly item: DrawerAction
  readonly record: RawRecord
}): ReactElement {
  const [confirming, setConfirming] = useState(false)
  const fire = useCallback(() => dispatchDrawerAction(item.action, record), [item.action, record])

  if (item.confirm && confirming) {
    if (typeof item.confirm !== 'string') {
      return (
        <ObjectConfirmDialog
          config={item.confirm}
          record={record}
          fallbackConfirmLabel={item.label}
          onConfirm={fire}
          onCancel={() => setConfirming(false)}
        />
      )
    }
    return (
      <InlineConfirmDialog
        prompt={item.confirm}
        confirmLabel={item.label}
        onConfirm={fire}
        onCancel={() => setConfirming(false)}
      />
    )
  }

  return (
    <button
      type="button"
      className={ACTION_BUTTON_CLASS}
      onClick={() => (item.confirm ? setConfirming(true) : fire())}
    >
      {item.label}
    </button>
  )
}

const NO_ACTIONS: ReadonlyArray<DrawerAction> = []

function DrawerActions({
  actions,
  record,
}: {
  readonly actions: ReadonlyArray<DrawerAction>
  readonly record: RawRecord
}): ReactElement | null {
  if (actions.length === 0) return null
  return (
    <div className="border-border mt-2 flex flex-wrap gap-2 border-t pt-4">
      {actions.map((item, index) => (
        <DrawerActionButton
          key={`${item.label}-${index}`}
          item={item}
          record={record}
        />
      ))}
    </div>
  )
}


export interface DrawerContentProps {
  readonly fields: ReadonlyArray<RecordDrawerField>
  readonly values: Values
  readonly record: RawRecord
  readonly canEdit: boolean
  readonly error?: string
  readonly actions?: ReadonlyArray<DrawerAction>
  readonly onChange: (name: string, value: string) => void
  readonly onSave: () => void
}

function DrawerField({
  field,
  values,
  record,
  canEdit,
  onChange,
}: {
  readonly field: RecordDrawerField
  readonly values: Values
  readonly record: RawRecord
  readonly canEdit: boolean
  readonly onChange: (name: string, value: string) => void
}): ReactElement {
  if (isStructured(field)) {
    return (
      <StructuredFieldDisplay
        field={field}
        value={record[field.name]}
      />
    )
  }
  return canEdit ? (
    <FieldInput
      field={field}
      value={values[field.name] ?? ''}
      onChange={onChange}
    />
  ) : (
    <ReadOnlyField
      field={field}
      value={record[field.name]}
    />
  )
}

export function DrawerContent({
  fields,
  values,
  record,
  canEdit,
  error,
  actions = NO_ACTIONS,
  onChange,
  onSave,
}: DrawerContentProps): ReactElement {
  return (
    <>
      {error && (
        <p
          role="alert"
          aria-label="Erreur de validation"
          className="text-error-fg bg-error-bg border-error-border rounded border p-2 text-sm"
        >
          {error}
        </p>
      )}
      {fields.map((field) => (
        <DrawerField
          key={field.name}
          field={field}
          values={values}
          record={record}
          canEdit={canEdit}
          onChange={onChange}
        />
      ))}
      {canEdit && (
        <button
          type="button"
          onClick={onSave}
          className="bg-primary text-primary-fg mt-2 self-start rounded px-4 py-2 text-sm"
        >
          Enregistrer
        </button>
      )}
      <DrawerActions
        actions={actions}
        record={record}
      />
    </>
  )
}
