/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { installPageRuntime } from './browser-page-runtime'

/**
 * The input half of the page script ([internal ref] D6): what a step does to the
 * element `window.__sovrium` last resolved — clear and mark a field, choose an
 * option, set a box, attach files through `DataTransfer` — and the covers a
 * screenshot paints over sensitive fields.
 *
 * Like {@link installPageRuntime}, it is sent to the page as its own source,
 * so it references nothing outside its body; it adds its methods to the object
 * the finding half installed.
 */

/* eslint-disable max-lines-per-function, sovrium/no-double-assertion, unicorn/consistent-function-scoping -- runs in the page, sent as its own source: one self-contained imperative script reading the global the finding half installed */
/** Add the input methods to `window.__sovrium`. Self-contained: sent to the page as its own source. */
export function installPageInputs(): void {
  const core = (window as unknown as Record<string, unknown>)['__sovrium'] as Record<
    string,
    unknown
  >
  if (core['clearTarget'] !== undefined) return
  const target = core['target'] as () => HTMLElement
  const norm = core['norm'] as (s: string | null | undefined) => string
  const documents = core['documents'] as () => {
    docs: { doc: Document; x: number; y: number }[]
  }
  const fire = (el: Element, type: string): void => {
    el.dispatchEvent(new Event(type, { bubbles: true }))
  }
  Object.assign(core, {
    clearTarget: (sensitive: boolean): string => {
      const el = target() as HTMLInputElement
      if (sensitive) el.setAttribute('data-sovrium-sensitive', '1')
      el.focus()
      if ('value' in el && el.value !== '') {
        el.value = ''
        fire(el, 'input')
      }
      return el.tagName
    },
    focusTarget: (): boolean => {
      target().focus()
      return true
    },
    selectOption: (option: string): { ok: boolean; options: string[] } => {
      const el = target() as HTMLSelectElement
      const options = Array.from(el.options ?? [])
      const wanted = norm(option)
      const found =
        options.find((o) => norm(o.text) === wanted) ??
        options.find((o) => norm(o.text).toLowerCase() === wanted.toLowerCase()) ??
        options.find((o) => o.value === option)
      if (found === undefined) return { ok: false, options: options.map((o) => norm(o.text)) }
      el.value = found.value
      fire(el, 'input')
      fire(el, 'change')
      return { ok: true, options: [] }
    },
    isChecked: (): boolean => (target() as HTMLInputElement).checked === true,
    setChecked: (checked: boolean): boolean => {
      const el = target() as HTMLInputElement
      el.checked = checked
      fire(el, 'input')
      fire(el, 'change')
      return el.checked
    },
    attachFiles: (files: { name: string; type: string; data: string }[]): number => {
      const el = target() as HTMLInputElement
      const transfer = new DataTransfer()
      for (const file of files) {
        const binary = atob(file.data)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
        transfer.items.add(new File([bytes], file.name, { type: file.type }))
      }
      el.files = transfer.files
      fire(el, 'input')
      fire(el, 'change')
      return el.files?.length ?? 0
    },
    /** Cover every field holding a sensitive value; answers how many were covered. */
    mask: (): number => {
      let count = 0
      for (const { doc, x, y } of documents().docs) {
        for (const el of Array.from(doc.querySelectorAll('[data-sovrium-sensitive]'))) {
          const rect = el.getBoundingClientRect()
          const cover = document.createElement('div')
          cover.setAttribute('data-sovrium-mask', '1')
          cover.style.cssText = `position:fixed;left:${String(x + rect.left)}px;top:${String(y + rect.top)}px;width:${String(rect.width)}px;height:${String(rect.height)}px;background:#1f2933;z-index:2147483647;pointer-events:none`
          document.documentElement.appendChild(cover)
          count += 1
        }
      }
      return count
    },
    unmask: (): boolean => {
      for (const cover of Array.from(document.querySelectorAll('[data-sovrium-mask]')))
        cover.remove()
      return true
    },
  })
}
/* eslint-enable max-lines-per-function, sovrium/no-double-assertion, unicorn/consistent-function-scoping -- end of the page script */

/** The page-side call `method(...args)`, installing the page script first when the document lacks it. */
export const pageCall = (method: string, ...args: readonly unknown[]): string =>
  `(() => { (${String(installPageRuntime)})(); (${String(installPageInputs)})(); return window.__sovrium.${method}(${args
    .map((arg) => JSON.stringify(arg ?? null))
    .join(', ')}) })()`
