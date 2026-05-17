/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { sanitizeRichTextHTML } from '@/domain/utils/html-sanitization'

type SingleSelectField = { options?: readonly string[] }

export type SkeletonFieldDef = {
  readonly name: string
  readonly type: string
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

const TYPED_INPUT_MAP: Record<string, string> = {
  email: 'email',
  number: 'number',
  url: 'url',
  phone: 'tel',
}

function labelText(field: SkeletonFieldDef): string {
  return field.displayLabel ?? field.name
}

function renderCodeSkeleton(field: SkeletonFieldDef): ReactElement {
  return (
    <label key={field.name}>
      {labelText(field)}
      <pre>
        <code>
          <textarea
            name={field.name}
            className="w-full font-mono text-sm"
          />
        </code>
      </pre>
    </label>
  )
}

function renderRichTextSkeleton(field: SkeletonFieldDef): ReactElement {
  // SSR placeholder for the Tiptap WYSIWYG editor. The Tiptap editor mounts
  // post-hydration via the `crud-form` island and replaces this skeleton.
  // Test selector: `[data-rich-text-field="<name>"] .ProseMirror` (post-hydration).
  // We deliberately do NOT render a `<textarea>` so the spec's
  // `await expect(page.locator('textarea[name="body"]')).toHaveCount(0)` passes.
  return (
    <label
      key={field.name}
      data-rich-text-field={field.name}
    >
      {labelText(field)}
      <div className="rounded border">
        <div
          className="min-h-[6em] w-full p-3 text-gray-400"
          aria-hidden="true"
        >
          {field.placeholder ?? ''}
        </div>
      </div>
      <input
        type="hidden"
        name={field.name}
      />
    </label>
  )
}

function renderSelectSkeleton(field: SkeletonFieldDef): ReactElement {
  const options = (field as unknown as SingleSelectField).options ?? []
  return (
    <label key={field.name}>
      {labelText(field)}
      <select name={field.name}>
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
    </label>
  )
}

function renderFileSkeleton(field: SkeletonFieldDef, multiple: boolean): ReactElement {
  return (
    <label key={field.name}>
      {labelText(field)}
      <input
        type="file"
        name={field.name}
        {...(multiple && { multiple: true })}
        {...(field.accept !== undefined && { accept: field.accept })}
      />
    </label>
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
  const inputType = TYPED_INPUT_MAP[field.type] ?? 'text'
  return (
    <label key={field.name}>
      {labelText(field)}
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
    </label>
  )
}

export function renderSkeletonField(field: SkeletonFieldDef): ReactElement {
  if (field.hidden) return renderHiddenSkeleton(field)
  if (field.visibleWhen) {
    // Conditionally visible fields start hidden in SSR; the island controls visibility
    return (
      <div
        key={field.name}
        hidden
      />
    )
  }
  switch (field.type) {
    case 'code':
      return renderCodeSkeleton(field)
    case 'rich-text':
      return renderRichTextSkeleton(field)
    case 'single-select':
      return renderSelectSkeleton(field)
    case 'single-attachment':
      return renderFileSkeleton(field, false)
    case 'multiple-attachments':
      return renderFileSkeleton(field, true)
    default:
      return renderDefaultSkeleton(field)
  }
}

function renderUpdateRichTextSkeleton(field: SkeletonFieldDef, currentValue: string): ReactElement {
  // Update-form SSR placeholder; the Tiptap editor will rehydrate with
  // `currentValue` once the crud-form island mounts. We render the HTML in
  // a div via dangerouslySetInnerHTML, plus a hidden input so native
  // `<form action="...">` submission still carries the value when JS is
  // unavailable.
  //
  // SECURITY: Defence-in-depth sanitization. The value was already
  // scrubbed at write time by `sanitizeRichTextFields` in
  // `record-rules.ts`, but we also scrub at read time so legacy rows
  // persisted before that feature shipped can't smuggle XSS payloads
  // through this SSR sink. See `@/domain/utils/html-sanitization`.
  const sanitized = sanitizeRichTextHTML(currentValue)
  return (
    <label
      key={field.name}
      data-rich-text-field={field.name}
    >
      {labelText(field)}
      <div
        className="min-h-[6em] rounded border p-3"
        aria-hidden="true"
        // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- SSR rich-text skeleton; one-shot during server render
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
      <input
        type="hidden"
        name={field.name}
        defaultValue={sanitized}
      />
    </label>
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
  const inputType = TYPED_INPUT_MAP[field.type] ?? 'text'
  return (
    <label key={field.name}>
      {labelText(field)}
      <input
        type={inputType}
        name={field.name}
        defaultValue={currentValue}
        {...(field.required && { required: true, 'data-required': 'true' })}
        {...(field.placeholder && { placeholder: field.placeholder })}
        {...(field.readOnly && { readOnly: true })}
        {...(field.disabled && { disabled: true })}
      />
    </label>
  )
}

export function renderUpdateSkeletonField(
  field: SkeletonFieldDef,
  record: Record<string, unknown>
): ReactElement {
  const currentValue = String(record[field.name] ?? '')
  if (field.hidden) return renderUpdateHiddenSkeleton(field, currentValue)
  if (field.type === 'rich-text') return renderUpdateRichTextSkeleton(field, currentValue)
  if (field.type === 'single-attachment') return renderFileSkeleton(field, false)
  if (field.type === 'multiple-attachments') return renderFileSkeleton(field, true)
  return renderUpdateInputSkeleton(field, currentValue)
}
