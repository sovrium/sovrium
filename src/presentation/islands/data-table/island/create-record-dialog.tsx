/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Dialog } from '@base-ui/react/dialog'
import { useCallback, useState, type ReactElement } from 'react'
import { type FieldMetaMap } from '../../hooks/use-inline-editing'
import {
  computeDialogPopupClasses,
  computeDialogTitleClasses,
  computeOverlayBackdropClasses,
} from '../../overlays/overlay-default-classes'
import { isNumericFieldType } from './create-record-data'

const UNSUPPORTED_CREATE_TYPES: ReadonlySet<string> = new Set([
  'relationship',
  'relation',
  'formula',
  'lookup',
  'rollup',
  'count',
])

const HTML_INPUT_TYPE: Readonly<Record<string, string>> = {
  email: 'email',
  url: 'url',
  phone: 'tel',
  date: 'date',
  datetime: 'datetime-local',
}

interface CreateFieldDef {
  readonly name: string
  readonly type: string
  readonly options?: readonly string[]
  readonly required?: boolean
}

function CreateFieldLabel({
  name,
  children,
}: {
  readonly name: string
  readonly children: ReactElement
}): ReactElement {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-foreground-muted">{name}</span>
      {children}
    </label>
  )
}

function CreateSelectField({
  field,
  value,
  onChange,
}: {
  readonly field: CreateFieldDef
  readonly value: string
  readonly onChange: (field: string, value: string) => void
}): ReactElement {
  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => onChange(field.name, event.target.value),
    [field.name, onChange]
  )
  return (
    <CreateFieldLabel name={field.name}>
      <select
        aria-label={field.name}
        value={value}
        onChange={handleChange}
        className="border-border rounded border px-2 py-1"
        {...(field.required && { required: true })}
      >
        <option value="">— Choisir —</option>
        {(field.options ?? []).map((option) => (
          <option
            key={option}
            value={option}
          >
            {option}
          </option>
        ))}
      </select>
    </CreateFieldLabel>
  )
}

function CreateInputField({
  field,
  value,
  onChange,
}: {
  readonly field: CreateFieldDef
  readonly value: string
  readonly onChange: (field: string, value: string) => void
}): ReactElement {
  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => onChange(field.name, event.target.value),
    [field.name, onChange]
  )
  const inputType = isNumericFieldType(field.type)
    ? 'number'
    : (HTML_INPUT_TYPE[field.type] ?? 'text')
  return (
    <CreateFieldLabel name={field.name}>
      <input
        type={inputType}
        aria-label={field.name}
        value={value}
        onChange={handleChange}
        className="border-border rounded border px-2 py-1"
        {...(field.required && { required: true })}
        {...(inputType === 'number' && { inputMode: 'decimal' })}
      />
    </CreateFieldLabel>
  )
}

function CreateField({
  field,
  value,
  onChange,
}: {
  readonly field: CreateFieldDef
  readonly value: string
  readonly onChange: (field: string, value: string) => void
}): ReactElement {
  if (field.type === 'single-select' || field.type === 'multi-select') {
    return (
      <CreateSelectField
        field={field}
        value={value}
        onChange={onChange}
      />
    )
  }
  return (
    <CreateInputField
      field={field}
      value={value}
      onChange={onChange}
    />
  )
}

function resolveWritableFields(
  fields: ReadonlyArray<string>,
  fieldMeta: FieldMetaMap | undefined
): ReadonlyArray<CreateFieldDef> {
  return fields.flatMap((name): ReadonlyArray<CreateFieldDef> => {
    const meta = fieldMeta?.[name]
    const type = meta?.type ?? 'text'
    if (UNSUPPORTED_CREATE_TYPES.has(type)) return []
    return [
      {
        name,
        type,
        ...(meta?.options ? { options: meta.options } : {}),
        ...(meta?.required ? { required: true } : {}),
      },
    ]
  })
}

function CreateRecordDialogBody({
  title,
  fields,
  values,
  onChange,
  onSave,
}: {
  readonly title: string
  readonly fields: ReadonlyArray<CreateFieldDef>
  readonly values: Record<string, string>
  readonly onChange: (field: string, value: string) => void
  readonly onSave: () => void
}): ReactElement {
  return (
    <Dialog.Popup
      role="dialog"
      aria-label={title}
      className={`${computeDialogPopupClasses()} flex max-h-[80vh] flex-col gap-3`}
    >
      <Dialog.Title className={computeDialogTitleClasses()}>{title}</Dialog.Title>
      {}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
        {fields.map((field) => (
          <CreateField
            key={field.name}
            field={field}
            value={values[field.name] ?? ''}
            onChange={onChange}
          />
        ))}
      </div>
      <div className="border-border mt-1 flex items-center justify-end gap-2 border-t pt-3">
        <Dialog.Close
          aria-label="Annuler"
          className="border-border text-foreground-muted hover:bg-background-subtle rounded-md border px-4 py-2 text-sm font-medium transition-colors"
        >
          Annuler
        </Dialog.Close>
        <button
          type="button"
          aria-label="Enregistrer"
          onClick={onSave}
          className="bg-primary text-primary-fg hover:bg-primary-hover rounded-md px-4 py-2 text-sm font-medium transition-colors"
        >
          Enregistrer
        </button>
      </div>
    </Dialog.Popup>
  )
}

export function CreateRecordDialog({
  title = 'New record',
  fields,
  fieldMeta,
  onCancel,
  onSubmit,
}: {
  readonly title?: string
  readonly fields: ReadonlyArray<string>
  readonly fieldMeta?: FieldMetaMap
  readonly onCancel: () => void
  readonly onSubmit: (values: Record<string, string>) => void
}): ReactElement {
  const [values, setValues] = useState<Record<string, string>>({})
  const onChange = useCallback(
    (field: string, value: string) => setValues((prev) => ({ ...prev, [field]: value })),
    []
  )
  const onSave = useCallback(() => onSubmit(values), [onSubmit, values])
  const onOpenChange = useCallback(
    (open: boolean) => {
      if (!open) onCancel()
    },
    [onCancel]
  )
  const writableFields = resolveWritableFields(fields, fieldMeta)
  return (
    <Dialog.Root
      modal
      open
      onOpenChange={onOpenChange}
    >
      <Dialog.Portal>
        <Dialog.Backdrop
          data-overlay
          className={computeOverlayBackdropClasses()}
        />
        <CreateRecordDialogBody
          title={title}
          fields={writableFields}
          values={values}
          onChange={onChange}
          onSave={onSave}
        />
      </Dialog.Portal>
    </Dialog.Root>
  )
}
