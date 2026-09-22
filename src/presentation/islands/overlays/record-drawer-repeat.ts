/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `repeat` — a drawer child drawn once per element of an array the opened
 * record already carries ([internal ref] CAP-6, [internal ref]).
 *
 * ─── WHY THIS RUNS IN THE BROWSER AND NOT AT SSR ────────────────────────────
 *
 * The drawer's slot is rendered before anyone knows which record it will open
 * for — it is opened by a row click or a `?record=` link — so the array does not
 * exist at render time. The author's children reach the browser as markup and
 * the record arrives after them, which is the same reason CAP-5's `$record.`
 * resolution lives next door rather than on the server. Everything a
 * server-evaluated feature would bring with it (the per-row `visibility.record`
 * gate, most of all) is refused at DECODE instead of half-working here; see
 * `repeatPlacementViolations`.
 *
 * ─── WHY THE COPIES ARE CLONED AND NOT RE-SERIALISED ────────────────────────
 *
 * The obvious build is "substitute into the template STRING, then assign
 * `innerHTML`". It is also how record data becomes markup: a step name holding
 * `<img onerror=…>` would be parsed as HTML rather than shown as text, and by
 * the time the template and the value are one string no consumer downstream can
 * tell which half came from the author. So the template is parsed ONCE, with no
 * record data in it, and each copy is a `cloneNode` whose text nodes and `data-*`
 * attributes are written as VALUES — `nodeValue` and `setAttribute`, never a
 * re-parse. The value lands as text by construction and there is no HTML for it
 * to become — the invariant `resolveSlotTokens` states next door, kept on this
 * path too (standing rule S2).
 *
 * ─── WHY A TEMPLATE IS REMEMBERED PER HOST ──────────────────────────────────
 *
 * The first expansion consumes the children it replaces, so a second pass — a
 * re-opened drawer, a newly fetched record — would find copies where the
 * template used to be and iterate those. The host's ORIGINAL markup is therefore
 * captured before the first copy exists and every later pass rebuilds from it.
 * A `WeakMap` because the keys are DOM nodes: re-injecting the slot detaches the
 * old hosts, and a detached one has to be collectable.
 */

import {
  repeatElementScalars,
  substituteRecordVars,
} from '@/domain/models/app/pages/substitute-record-vars'

type RawRecord = Record<string, unknown>

/**
 * The marker a repeating container carries, written at SSR by the `container`
 * renderer (`presentation/render/registry/structural-components.tsx`).
 *
 * Spelled literally on both sides: the render tree and the island tree may not
 * import each other, so `data-island` and `data-drawer-children` are already
 * written twice each, and a shared constant would have to be hoisted into
 * `design/`, which is for class recipes.
 */
export const REPEAT_ATTRIBUTE = 'data-repeat-record'

/** Hosts to expand, in document order. */
const REPEAT_SELECTOR = `[${REPEAT_ATTRIBUTE}]`

/** Is this node a container that asked to iterate? */
export const isRepeatHost = (node: Node): boolean =>
  node.nodeType === Node.ELEMENT_NODE && (node as Element).hasAttribute(REPEAT_ATTRIBUTE)

/**
 * Every text node under `node`, in document order, not descending into anything
 * `skip` claims.
 *
 * The predicate is what keeps the two `$record.` scopes apart. A copy's tokens
 * are resolved HERE against its own element, and the drawer-scoped pass next
 * door must not then resolve what is left — an object-valued key survives
 * expansion as its own token deliberately, and a second pass would silently turn
 * it into the empty string against a drawer record that has no such field.
 */
export function collectTextNodes(node: Node, skip?: (candidate: Node) => boolean): readonly Text[] {
  if (node.nodeType === Node.TEXT_NODE) return [node as Text]
  if (skip?.(node) === true) return []
  return Array.from(node.childNodes).flatMap((child) => collectTextNodes(child, skip))
}

/** What a host needs to remember between passes. */
interface RepeatState {
  /** The author's children, captured before the first copy replaced them. */
  readonly template: string
  /** The array the copies currently on screen were built from. */
  readonly source: unknown
}

/** Per-host state, owned by the slot component and threaded through. */
export type RepeatStates = WeakMap<HTMLElement, RepeatState>

