/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The script a browser session injects into the page ([internal ref] D6): how a step
 * finds its element, reads it, and prepares it for a native input event.
 *
 * It is written as a TypeScript function so the compiler checks it, and sent
 * to the page as its own source (`String(installPageRuntime)`). It therefore
 * references NOTHING outside its own body — no import, no outer constant — and
 * installs one global, `window.__sovrium`, the first time it runs in a
 * document. Every later call reuses it until the page navigates.
 *
 * Finding an element follows what a person sees first:
 *
 * - `role` (+ `name`): the element's ARIA role, explicit or implied by its tag,
 *   and its accessible name (`aria-labelledby`, `aria-label`, the field's
 *   label, `alt`, its text, `title`). WebKit exposes no accessibility tree, so
 *   the role is computed here on both backends.
 * - `label`: the control a `<label>` names, or a field's `aria-label`.
 * - `text`: the innermost element whose text contains it.
 * - `placeholder`, `testId` (`data-testid`), `selector` (CSS).
 *
 * Text is compared case-insensitively as a substring, or exactly with
 * `exact`. Only visible elements match, except for a file field, which sites
 * often hide behind a styled button. Same-origin frames are searched too, their
 * offset added to the point; a frame from another origin cannot be read, and
 * is counted so the step can say why it found nothing.
 */

/** A locator as the page reads it. */
export interface PageQuery {
  readonly role?: string
  readonly name?: string
  readonly label?: string
  readonly text?: string
  readonly placeholder?: string
  readonly testId?: string
  readonly selector?: string
  readonly exact?: boolean
  readonly nth?: number
  /** Match hidden elements too (a file field). */
  readonly includeHidden?: boolean
}

/** What resolving a locator found. The matched element is kept as `window.__sovrium.target`. */
export interface PageMatch {
  readonly count: number
  /** Frames from another origin on the page, which no locator can search. */
  readonly crossOrigin: number
  /** The centre of the chosen element in viewport CSS pixels, and whether something covers it. */
  readonly point?: { readonly x: number; readonly y: number; readonly obscured: boolean }
  readonly tag?: string
  readonly type?: string
  readonly error?: string
}

/* eslint-disable sonarjs/cognitive-complexity, max-lines-per-function, complexity, max-statements, sovrium/no-double-assertion, unicorn/consistent-function-scoping, no-restricted-syntax -- runs in the page, sent as its own source: one self-contained imperative script (its helpers cannot move to module scope, `window` has no typed slot for the global it installs) */
/**
 * Install `window.__sovrium` in the current document. Self-contained: sent to
 * the page as its own source.
 */
