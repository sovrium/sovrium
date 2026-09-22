/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The business-app data-table create-record modal ([internal ref],
 * dogfooded by the admin Données surface [internal ref]).
 *
 * A Base UI `Dialog` named "Nouvel enregistrement" with one TYPED control per
 * writable field plus Enregistrer / Annuler. Each field's control is derived
 * from its column type (via `fieldMeta`) so the operator gets Notion/Airtable-
 * grade fields rather than a wall of text boxes, and an invalid value can never
 * reach a column CHECK constraint and 500 the create:
 *   - `single-select` / `multi-select` → a native dropdown (role `combobox`) of
 *     the field's declared `options` (no free-text → no CHECK 500);
 *   - numeric columns (number / integer / decimal / currency / …) → a number
 *     input (role `spinbutton`), coerced to a JSON number on submit by the flow;
 *   - email / url / phone / date / datetime → their native input types;
 *   - relationship / formula / lookup / rollup / count → SKIPPED (a relation
 *     needs a record picker, a formula is computed). They stay editable in the
 *     record-detail drawer after the row is created.
 * A field with NO `fieldMeta` entry (or an unknown type) falls back to a plain
 * textbox, so a degenerate table without resolved metadata still creates rows.
 *
 * On Enregistrer it forwards the filled values to the toolbar flow, which
 * coerces + POSTs them to `POST /api/tables/:t/records` and refreshes the bound
 * grid so the new row appears. The toolbar mounts this component only while
 * creating, so the dialog is open-on-mount (closing it — backdrop click, Escape,
 * or Annuler — calls `onCancel`). The dialog portals to `document.body`, so the
 * per-field `aria-label` control is unambiguous against the grid behind.
 */

import { Dialog } from '@base-ui/react/dialog'
import { useCallback, useState, type ReactElement } from 'react'
import {
  optionLabel,
  optionValue,
  type SelectOptionLike,
} from '@/domain/models/app/tables/select-option'
import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import {
  computeTableDialogTitleClasses,
  computeTableAddRowInputClasses,
  computeTableEditorLabelClasses,
} from '@/presentation/design/table-default-classes'
import { type FieldMetaMap } from '../../hooks/use-inline-editing'
import {
  computeDialogPopupClasses,
  computeOverlayBackdropClasses,
} from '../../overlays/overlay-default-classes'
import { isNumericFieldType } from './create-record-data'

/**
 * Field types the create form cannot meaningfully capture with a single typed
 * input — relationships and computed columns (relations need a record picker;
 * formulas/lookups/rollups are computed, never written). They are skipped so the
 * operator isn't shown a control that would 500 on submit. They remain editable
 * post-create via the record-detail drawer.
 */
const UNSUPPORTED_CREATE_TYPES: ReadonlySet<string> = new Set([
  'relationship',
  'relation',
  'formula',
  'lookup',
  'rollup',
  'count',
])

/** Map a field's column type to the native `<input type>` it should render. */
const HTML_INPUT_TYPE: Readonly<Record<string, string>> = {
  email: 'email',
  url: 'url',
  phone: 'tel',
  date: 'date',
  datetime: 'datetime-local',
}

/** A writable create-form field: its name plus the resolved column metadata. */
interface CreateFieldDef {
  readonly name: string
  readonly type: string
  /** Declared options, verbatim — bare strings OR `{ value, label?, color? }`. */
  readonly options?: readonly SelectOptionLike[]
  readonly required?: boolean
}

/** Field-label chrome shared by every typed create control. */
function CreateFieldLabel({
  name,
  children,
}: {
  readonly name: string
  readonly children: ReactElement
}): ReactElement {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className={computeTableEditorLabelClasses()}>{name}</span>
      {children}
    </label>
  )
}

