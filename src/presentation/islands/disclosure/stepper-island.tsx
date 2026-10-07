/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `stepper` enhancement island — renders NOTHING.
 *
 * Every step body is already in the document (`stepper-component.tsx`); this
 * wires the movement onto that markup by host id, in the `split-pane` mould,
 * so a form or island inside a step is never re-rendered and keeps what the
 * reader typed.
 *
 * - Continue leaves a step only once every control inside it passes its own
 *   constraint validation (`linear`, the default). The controls that fail are
 *   marked `aria-invalid` and the first one takes focus.
 * - Skip appears on an `optional` step and moves on without validating.
 * - The current step lives in the address as `?step=<id>`, pushed per move, so a
 *   reload lands on it and the back button walks the steps.
 * - Arriving on a step puts focus on its heading, which is what tells a screen
 *   reader the step changed.
 * - The finish button is an ordinary action button; it is held back while the
 *   last step is invalid, and otherwise left to run its own action.
 */

import { useEffect } from 'react'

interface StepperIslandProps {
  readonly hostId: string
  readonly linear?: boolean
}

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement

const all = <T extends Element = HTMLElement>(root: ParentNode, selector: string): T[] =>
  Array.from(root.querySelectorAll<T>(selector))

/** Mark every control of a panel by its validity; `true` when all pass. */
function validatePanel(panel: HTMLElement): boolean {
  const controls = all<Control>(panel, 'input, select, textarea').filter(
    (control) => !control.disabled && control.type !== 'hidden'
  )
  const invalid = controls.filter((control) => !control.checkValidity())
  controls.forEach((control) =>
    control.setAttribute('aria-invalid', invalid.includes(control) ? 'true' : 'false')
  )
  invalid[0]?.focus()
  return invalid.length === 0
}

/** The step index the address names, or the first step. */
function addressedIndex(ids: readonly string[]): number {
  const step = new URLSearchParams(globalThis.location.search).get('step')
  const index = step === null ? -1 : ids.indexOf(step)
  return index === -1 ? 0 : index
}

/** The stepper's server-rendered pieces, found once per mount. */
interface StepperParts {
  readonly panels: readonly HTMLElement[]
  readonly items: readonly HTMLElement[]
  readonly ids: readonly string[]
  readonly back: HTMLElement | null
  readonly skip: HTMLElement | null
  readonly next: HTMLElement | null
  readonly finish: HTMLElement | null
  readonly count: HTMLElement | null
  readonly bar: HTMLElement | null
}

function findParts(root: HTMLElement): StepperParts {
  const panels = all(root, '[data-stepper-panel]')
  const find = (name: string): HTMLElement | null =>
    root.querySelector<HTMLElement>(`[data-stepper-${name}]`)
  return {
    panels,
    items: all(root, '[data-stepper-step]'),
    ids: panels.map((panel) => panel.dataset['stepperPanel'] ?? ''),
    back: find('back'),
    skip: find('skip'),
    next: find('next'),
    finish: find('finish'),
    count: find('count'),
    bar: find('bar'),
  }
}

const stateOf = (i: number, index: number): string =>
  i < index ? 'done' : i === index ? 'current' : 'todo'

/** Paint step `index` as current: the panel shown, the rail marked, the footer fitted. */
function paint(parts: StepperParts, index: number): void {
  const last = parts.panels.length - 1
  parts.panels.forEach((panel, i) => panel.toggleAttribute('hidden', i !== index))
  parts.items.forEach((item, i) => {
    item.setAttribute('data-state', stateOf(i, index))
    if (i === index) item.setAttribute('aria-current', 'step')
    else item.removeAttribute('aria-current')
  })
  const optional = parts.panels[index]?.dataset['optional'] === 'true'
  parts.back?.toggleAttribute('hidden', index === 0)
  parts.skip?.toggleAttribute('hidden', !optional || index === last)
  parts.next?.toggleAttribute('hidden', index === last)
  parts.finish?.toggleAttribute('hidden', index !== last)
  parts.count?.replaceChildren(`Step ${index + 1} of ${parts.panels.length}`)
  parts.bar?.style.setProperty('width', `${Math.round(((index + 1) / parts.panels.length) * 100)}%`)
}

/** Show step `index` and move focus to its heading. */
function show(parts: StepperParts, index: number): void {
  paint(parts, index)
  parts.panels[index]?.querySelector<HTMLElement>('[data-stepper-heading]')?.focus()
}

/** Record step `index` in the address as `?step=<id>`. */
function pushStep(parts: StepperParts, index: number): void {
  const url = new URL(globalThis.location.href)
  url.searchParams.set('step', parts.ids[index] ?? '')
  globalThis.history.pushState(globalThis.history.state, '', url)
}

/** Wire the stepper rooted at `root`; returns the cleanup. */
function wireStepper(root: HTMLElement, linear: boolean): () => void {
  const parts = findParts(root)
  const state = { current: addressedIndex(parts.ids) }
  const go = (index: number): void => {
    if (index < 0 || index >= parts.panels.length) return
    state.current = index
    show(parts, index)
    pushStep(parts, index)
  }
  const currentIsValid = (): boolean => {
    const panel = parts.panels[state.current]
    return !linear || panel === undefined || validatePanel(panel)
  }
  const listeners: ReadonlyArray<readonly [EventTarget | null, string, (event: Event) => void]> = [
    [parts.next, 'click', () => currentIsValid() && go(state.current + 1)],
    [parts.back, 'click', () => go(state.current - 1)],
    [parts.skip, 'click', () => go(state.current + 1)],
    [
      parts.finish,
      'click',
      (event) => {
        if (currentIsValid()) return
        event.preventDefault()
        event.stopImmediatePropagation()
      },
    ],
    [
      root,
      'click',
      (event) => {
        const target = (event.target as Element | null)?.closest<HTMLElement>('[data-stepper-goto]')
        const index = target ? parts.ids.indexOf(target.dataset['stepperGoto'] ?? '') : -1
        if (index !== -1) go(index)
      },
    ],
    [
      globalThis,
      'popstate',
      () => {
        state.current = addressedIndex(parts.ids)
        show(parts, state.current)
      },
    ],
  ]
  listeners.forEach(([target, type, listener]) => target?.addEventListener(type, listener))
  show(parts, state.current)
  return () =>
    listeners.forEach(([target, type, listener]) => target?.removeEventListener(type, listener))
}

/** Stepper island — renders nothing; drives the server-rendered steps in place. */
export default function StepperIsland({ hostId, linear }: StepperIslandProps): null {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(`[data-stepper="${CSS.escape(hostId)}"]`)
    return root === null ? undefined : wireStepper(root, linear !== false)
  }, [hostId, linear])
  return null
}
