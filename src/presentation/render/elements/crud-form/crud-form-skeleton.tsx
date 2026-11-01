/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { sanitizeRichTextHTML } from '@/domain/kernel/sanitize/html-sanitization'
import { fieldDescribedBy } from '@/presentation/design/field-display'
import {
  fieldWidgetOf,
  skeletonValueText,
  type FieldWidget,
} from '@/presentation/design/field-type-behavior'
import { CrudFieldShell } from './crud-field-shell'
import { attachmentFilenames } from './crud-form-attachment-names'
import { renderButtonSkeleton } from './crud-form-button-skeleton'
import { renderDateSkeleton, renderSelectSkeleton } from './crud-form-choice-skeletons'
import { isMultiLineField, renderTextareaSkeleton } from './crud-form-textarea-skeleton'
import {
  controlStateAttributes,
  inputTypeOf,
  inputValueOf,
  typedInputAttributes,
  withAdornment,
} from './crud-form-typed-input'
import type { FieldType } from '@/domain/models/app/tables/fields'
import type {
  ChoiceOption,
  TypedColumnConfig,
} from '@/presentation/design/field-control-attributes'

export type SkeletonFieldDef = TypedColumnConfig & {
  readonly name: string
  /**
   * The author's `control` over a text column: drawn masked (`password`) or as
   * a multi-line box (`textarea`), the value still saved as the column's text.
   */
  readonly control?: 'password' | 'textarea'
  /** Narrowed to the domain field-type union so the render dispatch is total. */
  readonly type: FieldType
  readonly required?: boolean
  /** A choice field's options: the stored `value` and the `label` the control offers. */
  readonly options?: readonly ChoiceOption[]
  readonly displayLabel?: string
  /** Persistent guidance under the control, linked by `aria-describedby`. */
  readonly description?: string
  readonly placeholder?: string
  readonly autocomplete?: string
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
          className="text-muted-foreground min-h-[6em] w-full p-3"
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
 * The island re-derives the same list from the seeded
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
  if (isMultiLineField(field))
    return renderTextareaSkeleton(field, String(field.defaultValue ?? ''))
  const inputType = inputTypeOf(field)
  return (
    <CrudFieldShell
      key={field.name}
      field={field}
    >
      {withAdornment(
        field,
        <input
          type={inputType}
          name={field.name}
          {...typedInputAttributes(field)}
          {...controlStateAttributes(field)}
          {...(field.defaultValue !== undefined && {
            defaultValue: inputValueOf(field, String(field.defaultValue)),
          })}
        />
      )}
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
 * `checkbox` deliberately renders as a plain input: the SSR skeleton is a
 * progressive-enhancement placeholder, and the island swaps in the richer
 * control on hydration. `textarea` goes through the same renderer, which draws
 * it as a real `<textarea>` so its line breaks survive.
 */
const SKELETON_RENDERERS: Record<
  FieldWidget,
  (field: SkeletonFieldDef, words?: Readonly<Record<string, string>>) => ReactElement
> = {
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
  // The remaining widgets have no bespoke skeleton but the date picker's: the
  // placeholder is a plain input either way — typed as the island's control is
  // (`number`, `datetime-local`) — and the island swaps in the real control.
  // Listed one per line rather than collapsed into a shared default, so adding
  // a widget still forces a decision here instead of inheriting someone else's.
  number: renderDefaultSkeleton,
  date: (field) => renderDateSkeleton(field, String(field.defaultValue ?? '')),
  datetime: renderDefaultSkeleton,
  'multi-select': renderDefaultSkeleton,
  'record-picker': renderDefaultSkeleton,
  'user-picker': renderDefaultSkeleton,
  rating: renderDefaultSkeleton,
}

/** `words` are the island's page-language strings, so a skeleton draws what the island will. */
export function renderSkeletonField(
  field: SkeletonFieldDef,
  words?: Readonly<Record<string, string>>
): ReactElement {
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
  return SKELETON_RENDERERS[fieldWidgetOf(field.type)](field, words)
}

function renderUpdateRichTextSkeleton(field: SkeletonFieldDef, currentValue: string): ReactElement {
  // Update-form SSR placeholder; the Tiptap editor will rehydrate with
  // `currentValue` once the crud-form island mounts. We render the HTML in
  // a div via dangerouslySetInnerHTML, plus a hidden input so native
  // `<form action="...">` submission still carries the value when JS is
  // unavailable.
  //
  // SECURITY: Defence-in-depth sanitization. The value was already
  // cleaned at write time by every record write (`record-write-values.ts`),
  // but we also scrub at read time so legacy rows persisted before that
  // shipped can't smuggle XSS payloads through this SSR sink.
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
  if (isMultiLineField(field)) return renderTextareaSkeleton(field, currentValue)
  const inputType = inputTypeOf(field)
  return (
    <CrudFieldShell
      key={field.name}
      field={field}
    >
      {withAdornment(
        field,
        <input
          type={inputType}
          name={field.name}
          defaultValue={inputValueOf(field, currentValue)}
          {...typedInputAttributes(field)}
          {...controlStateAttributes(field)}
        />
      )}
    </CrudFieldShell>
  )
}

export function renderUpdateSkeletonField(
  field: SkeletonFieldDef,
  record: Record<string, unknown>
): ReactElement {
  const currentValue = skeletonValueText(field.type, record[field.name])
  if (field.hidden) return renderUpdateHiddenSkeleton(field, currentValue)
  if (field.type === 'rich-text') return renderUpdateRichTextSkeleton(field, currentValue)
  if (field.type === 'single-attachment')
    return renderUpdateFileSkeleton(field, false, record[field.name])
  if (field.type === 'multiple-attachments')
    return renderUpdateFileSkeleton(field, true, record[field.name])
  if (fieldWidgetOf(field.type) === 'date') return renderDateSkeleton(field, currentValue)
  return renderUpdateInputSkeleton(field, currentValue)
}
