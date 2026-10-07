/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { cn } from '@/presentation/design/class-merge'
import {
  resolveComponentStyle,
  type ComponentDesignResolution,
} from '@/presentation/design/resolve-component-classes'
import { FIELD_LABEL_CLASS } from './form-field-chrome'
import type { ComponentStyle, Design } from '@/domain/models/app/design'

/**
 * The parts of a hosted form an author's `classes` reach by name, written onto
 * the form's rendered markup.
 *
 * A hosted form placed with `formRef` is drawn to an HTML string by the form
 * renderer, which serves the standalone `/forms/:name` page too and knows
 * nothing of the page node that placed it. So the parts are applied to that
 * string, the way the prose parts are applied to rendered markdown: the markup
 * is the engine's own output, its tag shapes are known, and these patterns
 * read that output, never author HTML.
 *
 *  - `title` — the form's heading (`.form-title`);
 *  - `description` — the paragraph under it (`.form-description`);
 *  - `body` — the `<form>` holding the fields;
 *  - `label` — each field's label;
 *  - `input` — each text control and select (not a box, a radio, a file or a slider);
 *  - `submit` — the submit button, with the button's focus floor after it;
 *  - `error` — the reason the form runtime writes under a field, carried to it
 *    on the `<form>` as `data-error-class` since the element does not exist yet.
 */

/** Input types that are not a text control: a mark, a slider, a swatch, a file or a button. */
const NON_TEXT_INPUT =
  /\stype="(?:hidden|checkbox|radio|file|range|color|submit|button|image|reset)"/

/** An opening tag whose class list carries `token`. */
const tagWithClassToken = (tag: string, token: string): RegExp =>
  new RegExp(`<${tag}(?=\\s)[^>]*\\sclass="(?:[^"]*\\s)?${token}(?:\\s[^"]*)?"[^>]*>`, 'g')

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const PART_TAGS: Readonly<Record<string, RegExp>> = {
  title: tagWithClassToken('h[1-6]', 'form-title'),
  description: tagWithClassToken('p', 'form-description'),
  body: /<form(?=[\s>])[^>]*>/g,
  label: new RegExp(`<label(?=\\s)[^>]*\\sclass="${escapeRegExp(FIELD_LABEL_CLASS)}"[^>]*>`, 'g'),
  submit: /<button(?=\s)[^>]*\stype="submit"[^>]*>/g,
}

/** A text control or a select, but never the hidden honeypot. */
const CONTROL_TAG = /<(?:input|select|textarea)(?=[\s/>])[^>]*>/g
const isTextControl = (tag: string): boolean =>
  !NON_TEXT_INPUT.test(tag) && !tag.includes(' name="_hp"')

const CLASS_ATTRIBUTE = /\sclass="([^"]*)"/

/** Escape the characters an HTML attribute value cannot hold. */
const escapeAttribute = (value: string): string =>
  value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')

/** One opening tag, `classes` merged after its own class list (later wins). */
const withClasses = (tag: string, classes: string): string => {
  const existing = CLASS_ATTRIBUTE.exec(tag)
  if (existing) {
    // The tag's own list is already escaped; only the author's classes are not.
    return tag.replace(CLASS_ATTRIBUTE, ` class="${cn(existing[1], escapeAttribute(classes))}"`)
  }
  const end = tag.endsWith('/>') ? tag.length - 2 : tag.length - 1
  return `${tag.slice(0, end).trimEnd()} class="${escapeAttribute(classes)}"${tag.slice(end)}`
}

/** One attribute added to the first `<form>` tag. */
const withFormAttribute = (html: string, name: string, value: string): string =>
  html.replace(/<form(?=[\s>])/, `<form ${name}="${escapeAttribute(value)}"`)

/** The classes a part receives: the author's, then its floor. */
const partClasses = (styles: ComponentDesignResolution, part: string): string =>
  [styles.parts[part], styles.partFloors[part]].filter((c) => c !== undefined && c !== '').join(' ')

/**
 * The hosted form's markup with the author's part classes on the elements they
 * name. A form whose node names no part comes back unchanged, byte for byte.
 *
 * @param html - The form body the form renderer drew.
 * @param styles - `design.components.form` under the placing node's `classes`.
 */
export const applyFormPartClasses = (
  html: string,
  styles: ComponentDesignResolution | undefined
): string => {
  if (styles === undefined || Object.keys(styles.parts).length === 0) return html
  const tagged = Object.entries(PART_TAGS).reduce((current, [part, pattern]) => {
    const classes = partClasses(styles, part)
    if (classes === '') return current
    return current.replace(pattern, (tag) => withClasses(tag, classes))
  }, html)
  const input = partClasses(styles, 'input')
  const withControls =
    input === ''
      ? tagged
      : tagged.replace(CONTROL_TAG, (tag) => (isTextControl(tag) ? withClasses(tag, input) : tag))
  const { error } = styles.parts
  return error === undefined || error === ''
    ? withControls
    : withFormAttribute(withControls, 'data-error-class', error)
}

/** The `<form>` tag of `html` with the placing node's `props.className` merged in. */
const withNodeClassName = (html: string, node: unknown): string => {
  const props = (node as { readonly props?: { readonly className?: unknown } } | undefined)?.props
  const className = props?.className
  if (typeof className !== 'string' || className.trim() === '') return html
  return html.replace(PART_TAGS['body']!, (tag) => withClasses(tag, className))
}

/**
 * {@link applyFormPartClasses} for the page node that placed the form: the
 * app's `design.components.form` under the node's own `classes`, then the
 * node's own `props.className` on the `<form>` itself — merged over its layout
 * classes, as a page form's is.
 *
 * @param html - The form body the form renderer drew.
 * @param design - The app's `design` key, if any.
 * @param node - The `form` node carrying `formRef`, whose `classes` and `props.className` are read.
 */
export const applyNodeFormParts = (
  html: string,
  design: Design | undefined,
  node: unknown
): string => {
  const classes = (node as { readonly classes?: ComponentStyle } | undefined)?.classes
  const parted = applyFormPartClasses(
    html,
    resolveComponentStyle(design, 'form', undefined, classes)
  )
  return withNodeClassName(parted, node)
}
