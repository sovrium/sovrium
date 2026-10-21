/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  textOfHtmlNodes,
  type HtmlElementNode,
  type HtmlNode,
} from '@/domain/kernel/sanitize/html-element-tree'
import { migratedLiteral } from './migrated-literal-tokens-service'
import { pageSlugOf } from './notion-pages-migrate'

/**
 * A Webflow form, read from the exported HTML into the `ExtractedForm` the
 * forms mapper writes as a `forms[]` entry (the page keeps one `form` node
 * naming it).
 *
 * Webflow wraps a form in `div.w-form` (the `FormWrapper`): the `<form>`
 * (`FormForm`), its labels, inputs, selects, textareas and submit button,
 * then `div.w-form-done` and `div.w-form-fail`, the messages shown after a
 * submit. All of it is absorbed into the extracted form; none becomes a node.
 *
 * Identity: an export carries no `data-wf-element-id` (fact c7, DISPROVED),
 * so a form's `sourceId` is its page path and its position on the page
 * (`/contact#form-0`). Its `name` is the slug of the name the Designer gave it
 * (`data-name`), else of its `name` attribute, made unique across the site.
 */

type Element = HtmlElementNode

/** The control a field was drawn as: an `<input>` type, a `<textarea>` or a `<select>`. */
export type WebflowFieldInputType =
  | 'text'
  | 'email'
  | 'tel'
  | 'url'
  | 'number'
  | 'date'
  | 'datetime-local'
  | 'time'
  | 'password'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'file'
  | 'hidden'

/** One field of a Webflow form, in the shape of the import's `WebflowFormField`. */
export interface WebflowFormField {
  readonly name: string
  readonly label?: string
  readonly inputType: WebflowFieldInputType
  readonly required: boolean
  readonly options?: readonly { readonly value: string; readonly label: string }[]
  readonly placeholder?: string
}

/**
 * A Webflow form, in the shape of the import's `ExtractedForm`
 * (`src/domain/models/import/extracted-form.ts`), which the page converter
 * hands to the forms mapper. The domain's page models do not reach the import
 * models, so the shape is restated here and held to the schema by the
 * converter's tests.
 */
export interface WebflowExtractedForm {
  readonly sourceId: string
  readonly name: string
  readonly title?: string
  readonly fields: readonly WebflowFormField[]
  readonly action?: string
  readonly method?: 'get' | 'post'
  readonly redirect?: string
  readonly successMessage?: string
  readonly errorMessage?: string
}

const isElement = (node: HtmlNode): node is Element => node.kind === 'element'

const classesOf = (element: Element): readonly string[] =>
  (element.attributes['class'] ?? '').split(/\s+/).filter((name) => name !== '')

/** Whether an element carries a class. */
export const hasClass = (element: Element, name: string): boolean =>
  classesOf(element).includes(name)

/** Every element under some nodes, depth first. */
export const elementsUnder = (nodes: readonly HtmlNode[]): readonly Element[] =>
  nodes.filter(isElement).flatMap((element) => [element, ...elementsUnder(element.children)])

/** Text with its runs of white space folded to one space. */
export const foldedText = (nodes: readonly HtmlNode[]): string =>
  textOfHtmlNodes(nodes).replace(/\s+/g, ' ').trim()

const INPUT_TYPES: ReadonlySet<string> = new Set<WebflowFieldInputType>([
  'text',
  'email',
  'tel',
  'url',
  'number',
  'date',
  'datetime-local',
  'time',
  'password',
  'checkbox',
  'radio',
  'file',
  'hidden',
  'textarea',
  'select',
])

/** The input types a form submits nothing of its own under. */
const BUTTON_TYPES: ReadonlySet<string> = new Set(['submit', 'button', 'reset', 'image'])

/** The text of the `<label>` naming a control: its `for`, else the label around it. */
const labelOf = (control: Element, form: Element): string | undefined => {
  const { id } = control.attributes
  const labels = elementsUnder(form.children).filter((element) => element.tag === 'label')
  const named =
    id === undefined ? undefined : labels.find((label) => label.attributes['for'] === id)
  const wrapping = labels.find((label) => elementsUnder(label.children).includes(control))
  const text = foldedText((named ?? wrapping)?.children ?? [])
  return text === '' ? undefined : migratedLiteral(text)
}

const literalOf = (text: string | undefined): string | undefined =>
  text === undefined ? undefined : migratedLiteral(text)

const optional = <K extends string>(key: K, value: string | undefined) =>
  value === undefined || value === '' ? {} : ({ [key]: value } as { readonly [P in K]: string })

/** The control a form element is: its `<input>` type, or its tag. */
const controlTypeOf = (control: Element): string =>
  control.tag === 'input' ? (control.attributes['type'] ?? 'text').toLowerCase() : control.tag

/** A select's options, value and label each; none for any other control. */
const optionsOf = (control: Element): WebflowFormField['options'] =>
  control.tag === 'select'
    ? elementsUnder(control.children)
        .filter((element) => element.tag === 'option')
        .map((option) => {
          const label = foldedText(option.children)
          return { value: option.attributes['value'] ?? label, label: migratedLiteral(label) }
        })
    : undefined

