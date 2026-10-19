/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeDropdownMenuContentClasses,
  computeDropdownMenuRadioIndicatorClasses,
  computeDropdownMenuRadioItemClasses,
} from '@/presentation/design/dropdown-menu-default-classes'
import {
  choicesOf,
  currentValuesOf,
  isUnreadList,
  pickedInOptionOrder,
} from './edit-select-choices'

/**
 * The menu a page `button` drawn on a record opens when it carries an
 * `editSelect`: base-nova's dropdown anatomy, drawn without React because the
 * button is server-rendered and may sit in a region that re-reads itself — a
 * delegated press (`client-event-delegate.ts`) reaches the button in the new
 * markup, where an island would have pinned the region in place.
 *
 * What it offers and commits is read by `edit-select-choices.ts`, as the table
 * row action's submenu reads it: radio items for one value, the record's value
 * checked, picking commits; with `multiple`, check items preset to the record's
 * list and a last item that commits the ticked list in option order.
 */

/** The picker a button carries, as the renderer serialised it (`button-edit-select.ts`). */
interface EditSelectPicker {
  readonly field: string
  readonly label: string
  readonly options: readonly { readonly value: string; readonly label?: string }[]
  readonly multiple?: boolean
  readonly saveLabel: string
  readonly current: unknown
}

/** Read a button's picker, or `undefined` when it carries none. */
export function parseEditSelectPicker(raw: string | null): EditSelectPicker | undefined {
  if (raw === null) return undefined
  try {
    const parsed = JSON.parse(raw) as EditSelectPicker | null
    return typeof parsed?.field === 'string' ? parsed : undefined
  } catch {
    return undefined
  }
}

const MENU_ATTR = 'data-edit-select-menu'
const ITEMS = '[role^="menuitem"]'

/** lucide's `check`, the mark a chosen row shows. */
const CHECK_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="size-4"><path d="M20 6 9 17l-5-5"/></svg>'

/** The button each open menu belongs to. */
const owners = new WeakMap<Element, HTMLElement>()

/** Close whichever picker is open, handing the focus back to its button when asked. */
function closeOpenPicker(refocus: boolean): void {
  const open = document.querySelector<HTMLElement>(`[${MENU_ATTR}]`)
  if (open === null) return
  const owner = owners.get(open)
  open.remove()
  owner?.setAttribute('aria-expanded', 'false')
  if (refocus) owner?.focus()
}

/** One row: its role, its checked state, and the mark shown while checked. */
function menuRow(role: string, text: string, checked?: boolean): HTMLElement {
  const row = document.createElement('div')
  row.setAttribute('role', role)
  row.tabIndex = -1
  row.className = computeDropdownMenuRadioItemClasses()
  row.textContent = text
  if (checked === undefined) return row
  row.setAttribute('aria-checked', String(checked))
  const mark = document.createElement('span')
  mark.className = computeDropdownMenuRadioIndicatorClasses()
  mark.innerHTML = CHECK_SVG
  mark.hidden = !checked
  row.append(mark)
  return row
}

/** Tick or untick a check row. */
function toggleRow(row: HTMLElement): void {
  const checked = row.getAttribute('aria-checked') !== 'true'
  row.setAttribute('aria-checked', String(checked))
  const mark = row.querySelector('span')
  if (mark !== null) mark.hidden = !checked
}

/** The rows of a picker, and what activating each one does. */
function buildRows(
  picker: EditSelectPicker,
  commit: (value: string | readonly string[]) => void
): { readonly rows: readonly Node[]; readonly activate: (row: HTMLElement) => void } {
  const choices = choicesOf(picker)
  const current = currentValuesOf(picker.current)
  const multiple = picker.multiple === true
  const optionRows = choices.map((choice) => {
    const row = menuRow(
      multiple ? 'menuitemcheckbox' : 'menuitemradio',
      choice.label,
      current.includes(choice.value)
    )
    row.dataset['value'] = choice.value
    return row
  })
  // The commit row sits under the options, past base-nova's separator.
  const separator = document.createElement('div')
  separator.setAttribute('role', 'separator')
  separator.className = '-mx-1 my-1 h-px bg-border'
  const save = multiple ? [separator, menuRow('menuitem', picker.saveLabel)] : []
  const ticked = () =>
    optionRows.flatMap((row) =>
      row.getAttribute('aria-checked') === 'true' ? [row.dataset['value'] ?? ''] : []
    )
  const activate = (row: HTMLElement) => {
    if (row.getAttribute('role') === 'menuitemcheckbox') return toggleRow(row)
    closeOpenPicker(true)
    commit(multiple ? pickedInOptionOrder(choices, ticked()) : (row.dataset['value'] ?? ''))
  }
  return { rows: [...optionRows, ...save], activate }
}

