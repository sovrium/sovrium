/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The XML tree every OOXML part is edited as — `Bun.XML` in tree mode
 * (`{ compact: false }`), read-only on this side.
 *
 * ## Fidelity, measured ([internal ref] E3, re-checked here)
 *
 * `parse` → `stringify` reproduces a Word part byte for byte except in two
 * places, both handled in this module:
 *
 *  - the `<?xml …?>` declaration is never represented, so `splitProlog` keeps
 *    the original text and `serializePart` puts it back verbatim;
 *  - an empty element written `<a></a>` comes back as `<a/>` — the same infoset,
 *    so Word and LibreOffice read both alike.
 *
 * Character data is DECODED in the tree (`&amp;` is `&`), and `stringify`
 * re-escapes `& < >` on the way out. That is why the tree is never edited with
 * strings of markup: a value placed in a text node can only ever be text.
 *
 * ## No document type declaration
 *
 * An OOXML part never carries a DTD (ECMA-376 Part 2 forbids it). `Bun.XML`
 * reads no external entity and caps internal expansion, but a part that
 * declares one is refused outright rather than trusted to those limits.
 */

export interface XmlComment {
  readonly comment: string
}

export interface XmlInstruction {
  readonly target: string
  readonly data: string
}

export interface XmlElement {
  readonly name: string
  readonly attributes: Readonly<Record<string, string>>
  readonly children: ReadonlyArray<XmlChild>
}

export type XmlChild = string | XmlElement | XmlComment | XmlInstruction

export const isElement = (child: XmlChild): child is XmlElement =>
  typeof child === 'object' && 'name' in child

/** The element's child elements, text and comments left out. */
export const childElements = (element: XmlElement): ReadonlyArray<XmlElement> =>
  element.children.filter(isElement)

/** A copy of `element` with new children — the only way this module edits a node. */
export const withChildren = (
  element: XmlElement,
  children: ReadonlyArray<XmlChild>
): XmlElement => ({ ...element, children })

/**
 * Every descendant element named `name`, in document order, NOT descending
 * into an element named in `stopAt` (a nested paragraph or table, processed in
 * its own right).
 */
export const descendantsNamed = (
  element: XmlElement,
  name: string,
  stopAt: ReadonlySet<string> = new Set()
): ReadonlyArray<XmlElement> =>
  childElements(element).flatMap((child) => {
    if (child.name === name) return [child]
    if (stopAt.has(child.name)) return []
    return descendantsNamed(child, name, stopAt)
  })

/** The concatenated character data directly inside an element (a `w:t`). */
export const ownText = (element: XmlElement): string =>
  element.children.filter((c): c is string => typeof c === 'string').join('')

/**
 * Rebuild a tree bottom-up: `visit` sees each element with its children ALREADY
 * rewritten and returns what replaces it — zero, one or several children (a
 * removed paragraph, a row with a loop tag hoisted beside it).
 */
export const rewriteTree = (
  element: XmlElement,
  visit: (element: XmlElement) => ReadonlyArray<XmlChild>
): ReadonlyArray<XmlChild> =>
  visit(
    withChildren(
      element,
      element.children.flatMap((child) => (isElement(child) ? rewriteTree(child, visit) : [child]))
    )
  )

/** `rewriteTree` for a root, which must stay exactly one element. */
export const rewriteRoot = (
  root: XmlElement,
  visit: (element: XmlElement) => ReadonlyArray<XmlChild>
): XmlElement => {
  const rewritten = rewriteTree(root, visit).filter(isElement)
  return rewritten[0] ?? root
}

/**
 * Rebuild a tree top-down: `replace` sees each ORIGINAL descendant element
 * (identity intact, so a `Set` of nodes found by an earlier walk matches) and
 * returns its replacement, or `undefined` to keep it and descend. A subtree
 * nothing replaces is returned as the same object.
 */
export const replaceElements = (
  root: XmlElement,
  replace: (element: XmlElement) => ReadonlyArray<XmlChild> | undefined
): XmlElement => {
  const children = root.children.flatMap((child): ReadonlyArray<XmlChild> => {
    if (!isElement(child)) return [child]
    return replace(child) ?? [replaceElements(child, replace)]
  })
  const unchanged =
    children.length === root.children.length && children.every((c, i) => c === root.children[i])
  return unchanged ? root : withChildren(root, children)
}

// ---------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------

/** One XML part, parsed, with the declaration text it had. */
export interface ParsedPart {
  readonly prolog: string
  readonly root: XmlElement
}

export type PartParseResult =
  | { readonly ok: true; readonly part: ParsedPart }
  | { readonly ok: false; readonly message: string }

/**
 * `<?xml …?>` plus the whitespace after it, and an optional byte-order mark —
 * kept as written so the part re-serializes with the same declaration.
 */
const PROLOG = /^\uFEFF?<\?xml[^?]*\?>[\t\n\r ]*/

export const splitProlog = (xml: string): { readonly prolog: string; readonly body: string } => {
  const match = PROLOG.exec(xml)
  return match === null
    ? { prolog: '', body: xml }
    : { prolog: match[0], body: xml.slice(match[0].length) }
}

const DOCTYPE = /<!DOCTYPE/i

/** Parse one XML part of a package. Never throws. */
export const parseXmlPart = (xml: string): PartParseResult => {
  if (DOCTYPE.test(xml)) {
    return { ok: false, message: 'declares a document type, which no Office part may carry' }
  }
  const { prolog, body } = splitProlog(xml)
  try {
    const root: XmlElement = Bun.XML.parse(body, { compact: false })
    return { ok: true, part: { prolog, root } }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) }
  }
}

/** Serialize a root element only — no declaration. */
export const serializeElement = (root: XmlElement): string =>
  // `stringify` types its input with mutable arrays; it never writes to them.
  Bun.XML.stringify(root as Bun.XML.NodeInput) ?? ''

/** Serialize a part back to its text, its original declaration first. */
export const serializePart = (part: ParsedPart): string =>
  `${part.prolog}${serializeElement(part.root)}`
