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
 *
 * ─── NAMES, AND A SECOND LEVEL ────────────────────────────────────
 *
 * A host may carry `data-repeat-as`: then a copy's `$<as>.<key>` reads the
 * element and `$record.<key>` keeps reading the drawer's record; without it,
 * `$record.<key>` reads the element as before. A repeat nested in a named one
 * iterates a field of the ENCLOSING element, so it is expanded INSIDE
 * `buildCopy`, against that element, before the copy is inserted — a static
 * query over the slot would never see a host that only exists inside a copy.
 * Only the OUTERMOST hosts carry remembered state: an inner host is rebuilt
 * with the copy that holds it.
 *
 * Every copy resolves ALL its namespaces in one pass per string
 * (`substituteScopedVars`), so a value is never re-scanned for tokens, and the
 * pass stops at an inner host: what is under one belongs to its own scope.
 */

import {
  RECORD_NAMESPACE,
  repeatElementScalars,
  substituteScopedVars,
} from '@/domain/models/app/pages/substitute-record-vars'

type RawRecord = Record<string, unknown>

/** Per namespace, the fields a copy's tokens resolve against. */
type Scopes = Readonly<Record<string, Readonly<RawRecord>>>

/** What one copy resolves against, and the record a nested repeat reads a field of. */
interface CopyScope {
  readonly scopes: Scopes
  readonly nearest: unknown
}

/**
 * The markers a repeating container carries, written at SSR by the `container`
 * renderer (`presentation/render/registry/structural-components.tsx`).
 *
 * Spelled literally on both sides: the render tree and the island tree may not
 * import each other, so `data-island` and `data-drawer-children` are already
 * written twice each, and a shared constant would have to be hoisted into
 * `design/`, which is for class recipes.
 */
export const REPEAT_ATTRIBUTE = 'data-repeat-record'
const REPEAT_AS_ATTRIBUTE = 'data-repeat-as'

/** Hosts to expand, in document order. */
const REPEAT_SELECTOR = `[${REPEAT_ATTRIBUTE}]`

/** Is this node a container that asked to iterate? */
export const isRepeatHost = (node: Node): boolean =>
  node.nodeType === Node.ELEMENT_NODE && (node as Element).hasAttribute(REPEAT_ATTRIBUTE)

/**
 * Every text node under `node`, in document order, not descending into anything
 * `skip` claims.
 *
 * The predicate is what keeps the scopes apart. A copy's tokens are resolved
 * HERE against its own element, and the drawer-scoped pass next door must not
 * then resolve what is left — an object-valued key survives expansion as its
 * own token deliberately, and a second pass would silently turn it into the
 * empty string against a drawer record that has no such field.
 */
export function collectTextNodes(node: Node, skip?: (candidate: Node) => boolean): readonly Text[] {
  if (node.nodeType === Node.TEXT_NODE) return [node as Text]
  if (skip?.(node) === true) return []
  return Array.from(node.childNodes).flatMap((child) => collectTextNodes(child, skip))
}

/** Every element under `node`, an inner host included but not what is under it. */
function collectScopeElements(node: Node): readonly Element[] {
  return Array.from(node.childNodes).flatMap((child) => {
    if (child.nodeType !== Node.ELEMENT_NODE) return []
    const element = child as Element
    return isRepeatHost(element) ? [element] : [element, ...collectScopeElements(element)]
  })
}

/** The hosts under `node` that no other host under `node` encloses. */
function outermostHosts(node: ParentNode & Node): readonly HTMLElement[] {
  return Array.from(node.querySelectorAll<HTMLElement>(REPEAT_SELECTOR)).filter((host) => {
    const enclosing = host.parentElement?.closest(REPEAT_SELECTOR)
    return enclosing === null || enclosing === undefined || !node.contains(enclosing)
  })
}

/** What a host needs to remember between passes. */
interface RepeatState {
  /** The author's children, captured before the first copy replaced them. */
  readonly template: string
  /** The array the copies currently on screen were built from. */
  readonly source: unknown
  /** The record the copies' `$record.` tokens were resolved against. */
  readonly record: RawRecord
}

/** Per-host state, owned by the slot component and threaded through. */
export type RepeatStates = WeakMap<HTMLElement, RepeatState>

