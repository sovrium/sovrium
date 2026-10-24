/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactElement,
  type Ref,
} from 'react'
import { cn } from '@/presentation/design/class-merge'
import { ChevronDownGlyph } from '@/presentation/design/control-glyphs'
import {
  computeSelectIconClasses,
  computeSelectTriggerClasses,
  computeSelectValueClasses,
} from '@/presentation/design/select-default-classes'

/**
 * A choice field drawn as shadcn/ui's `Select` on Base UI — a combobox opening
 * a listbox of the field's options — rather than the browser's own drop-down,
 * which ignored the app's design and its type scale.
 *
 * Every form surface draws its choices with it: the table-bound form, the
 * hosted and embedded forms, and the editable record drawer. The value is the
 * chosen option's stored value as a string, `''` for none, and Base UI's own
 * input posts it under the field's `name`: an input the browser validates (a
 * required choice left untouched is `valueMissing`), never a `type="hidden"`
 * one, which the browser would skip.
 *
 * The leading "no answer" choice, when the surface offers one, is named by
 * `emptyLabel` (the field's placeholder): an optional field can be set back to
 * empty, and a required one starts on it, so nothing is answered for a reader
 * who never opened the list.
 *
 * Base UI's Select is heavy, and most forms and drawers never draw a choice:
 * it is loaded on demand (`choice-select-list`, one chunk every island shares,
 * see {@link useLoadedList}).
 * Until it lands, a stand-in of the closed trigger holds the field's place —
 * same box, same label, same named input — disabled, so nothing is lost and
 * nothing shifts, and a click waits for the real Select.
 */
export interface ChoiceSelectOption {
  readonly value: string
  readonly label: string
}

export interface ChoiceSelectProps {
  /** The trigger's id, which a `<label for>` names it by. */
  readonly id?: string | undefined
  readonly name: string
  readonly value: string
  /**
   * The value taken. `picked` is true when the reader took it from the list —
   * clicked or pressed Enter on an option — rather than typing ahead on the
   * closed trigger or the browser filling it, which may land on the value
   * already held.
   */
  readonly onValueChange: (value: string, picked: boolean) => void
  readonly options: readonly ChoiceSelectOption[]
  /** The leading "no answer" choice's label; absent draws no such choice. */
  readonly emptyLabel?: string | undefined
  readonly required?: boolean
  readonly disabled?: boolean
  /** The value is fixed: drawn `disabled`, and says why with `aria-readonly`. */
  readonly readOnly?: boolean
  readonly invalid?: boolean
  readonly describedBy?: string | undefined
  /** The trigger's name when no `<label for>` names it. */
  readonly ariaLabel?: string
  /** Classes added to the trigger (a width, an indent for a leading dot). */
  readonly triggerClassName?: string | undefined
  /** The trigger takes its height from `triggerClassName`, not from the default size. */
  readonly unsized?: boolean
  /** The input that carries the value under `name`. */
  readonly inputRef?: Ref<HTMLInputElement>
}

/** One entry of the list: an option, or the leading "no answer" (`null`). */
export interface ChoiceItem {
  readonly value: string | null
  readonly label: string
}

/** What the loaded Select receives: the props, its list, and its trigger's attributes. */
export interface ChoiceSelectListProps extends ChoiceSelectProps {
  readonly items: readonly ChoiceItem[]
  readonly trigger: Readonly<Record<string, string>>
}

type ChoiceSelectListComponent = (props: ChoiceSelectListProps) => ReactElement

/** The loaded Select, once its chunk has landed: every later Select draws it at once. */
let loadedList: ChoiceSelectListComponent | undefined

const loadList = (): Promise<ChoiceSelectListComponent> =>
  import('./choice-select-list').then((module) => (loadedList = module.default))

/**
 * The loaded Select, or `undefined` while its chunk is on its way. A state
 * update rather than `lazy` + `Suspense`: React throttles a Suspense reveal on
 * a timer, so a page whose timers are held (a paused clock, a busy tab) kept
 * the disabled stand-in indefinitely after the chunk had landed.
 */
