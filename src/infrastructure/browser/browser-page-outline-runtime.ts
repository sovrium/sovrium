/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { installPageInputs } from './browser-page-inputs-runtime'
import { installPageRuntime } from './browser-page-runtime'

/**
 * The reading half of the page script a model needs ([internal ref], the browser
 * agent and self-healing): an outline of what the page offers.
 *
 * The outline names every control by the role and accessible name a
 * `browser/run` locator uses, so what a model answers is a locator the driver
 * can resolve. A field holding a sensitive value — one typed from `$env` or a
 * credential, marked by the input half — or a password shows `***`, never
 * its value.
 *
 * Like {@link installPageRuntime}, it is sent to the page as its own source,
 * so it references nothing outside its body.
 */

/* eslint-disable sonarjs/cognitive-complexity, max-lines-per-function, complexity, max-statements, sovrium/no-double-assertion, unicorn/consistent-function-scoping, no-restricted-syntax -- runs in the page, sent as its own source: one self-contained imperative script reading the global the finding half installed */
/** Add `outline` to `window.__sovrium`. Self-contained: sent as its own source. */
export function installPageOutline(): void {
  const core = (window as unknown as Record<string, unknown>)['__sovrium'] as Record<
    string,
    unknown
  >
  if (core['outline'] !== undefined) return
  const norm = core['norm'] as (s: string | null | undefined) => string
  const roleOf = core['roleOf'] as (el: Element) => string
  const nameOf = core['nameOf'] as (el: Element) => string
  const isVisible = core['isVisible'] as (el: Element) => boolean
  const CONTROLS = new Set([
    'button',
    'link',
    'textbox',
    'searchbox',
    'combobox',
    'listbox',
    'checkbox',
    'radio',
    'switch',
    'slider',
    'spinbutton',
    'tab',
    'menuitem',
    'option',
  ])
  const SKIPPED = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT', 'HEAD', 'SVG', 'IFRAME'])
  const INTERACTIVE =
    'a[href],button,input,select,textarea,[contenteditable],[role=button],[role=link],[role=checkbox],[role=tab],[role=menuitem]'
  const quoted = (s: string): string => `"${s.slice(0, 120)}"`
  const valueOf = (el: Element): string => {
    const input = el as HTMLInputElement
    const raw = 'value' in input ? String(input.value) : norm(el.textContent)
    if (raw === '') return ''
    const masked =
      el.hasAttribute('data-sovrium-sensitive') ||
      (el.getAttribute('type') ?? '').toLowerCase() === 'password'
    return ` = ${masked ? '***' : quoted(raw)}`
  }
  const controlLine = (el: Element, role: string): string => {
    const name = nameOf(el)
    const base = `${role}${name === '' ? '' : ` ${quoted(name)}`}`
    if (el.tagName === 'SELECT') {
      const select = el as HTMLSelectElement
      const options = Array.from(select.options)
        .slice(0, 30)
        .map((o) => norm(o.text))
      const chosen = select.selectedOptions[0]
      return `${base}${chosen === undefined ? '' : ` = ${quoted(norm(chosen.text))}`} (options: ${options.join(' | ')})`
    }
    if (role === 'checkbox' || role === 'radio' || role === 'switch') {
      return `${base} [${(el as HTMLInputElement).checked ? 'checked' : 'not checked'}]`
    }
    if (role === 'link') return `${base} -> ${(el as HTMLAnchorElement).href}`
    if (role === 'textbox' || role === 'searchbox' || role === 'spinbutton') {
      return `${base}${valueOf(el)}`
    }
    return base
  }
  const rowLine = (el: Element): string =>
    `row: ${Array.from(el.children)
      .map((cell) => norm(cell.textContent))
      .join(' | ')}`
  const lines: string[] = []
  const isFileField = (el: Element): boolean =>
    el.tagName === 'INPUT' && (el.getAttribute('type') ?? '').toLowerCase() === 'file'
  const visit = (el: Element): void => {
    if (isFileField(el)) {
      lines.push(`file field ${quoted(nameOf(el))}`)
      return
    }
    if (SKIPPED.has(el.tagName.toUpperCase()) || !isVisible(el)) return
    const role = roleOf(el)
    if (CONTROLS.has(role) || el.hasAttribute('contenteditable')) {
      lines.push(controlLine(el, role === '' ? 'textbox' : role))
      return
    }
    if (el.tagName === 'INPUT' && (el.getAttribute('type') ?? '').toLowerCase() === 'hidden') return
    if (role === 'heading' || role === 'img') {
      const name = nameOf(el)
      if (name !== '') lines.push(`${role} ${quoted(name)}`)
      return
    }
    if (el.tagName === 'LABEL' && (el as HTMLLabelElement).control !== null) return
    if (el.querySelector(INTERACTIVE) === null) {
      if (el.tagName === 'TR') {
        lines.push(rowLine(el))
        return
      }
      const text = norm((el as HTMLElement).innerText ?? el.textContent)
      if (text !== '') lines.push(`${role === 'status' ? 'status' : 'text'}: ${text.slice(0, 500)}`)
      return
    }
    for (const child of Array.from(el.children)) visit(child)
  }
  const outline = (maxChars: number): string => {
    lines.length = 0
    if (document.body !== null) visit(document.body)
    const text = lines.join('\n')
    return text.length > maxChars ? `${text.slice(0, maxChars)}\n… (the page goes on)` : text
  }
  Object.assign(core, { outline })
}
/* eslint-enable sonarjs/cognitive-complexity, max-lines-per-function, complexity, max-statements, sovrium/no-double-assertion, unicorn/consistent-function-scoping, no-restricted-syntax -- end of the page script */

/** The page-side call `method(...args)`, installing every half of the page script first. */
export const outlineCall = (method: string, ...args: readonly unknown[]): string =>
  `(() => { (${String(installPageRuntime)})(); (${String(installPageInputs)})(); (${String(installPageOutline)})(); return window.__sovrium.${method}(${args
    .map((arg) => JSON.stringify(arg ?? null))
    .join(', ')}) })()`