/**
 * Resolve the tokens a copy carries in its `data-*` attributes, against the
 * same scopes its text nodes were resolved against.
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
function resolveCopyAttributes(copy: DocumentFragment, scopes: Scopes): void {
  collectScopeElements(copy).forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      const source = attribute.value
      if (!attribute.name.startsWith('data-') || !source.includes('$')) return
      const next = substituteScopedVars(source, scopes)
      if (next !== source) element.setAttribute(attribute.name, next)
    })
  })
}

/** The array a host iterates: a field of the nearest record in scope. */
function hostSource(host: Element, nearest: unknown): unknown {
  if (typeof nearest !== 'object' || nearest === null || Array.isArray(nearest)) return undefined
  return (nearest as RawRecord)[host.getAttribute(REPEAT_ATTRIBUTE) ?? '']
}

/** The scope one copy of `host` resolves against. */
function elementScope(scope: CopyScope, host: Element, element: unknown): CopyScope {
  const namespace = host.getAttribute(REPEAT_AS_ATTRIBUTE) ?? RECORD_NAMESPACE
  return {
    scopes: { ...scope.scopes, [namespace]: repeatElementScalars(element, namespace) },
    nearest: element,
  }
}

/**
 * One copy of the template, resolved against one scope.
 *
 * Inner hosts are filled FIRST, against this copy's element, and the tokens of
 * this copy are resolved after, stepping around them — an unnamed inner repeat's
 * `$record.` means ITS element, which this scope must not consume.
 */
function buildCopy(parsed: HTMLTemplateElement, scope: CopyScope): DocumentFragment {
  const copy = parsed.content.cloneNode(true) as DocumentFragment
  outermostHosts(copy).forEach((inner) =>
    fillHost(inner, inner.innerHTML, hostSource(inner, scope.nearest), scope)
  )
  collectTextNodes(copy, isRepeatHost).forEach((text) => {
    const source = text.nodeValue ?? ''
    if (!source.includes('$')) return
    const next = substituteScopedVars(source, scope.scopes)
    // eslint-disable-next-line functional/immutable-data, no-param-reassign -- writing the resolved text into the copy IS the expansion, exactly as in `resolveSlotTokens`
    if (next !== source) text.nodeValue = next
  })
  resolveCopyAttributes(copy, scope.scopes)
  return copy
}

/**
 * Rebuild one host's children from its template, once per element.
 *
 * A non-array — a field the record does not carry, a `json` column holding an
 * object, an empty array — draws ZERO copies rather than the template, and
 * leaves the host with no child node at all, so a `:empty` rule can style it.
 * Leaving the template would ship its tokens to the reader as literal text,
 * which reads as "this record has no steps" while in fact naming a field that
 * failed to resolve.
 */
function fillHost(host: HTMLElement, template: string, source: unknown, scope: CopyScope): void {
  const parsed = host.ownerDocument.createElement('template')
  // eslint-disable-next-line functional/immutable-data -- parsing the AUTHOR's markup, which carries no record data; the copies below are built as text nodes
  parsed.innerHTML = template
  host.replaceChildren(
    ...(Array.isArray(source)
      ? source.map((element) => buildCopy(parsed, elementScope(scope, host, element)))
      : [])
  )
}

/**
 * Expand one OUTERMOST host against the drawer's record.
 *
 * The identity guard is not an optimisation. The slot re-resolves after its
 * nested islands mount, with the same record object, and a rebuild there would
 * tear out every marker that pass had just mounted inside a copy.
 */
function expandHost(host: HTMLElement, record: RawRecord, states: RepeatStates): void {
  const previous = states.get(host)
  const source = hostSource(host, record)
  if (previous !== undefined && previous.source === source && previous.record === record) return
  const template = previous?.template ?? host.innerHTML
  states.set(host, { template, source, record })
  fillHost(host, template, source, { scopes: { [RECORD_NAMESPACE]: record }, nearest: record })
}

/**
 * Expand every repeating container in the slot — the outermost ones; a nested
 * host is rebuilt by the copy that holds it.
 */
export function expandSlotRepeats(
  root: HTMLElement,
  record: RawRecord,
  states: RepeatStates
): void {
  outermostHosts(root).forEach((host) => expandHost(host, record, states))
}