function useLoadedList(): ChoiceSelectListComponent | undefined {
  const [list, setList] = useState<ChoiceSelectListComponent | undefined>(() => loadedList)
  useEffect(() => {
    if (list !== undefined) return undefined
    let live = true
    void loadList().then((loaded) => {
      if (live) setList(() => loaded)
    })
    return () => {
      live = false
    }
  }, [list])
  return list
}

/** The trigger's attributes, shared by the stand-in and the loaded Select. */
function triggerAttributes(props: ChoiceSelectProps): Readonly<Record<string, string>> {
  return {
    ...(props.id === undefined ? {} : { id: props.id }),
    className: cn(computeSelectTriggerClasses(), 'w-full', props.triggerClassName),
    'data-slot': 'select-trigger',
    ...(props.unsized === true ? {} : { 'data-size': 'default' }),
    'data-component-type': 'select',
    'data-name': props.name,
    ...(props.readOnly === true ? { 'aria-readonly': 'true' } : {}),
    ...(props.invalid === true ? { 'aria-invalid': 'true' } : {}),
    ...(props.describedBy === undefined ? {} : { 'aria-describedby': props.describedBy }),
    ...(props.ariaLabel === undefined ? {} : { 'aria-label': props.ariaLabel }),
  }
}

/** The value input Base UI draws, clipped to nothing and out of the tab order. */
const HIDDEN_INPUT: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  border: 0,
  overflow: 'hidden',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
}

const keepValue = (): void => undefined

/** The closed trigger and its named input, drawn while the Select is on its way. */
function StandIn({
  props,
  items,
  trigger,
}: {
  readonly props: ChoiceSelectProps
  readonly items: readonly ChoiceItem[]
  readonly trigger: Readonly<Record<string, string>>
}): ReactElement {
  const chosen = props.value === '' ? undefined : items.find((item) => item.value === props.value)
  return (
    <>
      <button
        type="button"
        role="combobox"
        disabled
        aria-expanded="false"
        aria-haspopup="listbox"
        {...trigger}
        {...(chosen === undefined && { 'data-placeholder': '' })}
      >
        <span
          className={computeSelectValueClasses()}
          data-slot="select-value"
        >
          {chosen?.label ?? props.emptyLabel ?? ''}
        </span>
        <ChevronDownGlyph className={computeSelectIconClasses()} />
      </button>
      <input
        name={props.name}
        value={props.value}
        onChange={keepValue}
        tabIndex={-1}
        aria-hidden="true"
        style={HIDDEN_INPUT}
        {...(props.inputRef === undefined ? {} : { ref: props.inputRef })}
        {...(props.required === true && { required: true })}
        {...(props.disabled === true && { disabled: true })}
      />
    </>
  )
}

/**
 * The box the Select sits in. Base UI's value input is a sibling of the
 * trigger, visually hidden; here it is laid over the trigger at the trigger's
 * size (still clipped to nothing, still out of reach of the pointer and the
 * tab order), so the field's named control occupies the field's place — where
 * the browser anchors a validation message, and what a reader measuring the
 * control by its name finds.
 */
const HOLDER_CLASSES = 'relative block w-full [&>input]:inset-0 [&>input]:m-0! [&>input]:size-full!'

/** The choice field — see the module note. */
export function ChoiceSelect(props: ChoiceSelectProps): ReactElement {
  const { emptyLabel, options } = props
  const items = useMemo<readonly ChoiceItem[]>(
    () => (emptyLabel === undefined ? options : [{ value: null, label: emptyLabel }, ...options]),
    [emptyLabel, options]
  )
  const trigger = triggerAttributes(props)
  const List = useLoadedList()
  return (
    <span className={HOLDER_CLASSES}>
      {List === undefined ? (
        <StandIn
          props={props}
          items={items}
          trigger={trigger}
        />
      ) : (
        <List
          {...props}
          items={items}
          trigger={trigger}
        />
      )}
    </span>
  )
}