/** A `single-select` control: a native dropdown of the field's declared options. */
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
        className={computeTableAddRowInputClasses()}
        {...(field.required && { required: true })}
      >
        <option value="">— Choisir —</option>
        {(field.options ?? []).map((option) => (
          <option
            key={optionValue(option)}
            value={optionValue(option)}
          >
            {optionLabel(option)}
          </option>
        ))}
      </select>
    </CreateFieldLabel>
  )
}

/** A typed text/number/date input that serializes to the field's column type. */
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
  // Numeric columns get a `number` input (so the value posts as a number and the
  // browser offers numeric affordances); date/email/url/tel map to their native
  // input types; everything else is plain text.
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
        className={computeTableAddRowInputClasses()}
        {...(field.required && { required: true })}
        {...(inputType === 'number' && { inputMode: 'decimal' })}
      />
    </CreateFieldLabel>
  )
}

/** Dispatch a create-form field to its typed control (dropdown / numeric / text). */
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

/**
 * Resolve the ordered writable field descriptors from the table's field-name
 * list + the resolved `fieldMeta`. A field with no metadata falls back to a
 * plain `text` control; relationship/formula/lookup/rollup/count fields are
 * dropped (they can't be captured with a single create control).
 */
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

/** The create-modal popup body: title + scrollable field list + pinned actions. */
function CreateRecordDialogBody({
  title,
  saveLabel,
  cancelLabel,
  fields,
  values,
  onChange,
  onSave,
}: {
  readonly title: string
  readonly saveLabel: string
  readonly cancelLabel: string
  readonly fields: ReadonlyArray<CreateFieldDef>
  readonly values: Record<string, string>
  readonly onChange: (field: string, value: string) => void
  readonly onSave: () => void
}): ReactElement {
  return (
    <Dialog.Popup
      role="dialog"
      aria-label={title}
      className={`${computeDialogPopupClasses()} flex max-h-dvh flex-col gap-3`}
    >
      <Dialog.Title className={computeTableDialogTitleClasses()}>{title}</Dialog.Title>
      {/* Scroll the field list (not the whole popup) so the title stays pinned
          and the actions stay reachable on a wide, many-field table. */}
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
          aria-label={cancelLabel}
          className={computeButtonDefaultClasses({ variant: 'secondary', size: 'sm' })}
        >
          {cancelLabel}
        </Dialog.Close>
        <button
          type="button"
          aria-label={saveLabel}
          onClick={onSave}
          className={computeButtonDefaultClasses({ variant: 'default', size: 'sm' })}
        >
          {saveLabel}
        </button>
      </div>
    </Dialog.Popup>
  )
}

/**
 * The create-record form, presented as a MODAL dialog (Base UI `Dialog`): one
 * labelled typed control per writable field + a save / cancel pair. The dialog
 * is open whenever this component is mounted (the toolbar renders it only while
 * creating), so closing it — backdrop click, Escape, or cancel — calls
 * `onCancel`. On save it forwards the filled values to the toolbar, which
 * coerces + POSTs them and refreshes the grid (the new row shows immediately).
 *
 * `saveLabel` / `cancelLabel` are the footer pair's localized labels, resolved
 * server-side against the app language and defaulting to the English platform
 * strings. The TITLE was localized when [internal ref] shipped and these two were not,
 * which left an English-titled dialog with French buttons underneath it.
 */
export function CreateRecordDialog({
  title = 'New record',
  saveLabel = 'Save',
  cancelLabel = 'Cancel',
  fields,
  fieldMeta,
  onCancel,
  onSubmit,
}: {
  /**
   * The localized create-record label used for the modal title +
   * aria-label. Defaults to the English platform string.
   */
  readonly title?: string
  readonly saveLabel?: string
  readonly cancelLabel?: string
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
          saveLabel={saveLabel}
          cancelLabel={cancelLabel}
          fields={writableFields}
          values={values}
          onChange={onChange}
          onSave={onSave}
        />
      </Dialog.Portal>
    </Dialog.Root>
  )
}
