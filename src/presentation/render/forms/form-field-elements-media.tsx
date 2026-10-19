/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The two form-field inputs that the inline runtime upgrades after load — the
 * `user` picker and the file upload (with its optional browser recorder) —
 * split out of `form-field-elements.tsx` to keep that file under its size cap.
 */

import { canonicalAcceptAttribute } from '@/domain/models/app/forms/form-file-upload-validation'
import { computeFormFieldClasses } from '@/presentation/design/form-layout-classes'
import { AudioRecorderControls } from './form-audio-recorder'
import { ariaRequired, FIELD_LABEL_CLASS, fieldWrapperAttributes } from './form-field-chrome'
import { SelectInput } from './form-field-elements-design'
import { RequiredMark } from './form-field-elements-typed'
import { HelpText } from './form-help-text'
import type { ResolvedFormField } from './form-field-elements'

/**
 * SSR picker for `user`-typed columns ([internal ref] / the forms specs).
 *
 * Emits a `<div data-field-type="user" data-field-name="..."
 * data-allow-multiple="true|false">` wrapping the choice of the app's
 * accounts — the Select for one account, a native multiple `<select>` for a
 * set — each named by its label and valued by the account id — read on the server for a signed-in visitor, none for anyone
 * else. The wrapper's `data-field-type="user"` marker is the contract the
 * spec asserts.
 */
export const UserInput = ({
  field,
  defaultValue,
}: {
  readonly field: ResolvedFormField
  readonly defaultValue: string | undefined
}) => {
  const multiple = field.allowMultiple === true
  const className = `form-field form-field-user ${computeFormFieldClasses()}`
  const markers = {
    'data-field-type': 'user',
    'data-field-name': field.name,
    'data-allow-multiple': multiple ? 'true' : 'false',
  }
  // One account is the design system's Select; a set of accounts keeps the
  // browser's multiple select.
  if (!multiple) {
    return (
      <SelectInput
        field={{ ...field, placeholder: field.placeholder || 'Select a user...' }}
        defaultValue={defaultValue}
        wrapper={{ className, attributes: markers }}
      />
    )
  }
  return (
    <div
      className={className}
      {...markers}
      {...fieldWrapperAttributes(field)}
    >
      <label
        htmlFor={`field-${field.name}`}
        className={FIELD_LABEL_CLASS}
      >
        {field.label}
        <RequiredMark required={field.required} />
      </label>
      <select
        id={`field-${field.name}`}
        data-component-type="select"
        name={field.name}
        required={field.required}
        {...ariaRequired(field.required)}
        disabled={field.conditionHidden}
        multiple
        defaultValue={defaultValue}
      >
        {(field.options ?? []).map((option) => (
          <option
            key={option.value}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </select>
      <HelpText html={field.helpTextHtml} />
    </div>
  )
}

/**
 * File-input component for `single-attachment` / `multiple-attachments`
 * columns and standalone `attachment` fields. Emits a vanilla `<input
 * type="file">` plus a host `<div>` for the file-chips list and (when
 * `dropZone: true`) a sibling drop-target. The inline runtime
 * (`form-runtime.tsx`) wires up multipart pre-upload, accept / maxFileSize
 * / maxFiles validation, thumbnail previews, and remove buttons against
 * these elements via stable `data-*` markers.
 *
 * Field-level required/disabled/help-text rendering matches the rest of
 * the form-field family for consistency.
 */
export const FileInput = ({
  field,
  multiple,
}: {
  readonly field: ResolvedFormField
  readonly multiple: boolean
}) => (
  <div
    className={`form-field form-field-file ${computeFormFieldClasses()}`}
    data-field-name={field.name}
    {...fieldWrapperAttributes(field)}
  >
    <label
      htmlFor={`field-${field.name}`}
      className={FIELD_LABEL_CLASS}
    >
      {field.label}
      <RequiredMark required={field.required} />
    </label>
    {field.dropZone === true && (
      <div
        className="form-dropzone"
        data-testid={`dropzone-${field.name}`}
        data-form-dropzone={field.name}
      >
        <span>{field.dropZoneLabel ?? 'Drop files here or click to browse'}</span>
      </div>
    )}
    <input
      id={`field-${field.name}`}
      type="file"
      data-component-type="file-upload"
      name={field.name}
      required={field.required}
      {...ariaRequired(field.required)}
      disabled={field.conditionHidden}
      multiple={multiple}
      accept={field.accept ? canonicalAcceptAttribute(field.accept) || undefined : undefined}
      data-form-file-input={field.name}
      {...(field.maxFileSize !== undefined
        ? { 'data-max-file-size': String(field.maxFileSize) }
        : {})}
      {...(multiple && field.maxFiles !== undefined
        ? { 'data-max-files': String(field.maxFiles) }
        : {})}
    />
    {field.recordAudioMaxSeconds !== undefined && (
      <AudioRecorderControls
        fieldName={field.name}
        maxSeconds={field.recordAudioMaxSeconds}
        label={field.recordAudioLabel}
      />
    )}
    <div
      className="form-file-chips"
      data-form-file-chips={field.name}
    />
    <HelpText html={field.helpTextHtml} />
  </div>
)
