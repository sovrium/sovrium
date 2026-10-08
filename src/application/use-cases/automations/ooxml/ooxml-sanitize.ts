/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  childElements,
  isElement,
  ownText,
  replaceElements,
  rewriteRoot,
  withChildren,
  type XmlChild,
  type XmlElement,
} from './ooxml-tree'

/**
 * Take out of a package everything that makes a CONSUMER of the file reach the
 * network. A template is the author's, but it may arrive from a
 * bucket, and the output goes on to LibreOffice for a PDF: a part that names a
 * URL is an SSRF the sidecar runs, not Sovrium.
 *
 *  - **External relationships** (`TargetMode="External"`) — linked images,
 *    frames, attached templates, sub-documents, OLE links. All are removed,
 *    with ONE exception: a hyperlink whose target
 *    is `http:`, `https:` or `mailto:` is kept. A converter never follows a
 *    link, it only writes it into the PDF, so a web or mail link is no fetch.
 *    A hyperlink to any other scheme (`file:`, `javascript:`, `data:`, a UNC
 *    `\\host` path …) is removed like the rest. A reference to a removed
 *    relationship (`r:id`, `r:link`, `r:embed` …) is dropped from the parts so
 *    Word does not report the file as damaged; a hyperlink keeps its text and
 *    loses its target.
 *  - **Fetching field codes** — `INCLUDETEXT`, `INCLUDEPICTURE`, and the older
 *    `INCLUDE`, `IMPORT`, `LINK`, `DDE`, `DDEAUTO`. A simple field is unwrapped
 *    to its displayed result; a complex field keeps its result runs and loses
 *    its instruction text, so nothing is left to re-evaluate.
 *  - **Linked media** — a DrawingML picture's `r:link` and a VML picture's
 *    `r:href` name an image to FETCH, never one the package holds, and either
 *    may point at a web hyperlink the first rule kept. Both are dropped, as
 *    are a VML element's `o:href` and an absolute `src` URL, which name the
 *    image by address with no relationship at all.
 *
 * Every element and attribute is recognised by its NAMESPACE, never by the
 * prefix the author happened to write: a part that binds WordprocessingML to
 * `x:` instead of `w:` is read exactly as Word and LibreOffice read it.
 */

const RELATIONSHIPS_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

/** Transitional and strict spellings of each namespace the sanitizer reads. */
const RELATIONSHIPS_NAMESPACES: ReadonlySet<string> = new Set([
  RELATIONSHIPS_NS,
  'http://purl.oclc.org/ooxml/officeDocument/relationships',
])
const WORD_NAMESPACES: ReadonlySet<string> = new Set([
  'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  'http://purl.oclc.org/ooxml/wordprocessingml/main',
])
const VML_NAMESPACES: ReadonlySet<string> = new Set(['urn:schemas-microsoft-com:vml'])
const OFFICE_NAMESPACES: ReadonlySet<string> = new Set(['urn:schemas-microsoft-com:office:office'])

const FETCHING_FIELD = /^\s*(?:INCLUDETEXT|INCLUDEPICTURE|INCLUDE|IMPORT|LINK|DDEAUTO|DDE)\b/i

// ---------------------------------------------------------------------------
// Relationships
// ---------------------------------------------------------------------------

export interface StrippedRelationships {
  readonly root: XmlElement
  readonly removedIds: ReadonlySet<string>
}

/** The hyperlink relationship type, transitional and strict spellings. */
const HYPERLINK_TYPES: ReadonlySet<string> = new Set([
  `${RELATIONSHIPS_NS}/hyperlink`,
  'http://purl.oclc.org/ooxml/officeDocument/relationships/hyperlink',
])

const SAFE_LINK_SCHEME = /^(?:https?|mailto):/i

/** A web or mail hyperlink: the one external relationship a package keeps. */
const isSafeHyperlink = (relationship: XmlElement): boolean =>
  HYPERLINK_TYPES.has(relationship.attributes['Type'] ?? '') &&
  SAFE_LINK_SCHEME.test((relationship.attributes['Target'] ?? '').trim())

const isExternal = (child: XmlChild): child is XmlElement =>
  isElement(child) &&
  localName(child.name) === 'Relationship' &&
  (child.attributes['TargetMode'] ?? '').toLowerCase() === 'external' &&
  !isSafeHyperlink(child)