export function installPageRuntime(): void {
  const w = window as unknown as Record<string, unknown>
  if (w['__sovrium'] !== undefined) return
  const norm = (s: string | null | undefined): string => (s ?? '').replace(/\s+/g, ' ').trim()
  const matches = (value: string, wanted: string, exact: boolean | undefined): boolean =>
    exact === true
      ? norm(value) === wanted
      : norm(value).toLowerCase().includes(wanted.toLowerCase())
  const SKIPPED = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT', 'HEAD', 'TITLE', 'META'])
  const INPUT_ROLES: Record<string, string> = {
    checkbox: 'checkbox',
    radio: 'radio',
    button: 'button',
    submit: 'button',
    reset: 'button',
    image: 'button',
    search: 'searchbox',
    range: 'slider',
    number: 'spinbutton',
    email: 'textbox',
    tel: 'textbox',
    text: 'textbox',
    url: 'textbox',
  }
  const TAG_ROLES: Record<string, string> = {
    BUTTON: 'button',
    TEXTAREA: 'textbox',
    H1: 'heading',
    H2: 'heading',
    H3: 'heading',
    H4: 'heading',
    H5: 'heading',
    H6: 'heading',
    IMG: 'img',
    TABLE: 'table',
    TR: 'row',
    TD: 'cell',
    TH: 'cell',
    UL: 'list',
    OL: 'list',
    LI: 'listitem',
    NAV: 'navigation',
    FORM: 'form',
    DIALOG: 'dialog',
    OPTION: 'option',
    OUTPUT: 'status',
    PROGRESS: 'progressbar',
    MAIN: 'main',
  }
  const roleOf = (el: Element): string => {
    const explicit = norm(el.getAttribute('role')).split(' ')[0]
    if (explicit !== undefined && explicit !== '') return explicit
    if (el.tagName === 'A') return el.hasAttribute('href') ? 'link' : ''
    if (el.tagName === 'SECTION') {
      const named = el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby')
      return named ? 'region' : ''
    }
    if (el.tagName === 'SELECT') {
      const select = el as HTMLSelectElement
      return select.multiple || select.size > 1 ? 'listbox' : 'combobox'
    }
    if (el.tagName === 'INPUT') {
      const input = el as HTMLInputElement
      const type = (input.getAttribute('type') ?? 'text').toLowerCase()
      if (type === 'switch') return 'switch'
      const role = INPUT_ROLES[type] ?? ''
      return role === 'textbox' && input.hasAttribute('list') ? 'combobox' : role
    }
    return TAG_ROLES[el.tagName] ?? ''
  }
  const byIds = (el: Element, attribute: string): string => {
    const ids = norm(el.getAttribute(attribute))
    if (ids === '') return ''
    return ids
      .split(' ')
      .map((id) => norm(el.ownerDocument.getElementById(id)?.textContent))
      .join(' ')
  }
  const labelsOf = (el: Element): string => {
    const { labels } = el as HTMLInputElement
    return labels === null || labels === undefined
      ? ''
      : Array.from(labels)
          .map((label) => norm(label.textContent))
          .join(' ')
  }
  const nameOf = (el: Element): string => {
    const labelled = byIds(el, 'aria-labelledby')
    if (labelled !== '') return labelled
    const aria = norm(el.getAttribute('aria-label'))
    if (aria !== '') return aria
    const tag = el.tagName
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
      const type = (el.getAttribute('type') ?? '').toLowerCase()
      if (type === 'submit' || type === 'button' || type === 'reset') {
        return norm((el as HTMLInputElement).value)
      }
      const labels = labelsOf(el)
      if (labels !== '') return labels
      return norm(el.getAttribute('title') ?? el.getAttribute('placeholder'))
    }
    if (tag === 'IMG') return norm(el.getAttribute('alt') ?? el.getAttribute('title'))
    const text = norm(el.textContent)
    return text !== '' ? text : norm(el.getAttribute('title'))
  }
  const isVisible = (el: Element): boolean => {
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return false
    const style = el.ownerDocument.defaultView?.getComputedStyle(el)
    return style === undefined || (style.visibility !== 'hidden' && style.display !== 'none')
  }
  const all = (root: ParentNode, selector: string): Element[] => {
    try {
      return Array.from(root.querySelectorAll(selector))
    } catch {
      return []
    }
  }
  const candidates = (root: ParentNode, q: PageQuery): Element[] => {
    if (q.selector !== undefined) return all(root, q.selector)
    if (q.testId !== undefined) {
      return all(root, '[data-testid]').filter((el) => el.getAttribute('data-testid') === q.testId)
    }
    if (q.placeholder !== undefined) {
      const wanted = norm(q.placeholder)
      return all(root, '[placeholder]').filter((el) =>
        matches(el.getAttribute('placeholder') ?? '', wanted, q.exact)
      )
    }
    if (q.label !== undefined) {
      const wanted = norm(q.label)
      const viaLabel = all(root, 'label')
        .filter((label) => matches(label.textContent ?? '', wanted, q.exact))
        .map((label) => (label as HTMLLabelElement).control)
        .filter((control): control is HTMLElement => control !== null)
      const viaAria = all(root, 'input,select,textarea,[contenteditable]').filter(
        (el) =>
          matches(el.getAttribute('aria-label') ?? '', wanted, q.exact) ||
          (el.hasAttribute('aria-labelledby') &&
            matches(byIds(el, 'aria-labelledby'), wanted, q.exact))
      )
      return Array.from(new Set([...viaLabel, ...viaAria]))
    }
    if (q.text !== undefined) {
      const wanted = norm(q.text)
      const holds = (el: Element): boolean =>
        !SKIPPED.has(el.tagName) && matches(el.textContent ?? '', wanted, false)
      return all(root, '*').filter(
        (el) =>
          holds(el) &&
          (q.exact !== true || norm(el.textContent) === wanted) &&
          !Array.from(el.children).some((child) => matches(child.textContent ?? '', wanted, false))
      )
    }
    if (q.role !== undefined) {
      const wanted = q.name === undefined ? undefined : norm(q.name)
      return all(root, '*').filter(
        (el) =>
          roleOf(el) === q.role && (wanted === undefined || matches(nameOf(el), wanted, q.exact))
      )
    }
    return []
  }
  /** The top document and every same-origin frame, with the frame's offset; cross-origin frames counted. */
  const documents = (): { docs: { doc: Document; x: number; y: number }[]; cross: number } => {
    const docs: { doc: Document; x: number; y: number }[] = [{ doc: document, x: 0, y: 0 }]
    let cross = 0
    for (let i = 0; i < docs.length && i < 50; i += 1) {
      const current = docs[i]
      if (current === undefined) break
      for (const frame of Array.from(current.doc.querySelectorAll('iframe,frame'))) {
        let inner: Document | null
        try {
          inner = (frame as HTMLIFrameElement).contentDocument
        } catch {
          inner = null
        }
        if (inner === null) {
          cross += 1
          continue
        }
        const rect = frame.getBoundingClientRect()
        const f = frame as HTMLIFrameElement
        docs.push({
          doc: inner,
          x: current.x + rect.left + f.clientLeft,
          y: current.y + rect.top + f.clientTop,
        })
      }
    }
    return { docs, cross }
  }
  const state: { target: Element | undefined; targetOffset: { x: number; y: number } } = {
    target: undefined,
    targetOffset: { x: 0, y: 0 },
  }
  const findAll = (
    q: PageQuery
  ): { els: { el: Element; x: number; y: number }[]; cross: number } => {
    const { docs, cross } = documents()
    const els = docs.flatMap(({ doc, x, y }) =>
      candidates(doc, q)
        .filter((el) => q.includeHidden === true || isVisible(el))
        .map((el) => ({ el, x, y }))
    )
    return { els, cross }
  }
  const pointOf = (el: Element, offset: { x: number; y: number }) => {
    el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' })
    const rect = el.getBoundingClientRect()
    const lx = rect.left + rect.width / 2
    const ly = rect.top + rect.height / 2
    const top = el.ownerDocument.elementFromPoint(lx, ly)
    const obscured =
      top !== null && top !== el && !el.contains(top) && !(top as Element).contains(el)
    return { x: offset.x + lx, y: offset.y + ly, obscured: isVisible(el) ? obscured : false }
  }
  /** Links and forms that would open a new window open in this one instead. */
  const keepInView = (): void => {
    for (const { doc } of documents().docs) {
      for (const el of Array.from(
        doc.querySelectorAll('a[target],area[target],form[target],base[target]')
      )) {
        el.setAttribute('target', '_self')
      }
    }
  }
  const resolve = (q: PageQuery): PageMatch => {
    const { els, cross } = findAll(q)
    state.target = undefined
    if (els.length === 0) return { count: 0, crossOrigin: cross }
    const index = q.nth ?? 0
    if (q.nth === undefined && els.length > 1) return { count: els.length, crossOrigin: cross }
    const chosen = els[index]
    if (chosen === undefined) return { count: els.length, crossOrigin: cross }
    state.target = chosen.el
    state.targetOffset = { x: chosen.x, y: chosen.y }
    keepInView()
    return {
      count: els.length,
      crossOrigin: cross,
      point: pointOf(chosen.el, state.targetOffset),
      tag: chosen.el.tagName,
      type: (chosen.el.getAttribute('type') ?? '').toLowerCase(),
    }
  }
  const textOf = (el: Element, attribute: string | undefined): string => {
    if (attribute !== undefined) {
      if (attribute === 'value' && (el.getAttribute('type') ?? '').toLowerCase() === 'password')
        return ''
      return attribute === 'value' && 'value' in el
        ? String((el as HTMLInputElement).value)
        : (el.getAttribute(attribute) ?? '')
    }
    const html = el as HTMLElement
    return norm(typeof html.innerText === 'string' ? html.innerText : el.textContent)
  }
  const withFields = (
    el: Element,
    fields: Record<string, PageQuery> | undefined,
    attribute: string | undefined
  ): string | Record<string, string> => {
    if (fields === undefined) return textOf(el, attribute)
    return Object.fromEntries(
      Object.entries(fields).map(([key, q]) => {
        const found = candidates(el, q)[q.nth ?? 0]
        return [key, found === undefined ? '' : textOf(found, attribute)]
      })
    )
  }
  const read = (
    q: PageQuery,
    options: { attribute?: string; fields?: Record<string, PageQuery>; limit?: number }
  ) => {
    if (options.limit === undefined) {
      const found = resolve(q)
      if (state.target === undefined) return { ...found, values: [] }
      return { ...found, values: [withFields(state.target, options.fields, options.attribute)] }
    }
    const { els, cross } = findAll(q)
    return {
      count: els.length,
      crossOrigin: cross,
      values: els
        .slice(0, options.limit)
        .map(({ el }) => withFields(el, options.fields, options.attribute)),
    }
  }
  const target = (): HTMLElement => {
    if (state.target === undefined) throw new Error('the element is gone from the page')
    return state.target as HTMLElement
  }
  const api = {
    resolve,
    read,
    keepInView,
    href: (): string => location.href,
    target,
    documents,
    norm,
    roleOf,
    nameOf,
    isVisible,
  }
  w['__sovrium'] = api
}
/* eslint-enable sonarjs/cognitive-complexity, max-lines-per-function, complexity, max-statements, sovrium/no-double-assertion, unicorn/consistent-function-scoping, no-restricted-syntax -- end of the page script */