/** The row a key moves the focus to, from the focused one, among `rows`. */
const KEY_MOVES: Readonly<Record<string, (at: number, count: number) => number>> = {
  ArrowDown: (at, count) => (at + 1) % count,
  ArrowUp: (at, count) => (at - 1 + count) % count,
  Home: () => 0,
  End: (_at, count) => count - 1,
}

/** Move the focus among the rows from the keyboard; Escape and Tab close the menu. */
function onMenuKey(event: KeyboardEvent, menu: HTMLElement, activate: (row: HTMLElement) => void) {
  const rows = Array.from(menu.querySelectorAll<HTMLElement>(ITEMS))
  const at = rows.indexOf(document.activeElement as HTMLElement)
  const move = KEY_MOVES[event.key]
  const focused = rows[at]
  if (move !== undefined) rows[move(at, rows.length)]?.focus()
  else if ((event.key === 'Enter' || event.key === ' ') && focused) activate(focused)
  else if (event.key === 'Escape' || event.key === 'Tab') closeOpenPicker(event.key === 'Escape')
  else return
  event.preventDefault()
}

/** Close the open picker on a press anywhere outside it and its button. */
function closeOnOutsidePress(button: HTMLElement, menu: HTMLElement): void {
  const onPress = (event: PointerEvent) => {
    const target = event.target as Node
    if (menu.contains(target) || button.contains(target)) return
    closeOpenPicker(false)
  }
  document.addEventListener('pointerdown', onPress, true)
  const watch = new MutationObserver(() => {
    if (menu.isConnected) return
    document.removeEventListener('pointerdown', onPress, true)
    watch.disconnect()
  })
  watch.observe(document.body, { childList: true })
}

/**
 * Open `button`'s picker below it — or close it, when it is the one open — and
 * call `commit` with the pick: one value, or with `multiple` the ticked list.
 *
 * A list the record does not carry (the server could not read it) opens no
 * menu: saving from it would replace values nobody could see.
 */
export function togglePickerMenu(
  button: HTMLButtonElement,
  picker: EditSelectPicker,
  commit: (value: string | readonly string[]) => void
): void {
  const wasOpen = button.getAttribute('aria-expanded') === 'true'
  closeOpenPicker(false)
  if (wasOpen || isUnreadList(picker, picker.current)) return
  const menu = document.createElement('div')
  menu.setAttribute('role', 'menu')
  menu.setAttribute('aria-label', picker.label)
  menu.setAttribute(MENU_ATTR, '')
  owners.set(menu, button)
  menu.className = computeDropdownMenuContentClasses()
  const { rows, activate } = buildRows(picker, commit)
  menu.append(...rows)
  menu.addEventListener('click', (event) => {
    const row = (event.target as Element).closest<HTMLElement>(ITEMS)
    if (row !== null) activate(row)
  })
  menu.addEventListener('keydown', (event) => onMenuKey(event, menu, activate))
  const anchor = button.getBoundingClientRect()
  Object.assign(menu.style, {
    position: 'fixed',
    top: `${anchor.bottom + 4}px`,
    left: `${anchor.left}px`,
  })
  document.body.append(menu)
  button.setAttribute('aria-expanded', 'true')
  closeOnOutsidePress(button, menu)
  ;(
    menu.querySelector<HTMLElement>('[aria-checked="true"]') ??
    menu.querySelector<HTMLElement>(ITEMS)
  )?.focus()
}
