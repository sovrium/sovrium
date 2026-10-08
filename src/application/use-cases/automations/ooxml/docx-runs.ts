/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  childElements,
  descendantsNamed,
  isElement,
  ownText,
  replaceElements,
  type XmlElement,
} from './ooxml-tree'

/**
 * Run normalisation: make every `{{…}}` tag of a Word part sit inside ONE
 * `w:t`, so the rest of the engine can treat a tag as a string.
 *
 * Word splits text into runs (`w:r`) wherever formatting, spell-check state or
 * revision history changes, and an author never sees it: `{{client.name}}` can
 * arrive as `{{cli` + `ent.na` (bold) + `me}}`. Within each paragraph, the text
 * of all its `w:t` is read as one string; a tag that crosses `w:t` boundaries
 * is moved whole into the `w:t` where it STARTS, so it takes that run's
 * formatting (`w:rPr`) — the run the author typed `{{` in. The characters it
 * took are removed from the later `w:t`s, an emptied `w:t` is dropped, and a
 * run left holding nothing but its properties is dropped with it.
 *
 * A paragraph with no crossing tag is returned as the same object, so a part
 * with nothing to fix re-serializes byte for byte. A nested paragraph (inside
 * a text box) is a paragraph of its own and is never read into its parent.
 */

/** A tag, triple-stash included. Lazy, so two tags never merge into one. */
const TAG = /\{\{\{?[\s\S]*?\}\}\}?/g

const PARAGRAPH = 'w:p'
const TEXT = 'w:t'
const RUN = 'w:r'
const RUN_PROPERTIES = 'w:rPr'

/** Every paragraph of the part, nested ones included. */
const allParagraphs = (element: XmlElement): ReadonlyArray<XmlElement> =>
  childElements(element).flatMap((child) =>
    child.name === PARAGRAPH ? [child, ...allParagraphs(child)] : allParagraphs(child)
  )

interface Span {
  readonly start: number
  readonly end: number
}

/**
 * The new text of each `w:t` of one paragraph, or `undefined` when no tag in it
 * crosses a `w:t` boundary.
 */
const regroupParagraph = (
  texts: ReadonlyArray<XmlElement>
): ReadonlyArray<readonly [XmlElement, string]> | undefined => {
  const strings = texts.map(ownText)
  const full = strings.join('')
  if (!full.includes('{{')) return undefined
  const starts = strings.reduce<ReadonlyArray<number>>(
    (acc, s, i) => [...acc, (acc[i] ?? 0) + s.length],
    [0]
  )
  const ownerOf = (offset: number): number =>
    starts.findIndex((start, i) => offset >= start && offset < (starts[i + 1] ?? Infinity))
  const crossing: ReadonlyArray<Span> = [...full.matchAll(TAG)]
    .map((m) => ({ start: m.index, end: m.index + m[0].length }))
    .filter((span) => ownerOf(span.start) !== ownerOf(span.end - 1))
  if (crossing.length === 0) return undefined

  const chars = full.split('')
  const owners = chars.map((_char, offset) => {
    const span = crossing.find((s) => offset >= s.start && offset < s.end)
    return ownerOf(span === undefined ? offset : span.start)
  })
  return texts
    .map(
      (text, index) =>
        [text, chars.filter((_char, offset) => owners[offset] === index).join('')] as const
    )
    .filter(([, regroupedText], index) => regroupedText !== strings[index])
}

/** A run whose only content is its properties — what moving its text out leaves. */
const isHollowRun = (run: XmlElement, emptied: ReadonlySet<XmlElement>): boolean =>
  run.children.every(
    (child) =>
      (typeof child === 'string' && child.trim() === '') ||
      (isElement(child) && (child.name === RUN_PROPERTIES || emptied.has(child)))
  ) && run.children.some((child) => isElement(child) && emptied.has(child))

/** Merge every tag Word split across runs, in one Word part. */
export const normaliseSplitTags = (root: XmlElement): XmlElement => {
  const regrouped = allParagraphs(root).flatMap(
    (paragraph) => regroupParagraph(descendantsNamed(paragraph, TEXT, new Set([PARAGRAPH]))) ?? []
  )
  if (regrouped.length === 0) return root
  const changed = new Map(regrouped)
  const emptied = new Set(regrouped.filter(([, text]) => text === '').map(([node]) => node))

  return replaceElements(root, (element) => {
    if (element.name === RUN && isHollowRun(element, emptied)) return []
    if (element.name !== TEXT) return undefined
    const text = changed.get(element)
    if (text === undefined) return undefined
    if (text === '') return []
    // The merged text may now begin or end with a space Word would collapse.
    return [
      {
        ...element,
        attributes: { ...element.attributes, 'xml:space': 'preserve' },
        children: [text],
      },
    ]
  })
}
