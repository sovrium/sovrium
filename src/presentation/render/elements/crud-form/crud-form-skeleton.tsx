/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { sanitizeRichTextHTML } from '@/domain/kernel/sanitize/html-sanitization'
import { fieldDescribedBy } from '@/presentation/design/field-display'
import { fieldWidgetOf, type FieldWidget } from '@/presentation/design/field-type-behavior'
import { CrudFieldShell } from './crud-field-shell'
import { attachmentFilenames } from './crud-form-attachment-names'
import { renderButtonSkeleton } from './crud-form-button-skeleton'
import type { FieldType } from '@/domain/models/app/tables/fields'

export type SkeletonFieldDef = {
  readonly name: string
  /** Narrowed to the domain field-type union so the render dispatch is total. */
  readonly type: FieldType
  readonly required?: boolean
  /**
   * Option VALUES for choice fields. Already normalized to strings by the
   * field resolver — a `status` field declares its options as
   * `{ value, color }` objects, which would render as `[object Object]`.
   */
  readonly options?: readonly string[]
  readonly displayLabel?: string
  /** Persistent guidance under the control, linked by `aria-describedby`. */
  readonly description?: string
  readonly placeholder?: string
  readonly readOnly?: boolean
  readonly disabled?: boolean
  readonly defaultValue?: string | number | boolean
  readonly hidden?: boolean
  readonly visibleWhen?: unknown
  readonly accept?: string
  readonly dropZone?: boolean
  readonly maxFiles?: number
  /** Present only on `type: 'button'` fields — the label the skeleton shows. */
  readonly button?: { readonly label?: string }
}

/**
 * Native `<input type>` for the plain-input widgets. Every other widget has
 * its own renderer, so this map is keyed by widget — not by field type — and
 * is exhaustive over the widgets that reach `renderDefaultSkeleton`.
 */
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
            className="text-md w-full font-mono"
            {...fieldDescribedBy(field)}
          />
        </code>
      </pre>
    </CrudFieldShell>
  )
}

function renderRichTextSkeleton(field: SkeletonFieldDef): ReactElement {
  // SSR placeholder for the Tiptap WYSIWYG editor. The Tiptap editor mounts
  // post-hydration via the `crud-form` island and replaces this skeleton.
  // Test selector: `[data-rich-text-field="<name>"] .ProseMirror` (post-hydration).
  // We deliberately do NOT render a `<textarea>` so the spec's
  // `await expect(page.locator('textarea[name="body"]')).toHaveCount(0)` passes.
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
  // A schema-declared `default` preselects its option, so the value the user
  // sees before hydration is the value the form will actually write.
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
        {...fieldDescribedBy(field)}
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
        {...fieldDescribedBy(field)}
      />
    </CrudFieldShell>
  )
}

/**
 * Edit-mode file-upload skeleton: renders the native file input plus the
 * existing attachment filename(s) so the current attachment is visible on the
 * server-rendered page before the file-field island hydrates
 *. The island re-derives the same list from the seeded
 * record value and takes over interactivity (preview / remove) after mount.
 */
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
        {...fieldDescribedBy(field)}
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
        {...fieldDescribedBy(field)}
      />
    </CrudFieldShell>
  )
}

/**
 * TOTAL widget → skeleton table for the server-rendered form.
 *
 * `Record<FieldWidget, …>` is the exhaustiveness guard: a newly added widget
 * fails to compile here rather than silently falling through to a plain text
 * box — the fall-through that made a `status` field render as a free-text
 * input and post a value its CHECK constraint rejects.
 *
 * `textarea` and `checkbox` deliberately render as plain inputs: the SSR
 * skeleton is a progressive-enhancement placeholder, and the island swaps in
 * the richer control on hydration.
 */
const SKELETON_RENDERERS: Record<FieldWidget, (field: SkeletonFieldDef) => ReactElement> = {
  button: renderButtonSkeleton,
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
  // The remaining widgets have no bespoke skeleton: the placeholder is a plain
  // input either way, and the island swaps in the real control on hydration.
  // Listed one per line rather than collapsed into a shared default, so adding
  // a widget still forces a decision here instead of inheriting someone else's.
  number: renderDefaultSkeleton,
  date: renderDefaultSkeleton,
  datetime: renderDefaultSkeleton,
  'multi-select': renderDefaultSkeleton,
  'record-picker': renderDefaultSkeleton,
  'user-picker': renderDefaultSkeleton,
  rating: renderDefaultSkeleton,
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
  return SKELETON_RENDERERS[fieldWidgetOf(field.type)](field)
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
    <CrudFieldShell
      key={field.name}
      field={field}
      data-rich-text-field={field.name}
    >
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
        {...fieldDescribedBy(field)}
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
