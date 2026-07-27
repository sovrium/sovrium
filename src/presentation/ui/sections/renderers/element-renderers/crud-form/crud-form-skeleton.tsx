/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { sanitizeRichTextHTML } from '@/domain/utils/html-sanitization'
import { fieldWidgetOf, type FieldWidget } from '@/presentation/utils/field-type-behavior'
import { CrudFieldShell } from './crud-field-shell'
import type { FieldType } from '@/domain/models/app/tables/fields'

export type SkeletonFieldDef = {
  readonly name: string
  readonly type: FieldType
  readonly required?: boolean
  readonly options?: readonly string[]
  readonly displayLabel?: string
  readonly placeholder?: string
  readonly readOnly?: boolean
  readonly disabled?: boolean
  readonly defaultValue?: string | number | boolean
  readonly hidden?: boolean
  readonly visibleWhen?: unknown
  readonly accept?: string
  readonly dropZone?: boolean
  readonly maxFiles?: number
}

const INPUT_TYPE_BY_WIDGET: Partial<Record<FieldWidget, string>> = {
  email: 'email',
  url: 'url',
}

function inputTypeOf(field: SkeletonFieldDef): string {
  return INPUT_TYPE_BY_WIDGET[fieldWidgetOf(field.type)] ?? 'text'
}

function renderCodeSkeleton(field: SkeletonFieldDef): ReactElement {
  return (
    <CrudFieldShell
      key={field.name}
      field={field}
    >
      <pre>
        <code>
          <textarea
            name={field.name}
            className="w-full font-mono text-sm"
          />
        </code>
      </pre>
    </CrudFieldShell>
  )
}

function renderRichTextSkeleton(field: SkeletonFieldDef): ReactElement {
  return (
    <CrudFieldShell
      key={field.name}
      field={field}
      data-rich-text-field={field.name}
    >
      <div className="rounded border">
        <div
          className="text-foreground-muted min-h-[6em] w-full p-3"
          aria-hidden="true"
        >
          {field.placeholder ?? ''}
        </div>
      </div>
      <input
        type="hidden"
        name={field.name}
      />
    </CrudFieldShell>
  )
}

function renderSelectSkeleton(field: SkeletonFieldDef): ReactElement {
  const options = field.options ?? []
  const defaultValue = field.defaultValue !== undefined ? String(field.defaultValue) : ''
  return (
    <CrudFieldShell
      key={field.name}
      field={field}
    >
      <select
        name={field.name}
        defaultValue={defaultValue}
        {...(field.disabled && { disabled: true })}
      >
        <option value="">Select...</option>
        {options.map((opt) => (
          <option
            key={opt}
            value={opt}
          >
            {opt}
          </option>
        ))}
      </select>
    </CrudFieldShell>
  )
}

function renderFileSkeleton(field: SkeletonFieldDef, multiple: boolean): ReactElement {
  return (
    <CrudFieldShell
      key={field.name}
      field={field}
    >
      <input
        type="file"
        name={field.name}
        {...(multiple && { multiple: true })}
        {...(field.accept !== undefined && { accept: field.accept })}
      />
    </CrudFieldShell>
  )
}

function attachmentNameFromKey(key: string): string {
  return (
    key.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-(.+)$/i)?.[1] ?? key
  )
}

function attachmentNameFromEntry(entry: unknown): string | undefined {
  if (typeof entry === 'string') return attachmentNameFromKey(entry)
  if (typeof entry === 'object' && entry !== null) {
    const { name } = entry as Record<string, unknown>
    return typeof name === 'string' ? name : undefined
  }
  return undefined
}

function attachmentFilenames(rawValue: unknown): readonly string[] {
  if (typeof rawValue === 'object' && rawValue !== null) {
    const list = Array.isArray(rawValue) ? rawValue : [rawValue]
    return list.map(attachmentNameFromEntry).filter((n): n is string => n !== undefined)
  }
  if (typeof rawValue !== 'string') return []
  const trimmed = rawValue.trim()
  if (!trimmed) return []
  try {
    const parsed = JSON.parse(trimmed) as unknown
    const list = Array.isArray(parsed) ? parsed : [parsed]
    return list.map(attachmentNameFromEntry).filter((n): n is string => n !== undefined)
  } catch {
    return [attachmentNameFromKey(trimmed)]
  }
}

