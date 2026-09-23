/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The whole of the shell's rendering, which is four functions.
 *
 * Vanilla, deliberately. The shell's UI is a handful of states with no shared
 * data model; a framework would add a bundle, a build step and a second
 * rendering idiom to a repository that already has one in `src/`.
 *
 * **Nothing here writes `innerHTML`, and nothing ever should.** Text reaches the
 * DOM through `textContent` only. Two of the strings this UI renders do not
 * come from the shell — the engine's log output, and an error message the
 * engine wrote — and `textContent` is what makes the difference between showing
 * them and executing them. The window's CSP forbids inline script, so an
 * injection here would be blocked; that is a second line, not a reason to
 * relax the first.
 */

type Child = Node | string | null | undefined | false

interface Attributes {
  readonly class?: string
  readonly id?: string
  readonly type?: string
  readonly href?: string
  /**
   * Rendered as the `for` attribute.
   *
   * Spelled `for` rather than `htmlFor` because this builder sets ATTRIBUTES,
   * not DOM properties — `setAttribute('htmlFor', …)` would produce an inert
   * `htmlfor=""` and a label that looks correct and clicks through to nothing.
   */
  readonly for?: string
  readonly title?: string
  readonly role?: string
  readonly disabled?: boolean
  readonly checked?: boolean
  readonly value?: string
  readonly placeholder?: string
  readonly min?: string
  readonly max?: string
  readonly rows?: string
  readonly readonly?: boolean
  readonly hidden?: boolean
  readonly 'aria-label'?: string
  readonly 'aria-live'?: string
  readonly 'aria-pressed'?: string
  readonly 'data-state'?: string
  readonly 'data-testid'?: string
  readonly onClick?: (event: MouseEvent) => void
  readonly onChange?: (event: Event) => void
  readonly onInput?: (event: Event) => void
}

const BOOLEAN_PROPS = new Set(['disabled', 'checked', 'readonly', 'hidden'])

/** Build an element. Attributes that are `undefined` are skipped. */
export const h = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attributes = {},
  ...children: readonly Child[]
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag)
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue
    if (key === 'onClick') {
      node.addEventListener('click', value as EventListener)
    } else if (key === 'onChange') {
      node.addEventListener('change', value as EventListener)
    } else if (key === 'onInput') {
      node.addEventListener('input', value as EventListener)
    } else if (BOOLEAN_PROPS.has(key)) {
      node.setAttribute(key, '')
    } else {
      node.setAttribute(key, String(value))
    }
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue
    node.append(typeof child === 'string' ? document.createTextNode(child) : child)
  }
  return node
}

/** Replace a container's children in one step. */
export const render = (root: HTMLElement, ...children: readonly Child[]): void => {
  root.replaceChildren(
    ...children
      .filter(
        (child): child is Node | string => child !== null && child !== undefined && child !== false
      )
      .map((child) => (typeof child === 'string' ? document.createTextNode(child) : child))
  )
}

/** Find an element that must exist, and say which one when it does not. */
export const mustFind = <T extends HTMLElement>(selector: string): T => {
  const node = document.querySelector<T>(selector)
  if (node === null) {
    throw new Error(`The shell's markup is missing ${selector}.`)
  }
  return node
}

/**
 * Copy text to the clipboard, reporting whether it worked.
 *
 * The webview may refuse (no permission, no focus), and a "Copied" label that
 * appears when nothing was copied is worse than no label — the user pastes
 * whatever was there before into their AI client's config and debugs the wrong
 * thing.
 */
export const copyText = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