/** Remove every external `<Relationship>` but web and mail hyperlinks from a `*.rels` part. */
export const stripExternalRelationships = (rels: XmlElement): StrippedRelationships => {
  const removed = rels.children.filter(isExternal)
  return {
    root: withChildren(
      rels,
      rels.children.filter((child) => !isExternal(child))
    ),
    removedIds: new Set(removed.map((r) => r.attributes['Id'] ?? '')),
  }
}

// ---------------------------------------------------------------------------
// Namespaces
// ---------------------------------------------------------------------------

const prefixOf = (qualified: string): string => {
  const colon = qualified.indexOf(':')
  return colon === -1 ? '' : qualified.slice(0, colon)
}

const localName = (qualified: string): string => qualified.slice(qualified.indexOf(':') + 1)

/** The namespace declarations of an element and all its descendants, flattened. */
const declarations = (element: XmlElement): ReadonlyArray<readonly [string, string]> => [
  ...Object.entries(element.attributes).filter(
    ([name]) => name === 'xmlns' || name.startsWith('xmlns:')
  ),
  ...childElements(element).flatMap(declarations),
]

/**
 * Every prefix the part binds, ON ANY ELEMENT, to one of `uris` — `''` for a
 * default namespace — plus the conventional prefix, which a part may use
 * without declaring. Reading the whole part over-matches a prefix re-bound in
 * a subtree; for a sanitizer that only means cleaning slightly more.
 */
const prefixesBoundTo = (
  root: XmlElement,
  uris: ReadonlySet<string>,
  conventional: string
): ReadonlySet<string> =>
  new Set([
    conventional,
    ...declarations(root)
      .filter(([, uri]) => uris.has(uri.trim()))
      .map(([name]) => (name === 'xmlns' ? '' : name.slice('xmlns:'.length))),
  ])

/** Whether a qualified element name is `local` in one of the namespaces `prefixes` stand for. */
const isNamed = (qualified: string, prefixes: ReadonlySet<string>, local: string): boolean =>
  localName(qualified) === local && prefixes.has(prefixOf(qualified))

/** An attribute's value read by namespace; an unprefixed spelling counts too (over-match). */
const attributeIn = (
  element: XmlElement,
  prefixes: ReadonlySet<string>,
  local: string
): string | undefined =>
  Object.entries(element.attributes).find(
    ([name]) => localName(name) === local && (!name.includes(':') || prefixes.has(prefixOf(name)))
  )?.[1]

/** An element with the attributes `drop` names removed; the same object when none is. */
const withoutAttributes = (
  element: XmlElement,
  drop: (name: string, value: string) => boolean
): XmlElement =>
  Object.entries(element.attributes).some(([name, value]) => drop(name, value))
    ? {
        ...element,
        attributes: Object.fromEntries(
          Object.entries(element.attributes).filter(([name, value]) => !drop(name, value))
        ),
      }
    : element

/**
 * Drop every relationship-namespace attribute that points at a removed id, in
 * one part. Untouched when the part names none of them.
 */
export const dropRelationshipReferences = (
  root: XmlElement,
  removedIds: ReadonlySet<string>
): XmlElement => {
  if (removedIds.size === 0) return root
  const prefixes = prefixesBoundTo(root, RELATIONSHIPS_NAMESPACES, 'r')
  const pointsAtRemoved = (name: string, value: string): boolean =>
    name.includes(':') && removedIds.has(value) && prefixes.has(prefixOf(name))
  return rewriteRoot(root, (element) => [withoutAttributes(element, pointsAtRemoved)])
}

/** An absolute URL (`scheme:`) or a UNC path (`\\host`, `//host`): an address, not a part. */
const ABSOLUTE_ADDRESS = /^\s*(?:[a-z][a-z0-9+.-]*:|[\\/]{2})/i

/**
 * Drop every attribute that names an image to fetch: `r:link` / `r:href` in any
 * element, and on a VML element its `o:href` and an absolute `src`.
 */
export const stripLinkedMedia = (root: XmlElement): XmlElement => {
  const relationships = prefixesBoundTo(root, RELATIONSHIPS_NAMESPACES, 'r')
  const vml = prefixesBoundTo(root, VML_NAMESPACES, 'v')
  const office = prefixesBoundTo(root, OFFICE_NAMESPACES, 'o')
  return rewriteRoot(root, (element) => {
    const isVml = vml.has(prefixOf(element.name))
    return [
      withoutAttributes(element, (name, value) => {
        const local = localName(name)
        const prefix = prefixOf(name)
        if (name.includes(':') && relationships.has(prefix))
          return local === 'link' || local === 'href'
        if (name.includes(':') && office.has(prefix)) return local === 'href'
        return isVml && name === 'src' && ABSOLUTE_ADDRESS.test(value)
      }),
    ]
  })
}

