/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { WORD_PAGE_BREAK_MARKER } from '@/application/ports/services/template-engine'
import { entryText, readOoxmlPackage, textEntry, writeOoxmlPackage } from './ooxml-package'
import {
  childElements,
  ownText,
  replaceElements,
  type XmlChild,
  type XmlElement,
} from './ooxml-tree'
import type { DocxPartStage } from './docx-template'
import type { ZipEntry } from '../action-handlers/file-zip'
import type { ZipReadEntry } from '../action-handlers/file-zip-read'

/**
 * `{{pageBreak}}` and `{{image}}` in a Word template.
 *
 * Both helpers print a marker into the run they stand in (the template engine
 * cannot write OOXML into a `<w:t>`); the {@link docxMarkerStage} — a pass of
 * the fill's `stages` seam — swaps each marker for what Word reads: a run
 * holding `<w:br w:type="page"/>`, or a run holding an inline drawing of the
 * picture at its size. A drawing names its picture through a relationship,
 * so {@link addDocxPictures} then writes the picture bytes into
 * `word/media/`, their relationships (internal, never `External`) beside the
 * part that draws them, and the content type of each picture kind.
 */

/** A picture to draw: its bytes, type, and size in pixels (96 dpi). */
export interface DocxPicture {
  readonly bytes: Uint8Array
  readonly contentType: string
  readonly width: number
  readonly height: number
}

const EMU_PER_PIXEL = 9525
const RELATIONSHIP_PREFIX = 'rIdSovriumPicture'
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const IMAGE_REL = `${REL_NS}/image`
const MARKER_SPLIT = /(\uE000(?:P[\w-]+|B)\uE001)/
const PICTURE_MARKER = /\uE000P([\w-]+)\uE001/g

/**
 * What a Word part holds where `{{image}}` stood: the request itself,
 * encoded, so the pictures a filled package asks for can be read back off it
 * ({@link docxPictureRequests}) and a second fill can place them by that key.
 */
export const docxPictureMarker = (request: unknown): string =>
  `\uE000P${Buffer.from(JSON.stringify(request)).toString('base64url')}\uE001`

/** Every picture a filled package asks for, by its marker key, in first-seen order. */
export const docxPictureRequests = (
  bytes: Uint8Array
): ReadonlyArray<readonly [string, unknown]> => {
  const read = readOoxmlPackage(bytes)
  if (!read.ok) return []
  const keys = new Set(
    read.entries
      .filter((entry) => entry.name.endsWith('.xml'))
      .flatMap((entry) => [...entryText(entry).matchAll(PICTURE_MARKER)].map((m) => m[1] ?? ''))
  )
  return [...keys].map(
    (key) => [key, JSON.parse(Buffer.from(key, 'base64url').toString('utf8')) as unknown] as const
  )
}

const extensionOf = (contentType: string): string => {
  const subtype = contentType.slice(contentType.indexOf('/') + 1)
  return subtype === 'jpeg' ? 'jpg' : subtype
}

const mediaName = (index: number, picture: DocxPicture): string =>
  `sovrium-picture-${index}.${extensionOf(picture.contentType)}`

const element = (
  name: string,
  attributes: Readonly<Record<string, string>> = {},
  children: ReadonlyArray<XmlChild> = []
): XmlElement => ({ name, attributes, children })

/** The `pic:pic` element of picture `index`: its relationship and its box. */
const pictureElement = (index: number, picture: DocxPicture, cx: string, cy: string) =>
  element('pic:pic', { 'xmlns:pic': 'http://schemas.openxmlformats.org/drawingml/2006/picture' }, [
    element('pic:nvPicPr', {}, [
      element('pic:cNvPr', { id: '0', name: mediaName(index, picture) }),
      element('pic:cNvPicPr'),
    ]),
    element('pic:blipFill', {}, [
      element('a:blip', { 'xmlns:r': REL_NS, 'r:embed': `${RELATIONSHIP_PREFIX}${index}` }),
      element('a:stretch', {}, [element('a:fillRect')]),
    ]),
    element('pic:spPr', {}, [
      element('a:xfrm', {}, [element('a:off', { x: '0', y: '0' }), element('a:ext', { cx, cy })]),
      element('a:prstGeom', { prst: 'rect' }, [element('a:avLst')]),
    ]),
  ])

/** The inline drawing of picture `index`, at its size (EMU, at 96 dpi). */
const drawingOf = (index: number, picture: DocxPicture): XmlElement => {
  const cx = String(Math.round(picture.width * EMU_PER_PIXEL))
  const cy = String(Math.round(picture.height * EMU_PER_PIXEL))
  const inline = {
    'xmlns:wp': 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
    distT: '0',
    distB: '0',
    distL: '0',
    distR: '0',
  }
  return element('w:drawing', {}, [
    element('wp:inline', inline, [
      element('wp:extent', { cx, cy }),
      element('wp:docPr', { id: String(4000 + index), name: `Picture ${index + 1}` }),
      element('a:graphic', { 'xmlns:a': 'http://schemas.openxmlformats.org/drawingml/2006/main' }, [
        element(
          'a:graphicData',
          { uri: 'http://schemas.openxmlformats.org/drawingml/2006/picture' },
          [pictureElement(index, picture, cx, cy)]
        ),
      ]),
    ]),
  ])
}

/** The text a run carries in its `w:t` elements. */
const runText = (run: XmlElement): string =>
  childElements(run)
    .filter((child) => child.name === 'w:t')
    .map(ownText)
    .join('')

