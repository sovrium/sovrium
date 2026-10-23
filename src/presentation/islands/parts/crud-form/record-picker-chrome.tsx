/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeBadgeClasses } from '@/presentation/design/badge-default-classes'
import {
  computeFieldDescriptionClasses,
  computeFieldLabelClasses,
} from '@/presentation/design/field-default-classes'
import { fieldDescribedBy, fieldDescriptionId } from '@/presentation/design/field-display'
import {
  computeFormControlClasses,
  computeFormHelpTextClasses,
} from '@/presentation/design/form-layout-classes'
import {
  linkCountLabel,
  pickerWord,
  resolvePickerEmptyLabel,
  type PickerWords,
} from '../../runtime/picker-contract'
import { OptionListbox } from '../option-listbox'
import { type FieldDef } from './field-def'
import { useFieldLineIds } from './field-id-scope'
import { FieldLabelText } from './field-label'
import type { RecordPicker } from './use-record-picker'
import type { CandidateSearch } from '../use-candidate-search'
import type { ReactElement, ReactNode } from 'react'

/**
 * The two presentational pieces of the form's record picker, split out of
 * `record-picker-field.tsx` to keep that island file under the per-island
 * `max-lines` cap. Neither holds state.
 */

/** The removable chips a multi-valued picker shows for what it already links. */
export function LinkedChips(props: {
  readonly ids: readonly string[]
  readonly labelOfId: (id: string) => string
  readonly onRemove: (id: string) => void
}): ReactElement {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {props.ids.map((id) => (
        <li
          key={id}
          className={`${computeBadgeClasses({ variant: 'outline' })} gap-1`}
        >
          <span>{props.labelOfId(id)}</span>
          <button
            type="button"
            aria-label={`Remove ${props.labelOfId(id)}`}
            className="text-muted-foreground hover:text-foreground"
            onClick={() => props.onRemove(id)}
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  )
}

/** A field's label, its control and its description, laid into the field that holds them. */
export function FieldShell(props: {
  readonly field: FieldDef
  readonly inputId: string
  readonly children: ReactNode
}): ReactElement {
  return (
    <>
      <label
        data-slot="field-label"
        htmlFor={props.inputId}
        className={computeFieldLabelClasses()}
      >
        <FieldLabelText field={props.field} />
      </label>
      {props.children}
      {props.field.description !== undefined && (
        <small
          id={fieldDescriptionId(props.field.name)}
          data-slot="field-description"
          className={`help-text ${computeFieldDescriptionClasses()}`}
        >
          {props.field.description}
        </small>
      )}
    </>
  )
}

/**
 * The popup a form picker opens under its combobox.
 *
 * `ariaLabel` is deliberately NOT the field's own label. The combobox already
 * carries that name, and duplicating it onto the popup gives one control two
 * elements answering to it — ambiguous to a reader navigating by label, and to
 * any locator resolving by one. The association travels through
 * `aria-controls`, as the combobox pattern intends.
 */
export function SuggestionsPopup(props: {
  readonly id: string
  readonly search: CandidateSearch
  readonly selected: readonly string[]
  readonly multiple: boolean
  readonly onToggle: (id: string) => void
  readonly words?: PickerWords
}): ReactElement {
  const { search, words } = props
  // Same words and same precedence as the GRID's picker over the same records.
  // The form passes no `unconfiguredLabel`: a field with no `relatedTable`
  // searches nothing here and reads as an empty result, where the grid names
  // the misconfiguration. That divergence is pre-existing and deliberate to
  // leave — closing it changes what a reader sees.
  const emptyLabel = resolvePickerEmptyLabel({
    failed: search.failed,
    loading: search.loading,
    emptyLabel: pickerWord(words, 'picker.noMatchingRecords'),
    failedLabel: pickerWord(words, 'picker.loadFailed'),
    searchingLabel: pickerWord(words, 'picker.searching'),
  })
  return (
    <div
      id={props.id}
      className="absolute top-full left-0 z-20 flex w-full flex-col"
    >
      <OptionListbox
        candidates={search.candidates}
        selected={props.selected}
        onToggle={props.onToggle}
        multiple={props.multiple}
        ariaLabel="Suggestions"
        emptyLabel={emptyLabel}
      />
      {search.hasMore && (
        <button
          type="button"
          // The pointer-down default is prevented so the combobox's own blur
          // does not close this popup before the click lands on it.
          onMouseDown={(e) => e.preventDefault()}
          onClick={search.loadMore}
          className="border-border bg-card text-muted-foreground hover:bg-muted -mt-px w-full border-x border-b py-1 text-center text-sm"
        >
          {pickerWord(words, 'picker.loadMore')}
        </button>
      )}
    </div>
  )
}

/**
 * "N of N linked" — shown whenever the column declares a ceiling.
 *
 * The WORDING comes from {@link linkCountLabel}, shared with the grid picker's
 * own link count; only the placement differs — plain muted text under the field
 * here, a bordered strip continuing the popover's border stack there.
 */
export function LinkCount(props: {
  readonly linked: number
  readonly maxLinked: number
  readonly words?: PickerWords
}): ReactElement {
  return (
    <span className={computeFormHelpTextClasses()}>
      {linkCountLabel(props.linked, props.maxLinked, props.words)}
    </span>
  )
}

/** The field's guidance, then the refusal line when there is one. */
function describedBy(field: FieldDef, errorId: string | undefined, descriptionId: string) {
  const own = field.description === undefined ? undefined : descriptionId
  const ids = [own, errorId].filter((id): id is string => id !== undefined)
  return ids.length === 0 ? {} : { 'aria-describedby': ids.join(' ') }
}

/**
 * The picker's search box.
 *
 * A real `role="combobox"` rather than a text input that happens to have a list
 * beside it: that role is what makes the control announce itself as a choice
 * among candidates, and it is what a `relationship` column had on the grid and
 * never had on a form.
 *
 * `readOnly` at the cap rather than `disabled`: a disabled input leaves the
 * focus ring behind and drops out of the tab order, so a reader tabbing through
 * a form would skip the field whose links they came to change.
 */
export function PickerCombobox(props: {
  readonly field: FieldDef
  readonly inputId: string
  readonly value: string
  readonly expanded: boolean
  readonly locked: boolean
  readonly invalid?: boolean
  /** The id of the line saying why the value was refused, added to the field's description. */
  readonly errorId?: string
  /**
   * The `data-component-type` the combobox names itself with, where the picker
   * is drawn inside a surface that names its parts (a record drawer). A page
   * `record-picker` is named on its host, so the combobox inside it is not.
   */
  readonly componentType?: string
  /** The search box's surface, where the host draws its controls to its own recipe. */
  readonly controlClassName?: string
  readonly onTerm: (term: string) => void
  readonly onOpen: () => void
  readonly onClose: () => void
}): ReactElement {
  const { field } = props
  const { description } = useFieldLineIds(field.name)
  return (
    <input
      id={props.inputId}
      name={field.name}
      type="text"
      role="combobox"
      data-component-type={props.componentType}
      aria-expanded={props.expanded}
      aria-autocomplete="list"
      aria-controls={`${props.inputId}-listbox`}
      autoComplete="off"
      value={props.value}
      className={props.controlClassName ?? `${CONTROL_CLASS} w-full`}
      {...(props.locked && { readOnly: true })}
      {...(field.required && { required: true, 'data-required': 'true' })}
      {...(field.placeholder && { placeholder: field.placeholder })}
      {...(props.invalid && { 'aria-invalid': 'true' })}
      {...describedBy(field, props.errorId, description)}
      onChange={(e) => props.onTerm(e.target.value)}
      onFocus={props.onOpen}
      onClick={props.onOpen}
      onBlur={props.onClose}
    />
  )
}

/**
 * The read-only rendering: NOT a combobox. A control that cannot be opened must
 * not announce itself as one, and the reader sees the RESOLVED display value
 * rather than the foreign key behind it.
 */
export function ReadOnlyPicker(props: {
  readonly field: FieldDef
  readonly inputId: string
  readonly display: string
}): ReactElement {
  return (
    <FieldShell
      field={props.field}
      inputId={props.inputId}
    >
      <input
        id={props.inputId}
        name={props.field.name}
        type="text"
        readOnly
        value={props.display}
        className={CONTROL_CLASS}
        {...fieldDescribedBy(props.field)}
      />
    </FieldShell>
  )
}

/** The canonical input/select/textarea surface, shared with the other controls. */
const CONTROL_CLASS = computeFormControlClasses()

/**
 * The search box and the popup it controls, as one positioned group.
 *
 * They share a `relative` container because the popup is absolutely positioned
 * against the box; separating them would put the anchor in one file and the
 * thing it anchors in another.
 */
export function PickerControl(props: {
  readonly field: FieldDef
  readonly inputId: string
  readonly picker: RecordPicker
  readonly allowMultiple: boolean
  readonly invalid?: boolean
  /** See `PickerCombobox`'s `errorId`. */
  readonly errorId?: string
  /** See `PickerCombobox`'s `componentType`. */
  readonly componentType?: string
  /** See `PickerCombobox`'s `controlClassName`. */
  readonly controlClassName?: string
  /** The pickers' words in the page language (`picker.*`). */
  readonly words?: PickerWords
}): ReactElement {
  const { picker, inputId } = props
  const expanded = picker.open && !picker.atCap
  return (
    <div className="relative">
      <PickerCombobox
        field={props.field}
        inputId={inputId}
        value={picker.inputValue}
        expanded={expanded}
        locked={picker.atCap}
        onTerm={picker.setTerm}
        onOpen={picker.openPopup}
        // Deferred so a click landing on an option is not cancelled by the blur
        // that precedes it.
        onClose={() => setTimeout(picker.closePopup, BLUR_CLOSE_DELAY_MS)}
        {...(props.invalid !== undefined && { invalid: props.invalid })}
        {...(props.errorId !== undefined && { errorId: props.errorId })}
        {...(props.componentType !== undefined && { componentType: props.componentType })}
        {...(props.controlClassName !== undefined && {
          controlClassName: props.controlClassName,
        })}
      />
      {expanded && (
        <SuggestionsPopup
          id={`${inputId}-listbox`}
          search={picker.search}
          selected={picker.linkedIds}
          multiple={props.allowMultiple}
          onToggle={picker.toggle}
          words={props.words}
        />
      )}
    </div>
  )
}

/** How long a blur waits before closing the popup, so a click on an option lands. */
const BLUR_CLOSE_DELAY_MS = 150
