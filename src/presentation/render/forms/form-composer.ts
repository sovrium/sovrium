/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A `formRef` form drawn as a COMPOSER (`presentation: composer`): the box at
 * the foot of a conversation.
 *
 * The form is the referenced `forms[]` entry, drawn and submitted exactly as an
 * embedded form is — same fields, same inline runtime, same pipeline. The
 * composer adds a presentation and five behaviours on top, in a small runtime
 * of its own that runs once beside the form:
 *
 *   - the form's first text field becomes the box, its label kept for
 *     assistive technology, the send button inside it; Enter sends and
 *     Shift+Enter is the line break a textarea already gives;
 *   - the form's other visible fields sit behind an Attach button;
 *   - a send draws the turn in the `appendTo` frame at once (from the
 *     `<template>` drawn here with the frame's own class recipes); a refusal
 *     withdraws it, the text kept and the error shown in the composer; a
 *     success marks it sent and leaves it to the frame, whose next redraw
 *     replaces it with the stored record;
 *   - with `gif`, a GIF button opens a picker whose search goes through the
 *     server's GIF route, so the operator's key never reaches the page.
 *   - typing raises `sovrium:typing` (at most every two seconds, and a stop on
 *     send), which the page's app connection relays to the conversation's
 *     other readers under `auth.presence.typing`.
 *
 * Without its own `onSuccess`, a composer resets after a send rather than
 * raising a toast per message; without its own `onError`, it shows the error
 * inside the composer.
 */

import { serializeJsonForScript } from '@/domain/kernel/sanitize/json-script-serialization'
import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'
import { computeBubbleClasses } from '@/presentation/design/bubble-default-classes'
import {
  computeMessageClasses,
  computeMessageContentClasses,
} from '@/presentation/design/message-default-classes'
import { resolveDocumentLang } from './form-document-lang'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'

/** The composer keys of a placed form, as the schema decoded them. */
interface ComposerKeys {
  readonly presentation?: unknown
  readonly appendTo?: unknown
  readonly gif?: { readonly connection?: unknown; readonly field?: unknown }
}

/** True when the placed form is drawn as a composer. */
export const isComposer = (component: unknown): boolean =>
  (component as ComposerKeys | null | undefined)?.presentation === 'composer'

/**
 * The form a composer submits: the referenced form, resetting after a send
 * and showing a refusal in place when it declares neither itself.
 */
export function composerForm(form: Readonly<Form>, component: unknown): Readonly<Form> {
  if (!isComposer(component)) return form
  return {
    ...form,
    onSuccess: form.onSuccess ?? { type: 'reset' },
    onError: form.onError ?? { type: 'message' },
  } as Readonly<Form>
}

/** The classes the composer runtime sets on what it builds, read by the CSS corpus here. */
const COMPOSER_CLASSES = {
  root: 'flex w-full flex-col gap-2',
  box: 'flex w-full items-end gap-2 rounded-xl border border-input bg-background p-2',
  field: 'min-w-0 flex-1',
  input:
    'max-h-48 min-h-9 w-full resize-none border-0 bg-transparent px-1 py-1.5 text-sm outline-none',
  tool: 'inline-flex h-8 shrink-0 items-center justify-center rounded-lg px-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground',
  panel: 'flex flex-col gap-3 rounded-xl border border-input bg-background p-3',
  results: 'grid grid-cols-3 gap-2',
  result: 'overflow-hidden rounded-md border border-input hover:ring-2 hover:ring-ring',
  error: 'text-sm text-destructive',
} as const

/** The turn a send draws at once: the frame's own anatomy, on the reader's side. */
const pendingTurnHtml = (): string =>
  `<template data-composer-turn><div data-composer-pending="" data-slot="message" data-align="end" class="${computeMessageClasses()}"><div data-slot="message-content" class="${computeMessageContentClasses()}"><div data-slot="bubble" data-align="end" class="${computeBubbleClasses({ align: 'end' })}" data-composer-text=""></div></div></div></template>`

/** What the composer runtime reads beside the form. */
function composerConfig(app: Readonly<App>, component: unknown, activeLang: string | undefined) {
  const keys = component as ComposerKeys
  const lang = resolveDocumentLang(app.languages, activeLang)
  const word = (key: string) => resolveInterpreterString(key, lang, app.languages)
  const { gif } = keys
  return {
    appendTo: typeof keys.appendTo === 'string' ? keys.appendTo : undefined,
    gif:
      typeof gif?.connection === 'string' && typeof gif.field === 'string'
        ? {
            search: `/api/connections/${encodeURIComponent(gif.connection)}/gif-search`,
            field: gif.field,
          }
        : undefined,
    words: {
      attach: word('composer.attach'),
      gif: word('composer.gif'),
      gifSearch: word('composer.gifSearch'),
      gifFailed: word('composer.gifFailed'),
    },
    classes: COMPOSER_CLASSES,
  }
}

/* eslint-disable functional/immutable-data, functional/no-let, no-param-reassign, max-lines-per-function, max-statements, complexity -- an inline DOM runtime, stringified into the page: it mutates the markup it enhances, as every form runtime fragment does */
/**
 * The composer runtime, run once beside its form. Self-contained: it is sent to
 * the browser as its own source (`String(composerRuntime)`), so it reads
 * nothing outside its body.
 */
export function composerRuntime(): void {
  const self = document.currentScript
  const root = self?.closest('[data-composer]')
  if (!root || root.hasAttribute('data-composer-ready')) return
  root.setAttribute('data-composer-ready', '')
  const configEl = root.querySelector('script[data-composer-config]')
  const form = root.querySelector('form')
  if (!configEl || !form) return
  const config = JSON.parse(configEl.textContent || '{}')
  const C = config.classes
  const W = config.words
  const fields = Array.from(form.querySelectorAll<HTMLElement>(':scope > .form-field'))
  const main = fields.find((f) => f.querySelector('textarea, input[type="text"]') !== null)
  const input = main?.querySelector<HTMLTextAreaElement>('textarea, input[type="text"]')
  if (!main || !input) return
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')
  const box = document.createElement('div')
  box.setAttribute('data-composer-box', '')
  box.className = C.box
  main.parentNode?.insertBefore(box, main)
  main.className = C.field
  main.querySelector('label')?.classList.add('sr-only')
  input.className = C.input
  input.setAttribute('rows', '1')
  box.appendChild(main)
  const tool = (label: string): HTMLButtonElement => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = C.tool
    button.textContent = label
    button.setAttribute('aria-expanded', 'false')
    box.insertBefore(button, submit && submit.parentNode === box ? submit : null)
    return button
  }
  const panel = (): HTMLDivElement => {
    const div = document.createElement('div')
    div.className = C.panel
    div.hidden = true
    form.insertBefore(div, box.nextSibling)
    return div
  }
  const toggle = (button: HTMLButtonElement, area: HTMLElement): void => {
    button.addEventListener('click', () => {
      area.hidden = !area.hidden
      button.setAttribute('aria-expanded', String(!area.hidden))
    })
  }
  if (submit) {
    submit.classList.remove('mt-2', 'w-full')
    box.appendChild(submit)
  }
  const extras = fields.filter((f) => f !== main)
  if (extras.length > 0) {
    const attachments = panel()
    attachments.setAttribute('data-composer-attachments', '')
    extras.forEach((f) => attachments.appendChild(f))
    toggle(tool(W.attach), attachments)
  }
  let gifInput: HTMLInputElement | null = null
  if (config.gif) {
    const picker = panel()
    picker.setAttribute('data-composer-gif', '')
    const search = document.createElement('input')
    search.type = 'search'
    search.setAttribute('aria-label', W.gifSearch)
    search.className = 'h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm'
    const alert = document.createElement('div')
    alert.className = C.error
    alert.hidden = true
    const results = document.createElement('div')
    results.className = C.results
    picker.append(search, alert, results)
    toggle(tool(W.gif), picker)
    let timer = 0
    let asked = 0
    const pick = (address: string): void => {
      if (!gifInput) {
        gifInput = document.createElement('input')
        gifInput.type = 'hidden'
        gifInput.name = config.gif.field
        form.appendChild(gifInput)
      }
      gifInput.value = new URL(address, window.location.origin).href
      picker.hidden = true
      form.requestSubmit(submit ?? undefined)
    }
    const show = (list: ReadonlyArray<Record<string, string>>): void => {
      results.replaceChildren(
        ...list.map((gif) => {
          const button = document.createElement('button')
          button.type = 'button'
          button.className = C.result
          button.setAttribute('aria-label', gif['title'] || gif['id'] || 'GIF')
          const img = document.createElement('img')
          img.src = gif['previewUrl'] || ''
          img.alt = ''
          img.loading = 'lazy'
          img.className = 'h-24 w-full object-cover'
          button.appendChild(img)
          button.addEventListener('click', () => pick(gif['url'] || ''))
          return button
        })
      )
    }
    const failed = (): void => {
      results.replaceChildren()
      alert.textContent = W.gifFailed
      alert.setAttribute('role', 'alert')
      alert.hidden = false
    }
    search.addEventListener('input', () => {
      window.clearTimeout(timer)
      const words = search.value.trim()
      timer = window.setTimeout(() => {
        if (words === '') return results.replaceChildren()
        const mine = ++asked
        alert.hidden = true
        alert.removeAttribute('role')
        fetch(`${config.gif.search}?q=${encodeURIComponent(words)}`, {
          headers: { Accept: 'application/json' },
          credentials: 'same-origin',
        })
          .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
          .then((body: { readonly results?: ReadonlyArray<Record<string, string>> }) => {
            if (mine === asked) show(body.results ?? [])
          })
          .catch(() => {
            if (mine === asked) failed()
          })
      }, 300)
    })
  }
  const grow = (): void => {
    input.style.height = 'auto'
    input.style.height = `${String(Math.min(input.scrollHeight, 192))}px`
  }
  input.addEventListener('input', grow)
  // Who is typing: the page's app connection relays it to the conversation's other
  // readers. Said at most every two seconds while she types, as the server re-sends it.
  let typedAt = 0
  const signalTyping = (typing: boolean): void => {
    document.dispatchEvent(new CustomEvent('sovrium:typing', { detail: { typing } }))
  }
  input.addEventListener('input', () => {
    const now = Date.now()
    if (input.value.trim() === '' || now - typedAt < 2000) return
    typedAt = now
    signalTyping(true)
  })
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return
    event.preventDefault()
    form.requestSubmit(submit ?? undefined)
  })
  let pending: Element | null = null
  const settle = (): void => {
    if (gifInput) gifInput.value = ''
    grow()
  }
  form.addEventListener('sovrium:form-sending', () => {
    typedAt = 0
    signalTyping(false)
    const text = input.value.trim()
    const frame = config.appendTo ? document.getElementById(config.appendTo) : null
    const template = root.querySelector<HTMLTemplateElement>('template[data-composer-turn]')
    const turn = template?.content.firstElementChild?.cloneNode(true) as Element | undefined
    if (!frame || !turn || text === '') return
    const slot = turn.querySelector('[data-composer-text]')
    if (slot) slot.textContent = input.value
    frame.insertBefore(turn, frame.querySelector(':scope > [data-island]'))
    pending = turn
  })
  form.addEventListener('sovrium:form-refused', () => {
    pending?.remove()
    pending = null
    settle()
  })
  form.addEventListener('sovrium:crud-success', () => {
    // Sent: the frame's next redraw replaces it with the stored record. Marked
    // rather than removed, so the message never blinks out before that redraw.
    pending?.removeAttribute('data-composer-pending')
    pending?.setAttribute('data-composer-sent', '')
    pending = null
    settle()
  })
}
/* eslint-enable functional/immutable-data, functional/no-let, no-param-reassign, max-lines-per-function, max-statements, complexity -- the inline runtime ends here */

/** The runtime's source, sent once per composer. */
const COMPOSER_RUNTIME_SCRIPT = `(${String(composerRuntime)})()`

/**
 * The composer around an embedded form's markup: the form, the turn a send
 * draws at once, the runtime's configuration and the runtime. The form's
 * markup is kept untouched when the placed form is not a composer.
 */
export function composerWrapper(
  app: Readonly<App>,
  component: unknown,
  activeLang: string | undefined
): (formHtml: string) => string {
  if (!isComposer(component)) return (formHtml) => formHtml
  const config = serializeJsonForScript(composerConfig(app, component, activeLang))
  return (formHtml) =>
    `<div data-composer="" class="${COMPOSER_CLASSES.root}">${formHtml}${pendingTurnHtml()}<script type="application/json" data-composer-config="true">${config}</script><script>${COMPOSER_RUNTIME_SCRIPT}</script></div>`
}