// ---------------------------------------------------------------------------
// Field codes
// ---------------------------------------------------------------------------

interface FieldWalk {
  /** Nesting of the complex fields open at this point, innermost last. */
  readonly open: ReadonlyArray<{
    readonly instr: ReadonlyArray<XmlElement>
    readonly inInstruction: boolean
  }>
  /** Instruction elements of the fields already found to fetch. */
  readonly blanked: ReadonlyArray<XmlElement>
}

/** The prefixes WordprocessingML is written with in one part. */
type WordPrefixes = ReadonlySet<string>

/** Close the innermost field: its instruction is judged as a whole, then dropped. */
const closeField = (walk: FieldWalk): FieldWalk => {
  const field = walk.open.at(-1)
  if (field === undefined) return walk
  const instruction = field.instr.map(ownText).join('')
  return {
    open: walk.open.slice(0, -1),
    blanked: FETCHING_FIELD.test(instruction) ? [...walk.blanked, ...field.instr] : walk.blanked,
  }
}

/** Advance the walk over one `w:fldChar` or `w:instrText`, in document order. */
const stepField =
  (w: WordPrefixes) =>
  (walk: FieldWalk, element: XmlElement): FieldWalk => {
    if (isNamed(element.name, w, 'instrText')) {
      const field = walk.open.at(-1)
      if (field === undefined || !field.inInstruction) return walk
      return {
        ...walk,
        open: [...walk.open.slice(0, -1), { ...field, instr: [...field.instr, element] }],
      }
    }
    const type = attributeIn(element, w, 'fldCharType') ?? ''
    if (type === 'begin') {
      return { ...walk, open: [...walk.open, { instr: [], inInstruction: true }] }
    }
    if (type === 'separate') {
      const field = walk.open.at(-1)
      return field === undefined
        ? walk
        : { ...walk, open: [...walk.open.slice(0, -1), { ...field, inInstruction: false }] }
    }
    return type === 'end' ? closeField(walk) : walk
  }

/** In document order: every `w:fldChar` and `w:instrText` of the part. */
const fieldMarkers = (element: XmlElement, w: WordPrefixes): ReadonlyArray<XmlElement> =>
  element.children
    .filter(isElement)
    .flatMap((child) =>
      isNamed(child.name, w, 'fldChar') || isNamed(child.name, w, 'instrText')
        ? [child]
        : fieldMarkers(child, w)
    )

/** Neutralize every field that would fetch, in one Word part. */
export const stripFetchingFields = (root: XmlElement): XmlElement => {
  const w = prefixesBoundTo(root, WORD_NAMESPACES, 'w')
  const markers = fieldMarkers(root, w)
  const blanked = new Set(
    markers.reduce<FieldWalk>(stepField(w), { open: [], blanked: [] }).blanked
  )
  return replaceElements(root, (element) => {
    if (blanked.has(element)) return [withChildren(element, [])]
    if (
      isNamed(element.name, w, 'fldSimple') &&
      FETCHING_FIELD.test(attributeIn(element, w, 'instr') ?? '')
    ) {
      return element.children
    }
    return undefined
  })
}

/**
 * Element and attribute NAMES cannot be written as character references, so
 * a part none of whose text matches this needs no cleaning beyond the
 * relationships it lost — a sound prefilter, unlike one on attribute values.
 */
const MAY_NEED_CLEANING = /instrText|fldSimple|:link\s*=|:href\s*=|\bsrc\s*=/

/** Whether a part's text may hold something {@link sanitizePartRoot} would remove. */
export const partMayNeedCleaning = (text: string, removedIds: ReadonlySet<string>): boolean =>
  removedIds.size > 0 || MAY_NEED_CLEANING.test(text)

/** One part cleaned of fetching fields, linked media and references to removed relationships. */
export const sanitizePartRoot = (root: XmlElement, removedIds: ReadonlySet<string>): XmlElement =>
  stripLinkedMedia(dropRelationshipReferences(stripFetchingFields(root), removedIds))