/** One control as a field, or nothing for a button. */
const fieldOf = (
  control: Element,
  form: Element,
  position: number
): readonly WebflowFormField[] => {
  const type = controlTypeOf(control)
  if (BUTTON_TYPES.has(type)) return []
  const options = optionsOf(control)
  return [
    {
      name: control.attributes['name'] ?? control.attributes['id'] ?? `field-${position + 1}`,
      ...optional('label', labelOf(control, form)),
      inputType: (INPUT_TYPES.has(type) ? type : 'text') as WebflowFieldInputType,
      required: Object.hasOwn(control.attributes, 'required'),
      ...(options === undefined ? {} : { options }),
      ...optional('placeholder', literalOf(control.attributes['placeholder'])),
    },
  ]
}

/** Radio inputs of one name are one field: the first of the group stands for it. */
const oneFieldPerRadioGroup = (fields: readonly WebflowFormField[]): readonly WebflowFormField[] =>
  fields.filter(
    (field, index) =>
      field.inputType !== 'radio' ||
      fields.findIndex(
        (candidate) => candidate.inputType === 'radio' && candidate.name === field.name
      ) === index
  )

/** The radio fields' options, read once every input of the group is seen. */
const radioOptions =
  (controls: readonly Element[], form: Element) =>
  (field: WebflowFormField): WebflowFormField => {
    if (field.inputType !== 'radio') return field
    const options = controls
      .filter(
        (control) =>
          control.attributes['type'] === 'radio' && control.attributes['name'] === field.name
      )
      .map((control) => {
        const value = control.attributes['value'] ?? ''
        return { value, label: labelOf(control, form) ?? value }
      })
    const { label: _label, ...rest } = field
    return { ...rest, options }
  }

/** The text of the first element under `wrapper` carrying `name`. */
const messageOf = (wrapper: Element, name: string): string | undefined => {
  const message = elementsUnder(wrapper.children).find((element) => hasClass(element, name))
  const text = message === undefined ? '' : foldedText(message.children)
  return text === '' ? undefined : migratedLiteral(text)
}

/**
 * The form's title as its author named it. Webflow writes the name given in
 * the Designer as the form element's `data-name` (the Forms API's
 * `displayName`); a hand-written form may carry only `name`; failing both, the
 * first heading inside the form block names it.
 */
const formTitleOf = (form: Element, wrapper: Element): string | undefined => {
  const named = [form.attributes['data-name'], form.attributes['name']]
    .map((value) => value?.replace(/\s+/g, ' ').trim() ?? '')
    .find((value) => value !== '')
  const heading = elementsUnder(wrapper.children).find((element) => /^h[1-6]$/.test(element.tag))
  const text = named ?? (heading === undefined ? '' : foldedText(heading.children))
  return text === '' ? undefined : migratedLiteral(text)
}

/** A form name: a slug starting with a letter, at most 64 characters, unique among `taken`. */
const formNameOf = (wanted: string, taken: ReadonlySet<string>): string => {
  const slug = pageSlugOf(wanted).slice(0, 56).replace(/-+$/, '')
  const base = /^[a-z]/.test(slug) ? slug : `form-${slug}`.replace(/-+$/, '')
  const candidates = [
    base,
    ...Array.from({ length: taken.size + 1 }, (_, index) => `${base}-${index + 2}`),
  ]
  return candidates.find((candidate) => !taken.has(candidate)) ?? base
}

/**
 * The extracted form a `div.w-form` holds, its name unique among `taken`.
 * `sourceId` is `<pagePath>#form-<position>`.
 */
export const extractWebflowForm = (
  wrapper: Element,
  pagePath: string,
  position: number,
  taken: ReadonlySet<string>
): WebflowExtractedForm => {
  const form = elementsUnder(wrapper.children).find((element) => element.tag === 'form') ?? wrapper
  const controls = elementsUnder(form.children).filter((element) =>
    ['input', 'select', 'textarea'].includes(element.tag)
  )
  const fields = oneFieldPerRadioGroup(
    controls.flatMap((control, index) => fieldOf(control, form, index))
  ).map(radioOptions(controls, form))
  const method = form.attributes['method']?.toLowerCase()
  return {
    sourceId: `${pagePath}#form-${position}`,
    name: formNameOf(form.attributes['data-name'] ?? form.attributes['name'] ?? 'form', taken),
    ...optional('title', formTitleOf(form, wrapper)),
    fields,
    ...optional('action', form.attributes['action']),
    ...(method === 'get' || method === 'post' ? { method } : {}),
    ...optional('redirect', form.attributes['data-redirect'] ?? form.attributes['redirect']),
    ...optional('successMessage', messageOf(wrapper, 'w-form-done')),
    ...optional('errorMessage', messageOf(wrapper, 'w-form-fail')),
  }
}
