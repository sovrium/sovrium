/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A page drawn again for a form posted without JavaScript and refused: inside
 * the posted form only, each typed answer is written back into its text field,
 * and each refused field is marked `aria-invalid`, pointing (`aria-describedby`)
 * at its reason, drawn under it with the error recipe the browser runtime uses.
 * The markup it reads is the server's own, so a control is found by its `name`.
 */

import { escapeHtmlAttribute } from '@/domain/kernel/sanitize/html-escaping'
import { computeFormFieldErrorClasses } from '@/presentation/design/form-layout-classes'

/** One refused field and its reason, as the JSON answer lists it. */
export interface RefusedField {
  readonly name: string
  readonly message: string
}

/** What a refusal hands back to its page: the refused fields and the answers typed. */
export interface NativeRefusal {
  readonly errors: readonly RefusedField[]
  readonly answers: Readonly<Record<string, unknown>>
}

/** The opening tag of the control posting `name`, and where it sits, if the form draws one. */
const controlTagOf = (
  html: string,
  name: string
): { readonly start: number; readonly end: number; readonly tag: string } | undefined => {
  const at = html.indexOf(` name="${escapeHtmlAttribute(name)}"`)
  if (at < 0) return undefined
  const start = html.lastIndexOf('<', at)
  const end = html.indexOf('>', at) + 1
  if (start < 0 || end <= 0) return undefined
  const tag = html.slice(start, end)
  return /^<(input|textarea|select)\b/.test(tag) ? { start, end, tag } : undefined
}

/** A text-like input, whose typed answer is written back into its `value`. */
const isTextLikeInput = (tag: string): boolean =>
  tag.startsWith('<input') &&
  !/\stype="(hidden|file|checkbox|radio|password|submit|button|image|reset)"/.test(tag)

/** `tag` with `attributes` added before its end. */
const withAttributes = (tag: string, attributes: string): string => {
  const close = tag.endsWith('/>') ? tag.length - 2 : tag.length - 1
  return `${tag.slice(0, close)}${attributes}${tag.slice(close)}`
}

/** `tag` with its `value` set to `answer`. */
const withValue = (tag: string, answer: string): string =>
  withAttributes(tag.replace(/\svalue="[^"]*"/, ''), ` value="${escapeHtmlAttribute(answer)}"`)

/** `tag` marked invalid and described by `errorId` too, beside what already described it. */
const markedInvalid = (tag: string, errorId: string): string => {
  const described = /\saria-describedby="([^"]*)"/.exec(tag)?.[1] ?? ''
  const ids = [...described.split(' ').filter((id) => id !== ''), errorId].join(' ')
  const bare = tag.replace(/\saria-describedby="[^"]*"/, '').replace(/\saria-invalid="[^"]*"/, '')
  return withAttributes(bare, ` aria-invalid="true" aria-describedby="${escapeHtmlAttribute(ids)}"`)
}

/** Where a control ends: after its tag, or after its closing tag for one that holds content. */
const controlEndOf = (html: string, control: { readonly end: number; readonly tag: string }) => {
  const element = /^<(textarea|select)\b/.exec(control.tag)?.[1]
  if (element === undefined) return control.end
  const closing = html.indexOf(`</${element}>`, control.end)
  return closing < 0 ? control.end : closing + element.length + 3
}

/** The reason drawn under a refused field, under the id its control points at. */
const reasonMarkup = (errorId: string, error: RefusedField): string =>
  `<div id="${escapeHtmlAttribute(errorId)}" data-field-error="${escapeHtmlAttribute(error.name)}" ` +
  `class="field-error ${computeFormFieldErrorClasses()}">${escapeHtmlAttribute(error.message)}</div>`

/** The form's markup with each answer written back and each refused field marked. */
const markForm = (formHtml: string, formName: string, refusal: NativeRefusal): string => {
  const answered = Object.entries(refusal.answers).reduce((html, [name, answer]) => {
    const control = typeof answer === 'string' ? controlTagOf(html, name) : undefined
    if (control === undefined || !isTextLikeInput(control.tag)) return html
    const filled = withValue(control.tag, String(answer))
    return `${html.slice(0, control.start)}${filled}${html.slice(control.end)}`
  }, formHtml)
  return refusal.errors.reduce((html, error) => {
    const control = controlTagOf(html, error.name)
    if (control === undefined) return html
    const errorId = `field-error-${formName}-${error.name}`
    const after = controlEndOf(html, control)
    const marked = markedInvalid(control.tag, errorId)
    const between = html.slice(control.end, after)
    return `${html.slice(0, control.start)}${marked}${between}${reasonMarkup(errorId, error)}${html.slice(after)}`
  }, answered)
}

/** `pageHtml` with the posted form's refused fields marked, or `undefined` when it draws no such form. */
export const markRefusedFields = (
  pageHtml: string,
  formName: string,
  refusal: NativeRefusal
): string | undefined => {
  const marker = pageHtml.indexOf(`data-form-name="${escapeHtmlAttribute(formName)}"`)
  if (marker < 0) return undefined
  const start = pageHtml.lastIndexOf('<form', marker)
  const end = pageHtml.indexOf('</form>', marker)
  if (start < 0 || end < 0) return undefined
  const marked = markForm(pageHtml.slice(start, end), formName, refusal)
  return `${pageHtml.slice(0, start)}${marked}${pageHtml.slice(end)}`
}

/**
 * `pageHtml` with a notice about the posted form as a whole (a refusal no field
 * explains, such as too many submissions) drawn above it, as the browser
 * runtime draws its error banner; `undefined` when the page draws no such form.
 */
export const withFormNotice = (
  pageHtml: string,
  formName: string,
  message: string
): string | undefined => {
  const name = escapeHtmlAttribute(formName)
  const marker = pageHtml.indexOf(`data-form-name="${name}"`)
  const start = marker < 0 ? -1 : pageHtml.lastIndexOf('<form', marker)
  if (start < 0) return undefined
  const notice =
    `<div data-form-error-message="${name}" role="alert" class="form-error-banner">` +
    `${escapeHtmlAttribute(message)}</div>`
  return `${pageHtml.slice(0, start)}${notice}${pageHtml.slice(start)}`
}
