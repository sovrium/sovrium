/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { escapeHtmlAttribute } from '@/domain/kernel/sanitize/html-escaping'
import { hasPlainTextPin, withPlainTextPin } from './record-substitution'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * How a substituted VALUE is written into its template: `escapeHtmlAttribute` when the
 * template is HTML, `undefined` (verbatim) when it is text React escapes on
 * output.
 */
export type ValueEncoder = (value: string) => string

/**
 * Does a string start with markup — `renderHTMLElement`'s own raw-HTML test?
 *
 * Asked of the AUTHOR's template, before any value is substituted, so a value
 * can never decide which side of the test its template falls on.
 */
export const startsAsMarkup = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().startsWith('<')

/**
 * The encoder for the values substituted into one author template: the full
 * five-character HTML escape for an HTML template (its values may land in a
 * text or an attribute context, and the resolver cannot tell which), nothing
 * for a text template, where escaping would print the entities.
 */
export const encoderForTemplate = (template: string): ValueEncoder | undefined =>
  startsAsMarkup(template) ? escapeHtmlAttribute : undefined

/**
 * Walk a page tree and substitute into every string leaf, with the two
 * decisions a plain string walk cannot take — the one rule shared by the
 * `$app`, `$param` and `$query` passes, so the three cannot drift apart.
 *
 * `renderHTMLElement` renders `content` as raw HTML when it starts with `<`, and
 * each of these passes can carry a value a visitor chose: a decoded address
 * segment, a request header, a query value.
 *
 *  - An HTML template (`<h1>Posts tagged $param.tag</h1>`) keeps its markup and
 *    takes each value HTML-escaped, so the value contributes text, never
 *    elements. A component whose content an earlier pass already pinned to
 *    text is filled verbatim instead: React escapes it, and escaping here too
 *    would print the entities.
 *  - A text template (`$param.tag`) takes each value verbatim, and when the
 *    result would now read as markup the content is pinned to text — the same
 *    pin `$record.*` substitution sets — so a value cannot flip the element
 *    onto the raw-HTML branch.
 *
 * `fill` substitutes one string, applying `encode` to each value it writes.
 * `templateOf` names the template a string is filled INTO when that is not the
 * string itself — the translation of a `$t:` key the pass fills — so the
 * markup-or-text decision, and the pin, are taken on what the reader is
 * actually shown.
 */
export const substituteTemplatesDeep = (
  value: unknown,
  fill: (str: string, encode: ValueEncoder | undefined) => string,
  templateOf: (str: string) => string = (str) => str
): unknown => walk(value, { fill, templateOf }, false)

interface TemplateFill {
  readonly fill: (str: string, encode: ValueEncoder | undefined) => string
  readonly templateOf: (str: string) => string
}

const walk = (value: unknown, pass: TemplateFill, pinnedToText: boolean): unknown => {
  if (typeof value === 'string')
    return pass.fill(value, pinnedToText ? undefined : encoderForTemplate(pass.templateOf(value)))
  if (Array.isArray(value)) return value.map((item) => walk(item, pass, false))
  if (value === null || typeof value !== 'object') return value
  const node = value as Readonly<Record<string, unknown>>
  const pinned = hasPlainTextPin(node['props'])
  const mapped = Object.fromEntries(
    Object.entries(node).map(([key, entry]) => [
      key,
      walk(entry, pass, pinned && key === 'content'),
    ])
  )
  const authored = node['content']
  const template = typeof authored === 'string' ? pass.templateOf(authored) : authored
  const flipped = !startsAsMarkup(template) && startsAsMarkup(mapped['content'])
  return flipped
    ? { ...mapped, props: withPlainTextPin(mapped['props'] as Component['props'], true) }
    : mapped
}