/**
 * Resolve the `$record.` tokens a copy carries in its `data-*` attributes,
 * against the same element its text nodes were resolved against.
 *
 * ─── WHY `data-*` AND NOT EVERY ATTRIBUTE ───────────────────────────────────
 *
 * This pass writes a VALUE into an attribute, and what a value MEANS there is
 * per-destination: an `href` decides what a click reaches, a `style` can name a
 * `url(`, a `srcdoc` is a document. The SSR substituter answers those questions
 * because it sees a typed component tree; a browser pass over a parsed copy sees
 * strings and cannot. A `data-*` attribute navigates nothing, fetches nothing and
 * styles nothing, so it is the half that needs no such answer — which is why the
 * criterion is scoped to it (`-REPEAT-007`). Widening this is a capability with
 * its own escaping contract, not a loosened `startsWith`.
 *
 * The value goes in through `setAttribute`, so it is a value by construction and
 * never markup — the same invariant the text-node half keeps (standing rule S2).
 *
 * `repeatElementScalars` is what keeps the three answers apart: a key the element
 * carries prints, a key only the drawer's record carries resolves to the empty
 * string, and an object-valued key survives as its own token rather than becoming
 * `[object Object]`.
 */
function resolveCopyAttributes(
  copy: DocumentFragment,
  scalars: Readonly<Record<string, unknown>>
): void {
  copy.querySelectorAll('*').forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      const source = attribute.value
      if (!attribute.name.startsWith('data-') || !source.includes('$record.')) return
      const next = substituteRecordVars(source, scalars)
      if (next !== source) element.setAttribute(attribute.name, next)
    })
  })
}

/** One copy of the template, with its tokens resolved against one element. */
function buildCopy(parsed: HTMLTemplateElement, element: unknown): DocumentFragment {
  const copy = parsed.content.cloneNode(true) as DocumentFragment
  const scalars = repeatElementScalars(element)
  collectTextNodes(copy).forEach((text) => {
    const source = text.nodeValue ?? ''
    if (!source.includes('$record.')) return
    const next = substituteRecordVars(source, scalars)
    // eslint-disable-next-line functional/immutable-data, no-param-reassign -- writing the resolved text into the copy IS the expansion, exactly as in `resolveSlotTokens`
    if (next !== source) text.nodeValue = next
  })
  resolveCopyAttributes(copy, scalars)
  return copy
}

/**
 * Rebuild one host's children from its template, once per element.
 *
 * A non-array — a field the record does not carry, a `json` column holding an
 * object, an empty array — draws ZERO copies rather than the template. Leaving
 * the template would ship `$record.` tokens to the reader as literal text, which
 * reads as "this record has no steps" while in fact naming a field that failed
 * to resolve.
 *
 * The identity guard is not an optimisation. The slot re-resolves after its
 * nested islands mount, with the same record object, and a rebuild there would
 * tear out every marker that pass had just mounted inside a copy.
 */
function expandHost(host: HTMLElement, record: RawRecord, states: RepeatStates): void {
  const previous = states.get(host)
  const source = record[host.getAttribute(REPEAT_ATTRIBUTE) ?? '']
  if (previous !== undefined && previous.source === source) return
  const template = previous?.template ?? host.innerHTML
  states.set(host, { template, source })
  const parsed = host.ownerDocument.createElement('template')
  // eslint-disable-next-line functional/immutable-data -- parsing the AUTHOR's markup, which carries no record data; the copies below are built as text nodes
  parsed.innerHTML = template
  host.replaceChildren(
    ...(Array.isArray(source) ? source.map((element) => buildCopy(parsed, element)) : [])
  )
}

/**
 * Expand every repeating container in the slot.
 *
 * Document order, so an outer host is rebuilt before an inner one — which
 * cannot happen, since a `repeat` inside another is refused at decode, but the
 * order is the safe one either way: the inner host is detached by the outer
 * rebuild and its own pass becomes a no-op rather than resurrecting a subtree.
 */
export function expandSlotRepeats(
  root: HTMLElement,
  record: RawRecord,
  states: RepeatStates
): void {
  root
    .querySelectorAll<HTMLElement>(REPEAT_SELECTOR)
    .forEach((host) => expandHost(host, record, states))
}