function renderUpdateFileSkeleton(
  field: SkeletonFieldDef,
  multiple: boolean,
  currentValue: unknown
): ReactElement {
  const names = attachmentFilenames(currentValue)
  return (
    <CrudFieldShell
      key={field.name}
      field={field}
    >
      <input
        type="file"
        name={field.name}
        {...(multiple && { multiple: true })}
        {...(field.accept !== undefined && { accept: field.accept })}
      />
      {names.length > 0 && (
        <ul data-existing-attachments={field.name}>
          {names.map((name, index) => (
            <li
              key={`${name}-${index}`}
              data-file-name={name}
            >
              <span>{name}</span>
            </li>
          ))}
        </ul>
      )}
    </CrudFieldShell>
  )
}

function renderHiddenSkeleton(field: SkeletonFieldDef): ReactElement {
  return (
    <input
      key={field.name}
      type="hidden"
      name={field.name}
      defaultValue={String(field.defaultValue ?? '')}
    />
  )
}

function renderDefaultSkeleton(field: SkeletonFieldDef): ReactElement {
  const inputType = inputTypeOf(field)
  return (
    <CrudFieldShell
      key={field.name}
      field={field}
    >
      <input
        type={inputType}
        name={field.name}
        {...(field.required && { required: true, 'data-required': 'true' })}
        {...(field.placeholder && { placeholder: field.placeholder })}
        {...(field.readOnly && { readOnly: true })}
        {...(field.disabled && { disabled: true })}
        {...(field.defaultValue !== undefined && {
          defaultValue: String(field.defaultValue),
        })}
      />
    </CrudFieldShell>
  )
}

const SKELETON_RENDERERS: Record<FieldWidget, (field: SkeletonFieldDef) => ReactElement> = {
  code: renderCodeSkeleton,
  'rich-text': renderRichTextSkeleton,
  select: renderSelectSkeleton,
  'file-single': (field) => renderFileSkeleton(field, false),
  'file-multiple': (field) => renderFileSkeleton(field, true),
  textarea: renderDefaultSkeleton,
  checkbox: renderDefaultSkeleton,
  text: renderDefaultSkeleton,
  email: renderDefaultSkeleton,
  url: renderDefaultSkeleton,
}

export function renderSkeletonField(field: SkeletonFieldDef): ReactElement {
  if (field.hidden) return renderHiddenSkeleton(field)
  if (field.visibleWhen) {
    return (
      <div
        key={field.name}
        hidden
      />
    )
  }
  return SKELETON_RENDERERS[fieldWidgetOf(field.type)](field)
}

function renderUpdateRichTextSkeleton(field: SkeletonFieldDef, currentValue: string): ReactElement {
  const sanitized = sanitizeRichTextHTML(currentValue)
  return (
    <CrudFieldShell
      key={field.name}
      field={field}
      data-rich-text-field={field.name}
    >
      <div
        className="min-h-[6em] rounded border p-3"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
      <input
        type="hidden"
        name={field.name}
        defaultValue={sanitized}
      />
    </CrudFieldShell>
  )
}

function renderUpdateHiddenSkeleton(field: SkeletonFieldDef, currentValue: string): ReactElement {
  return (
    <input
      key={field.name}
      type="hidden"
      name={field.name}
      defaultValue={currentValue || String(field.defaultValue ?? '')}
    />
  )
}

function renderUpdateInputSkeleton(field: SkeletonFieldDef, currentValue: string): ReactElement {
  const inputType = inputTypeOf(field)
  return (
    <CrudFieldShell
      key={field.name}
      field={field}
    >
      <input
        type={inputType}
        name={field.name}
        defaultValue={currentValue}
        {...(field.required && { required: true, 'data-required': 'true' })}
        {...(field.placeholder && { placeholder: field.placeholder })}
        {...(field.readOnly && { readOnly: true })}
        {...(field.disabled && { disabled: true })}
      />
    </CrudFieldShell>
  )
}

export function renderUpdateSkeletonField(
  field: SkeletonFieldDef,
  record: Record<string, unknown>
): ReactElement {
  const currentValue = String(record[field.name] ?? '')
  if (field.hidden) return renderUpdateHiddenSkeleton(field, currentValue)
  if (field.type === 'rich-text') return renderUpdateRichTextSkeleton(field, currentValue)
  if (field.type === 'single-attachment')
    return renderUpdateFileSkeleton(field, false, record[field.name])
  if (field.type === 'multiple-attachments')
    return renderUpdateFileSkeleton(field, true, record[field.name])
  return renderUpdateInputSkeleton(field, currentValue)
}