/** One run per piece of a marked run: its text pieces, its page breaks, its drawings. */
const splitMarkedRun = (
  run: XmlElement,
  keys: ReadonlyArray<string>,
  pictures: ReadonlyArray<DocxPicture>
): ReadonlyArray<XmlChild> => {
  const properties = childElements(run).filter((child) => child.name === 'w:rPr')
  return runText(run)
    .split(MARKER_SPLIT)
    .filter((piece) => piece !== '')
    .flatMap((piece): ReadonlyArray<XmlElement> => {
      if (piece === WORD_PAGE_BREAK_MARKER) {
        return [element('w:r', run.attributes, [element('w:br', { 'w:type': 'page' })])]
      }
      const key = /^\uE000P([\w-]+)\uE001$/.exec(piece)?.[1]
      if (key !== undefined) {
        const index = keys.indexOf(key)
        const picture = pictures[index]
        // Not given yet (the first fill): kept as written, to be read back off the package.
        if (picture !== undefined) {
          return [element('w:r', run.attributes, [...properties, drawingOf(index, picture)])]
        }
      }
      return [
        element('w:r', run.attributes, [
          ...properties,
          element('w:t', { 'xml:space': 'preserve' }, [piece]),
        ]),
      ]
    })
}

/**
 * The fill stage that turns markers into page breaks and drawings:
 * `pictures[i]` is drawn where the marker `keys[i]` stands; a picture marker
 * the stage is not given a picture for is kept as text, for the first of the
 * two fills to report.
 */
export const docxMarkerStage =
  (keys: ReadonlyArray<string>, pictures: ReadonlyArray<DocxPicture>): DocxPartStage =>
  (_partName, root) =>
    replaceElements(root, (candidate) =>
      candidate.name === 'w:r' && MARKER_SPLIT.test(runText(candidate))
        ? splitMarkedRun(candidate, keys, pictures)
        : undefined
    )

/** `word/document.xml` → `word/_rels/document.xml.rels`. */
const relsNameOf = (partName: string): string => {
  const slash = partName.lastIndexOf('/')
  return `${partName.slice(0, slash + 1)}_rels/${partName.slice(slash + 1)}.rels`
}

const EMPTY_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>'

const insertBefore = (xml: string, closing: string, addition: string): string => {
  const at = xml.lastIndexOf(closing)
  return at < 0 ? xml : `${xml.slice(0, at)}${addition}${xml.slice(at)}`
}

const EMBEDDED = new RegExp(`r:embed="${RELATIONSHIP_PREFIX}(\\d+)"`, 'g')

/** The relationships part beside each XML part that draws a picture, with the rows it needs. */
const relationshipsNeeded = (
  entries: ReadonlyArray<ZipReadEntry>,
  pictures: ReadonlyArray<DocxPicture>
): ReadonlyMap<string, string> =>
  new Map(
    entries
      .filter((entry) => entry.name.endsWith('.xml'))
      .map((entry) => {
        const indices = [...entryText(entry).matchAll(EMBEDDED)].map((match) => Number(match[1]))
        const rows = indices.flatMap((index) => {
          const picture = pictures[index]
          return picture === undefined
            ? []
            : [
                `<Relationship Id="${RELATIONSHIP_PREFIX}${index}" Type="${IMAGE_REL}" Target="media/${mediaName(index, picture)}"/>`,
              ]
        })
        return [relsNameOf(entry.name), rows.join('')] as const
      })
      .filter(([, rows]) => rows !== '')
  )

/** The content-type defaults the pictures' kinds need that `contentTypes` lacks. */
const typesNeeded = (contentTypes: string, pictures: ReadonlyArray<DocxPicture>): string =>
  [...new Set(pictures.map((p) => p.contentType))]
    .filter((type) => !contentTypes.includes(`Extension="${extensionOf(type)}"`))
    .map((type) => `<Default Extension="${extensionOf(type)}" ContentType="${type}"/>`)
    .join('')

/**
 * Write the pictures a filled package draws: their bytes under `word/media/`,
 * an internal relationship beside each part that names one, and a content
 * type for each picture kind. A package drawing none is returned unchanged.
 */
export const addDocxPictures = (
  bytes: Uint8Array,
  pictures: ReadonlyArray<DocxPicture>
): Uint8Array => {
  if (pictures.length === 0) return bytes
  const read = readOoxmlPackage(bytes)
  if (!read.ok) return bytes
  const relsFor = relationshipsNeeded(read.entries, pictures)
  const rewritten = read.entries.map((entry): ZipEntry => {
    const rows = relsFor.get(entry.name)
    if (rows !== undefined) {
      return textEntry(entry.name, insertBefore(entryText(entry), '</Relationships>', rows))
    }
    if (entry.name !== '[Content_Types].xml') return entry
    const text = entryText(entry)
    return textEntry(entry.name, insertBefore(text, '</Types>', typesNeeded(text, pictures)))
  })
  const existing = new Set(read.entries.map((entry) => entry.name))
  const newRels = [...relsFor]
    .filter(([name]) => !existing.has(name))
    .map(([name, rows]) => textEntry(name, insertBefore(EMPTY_RELS, '</Relationships>', rows)))
  const media = pictures.map((picture, index): ZipEntry => ({
    name: `word/media/${mediaName(index, picture)}`,
    bytes: picture.bytes,
  }))
  return writeOoxmlPackage([...rewritten, ...newRels, ...media])
}
