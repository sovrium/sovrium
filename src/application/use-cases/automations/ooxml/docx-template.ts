/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { hoistBlockTags, neutraliseTags, repairRenderedPart } from './docx-blocks'
import { normaliseSplitTags } from './docx-runs'
import {
  contentTypesFor,
  fail,
  mainPartName,
  parseEntry,
  stripRelationships,
  unreadable,
  type DocxFillError,
  type Step,
} from './docx-structure'
import {
  DEFAULT_OOXML_PACKAGE_LIMITS,
  entryText,
  readOoxmlPackage,
  textEntry,
  writeOoxmlPackage,
  type OoxmlPackageLimits,
} from './ooxml-package'
import { relsSourceOf, removedIdsOf, type PackageRelationships } from './ooxml-relationships'
import { partMayNeedCleaning, sanitizePartRoot } from './ooxml-sanitize'
import { parseXmlPart, serializeElement, serializePart, type XmlElement } from './ooxml-tree'
import type { ZipEntry } from '../action-handlers/file-zip'
import type { ZipReadEntry } from '../action-handlers/file-zip-read'

/**
 * Fill a Word template (`.docx`, or a `.dotx` template — the output is always a
 * `.docx`) with data. Pure: bytes and data in, bytes out; never throws.
 *
 * The pipeline, per part that carries text — the main document, every header
 * and footer, footnotes and endnotes:
 *
 *   parse (`Bun.XML`, tree) → merge tags Word split across runs → hoist row
 *   loops and tag paragraphs → serialize → render ONCE through `render` →
 *   parse the result (proves it is still XML) → repair what a loop emptied →
 *   strip fetching fields and links to removed relationships → serialize with
 *   the part's own `<?xml?>` declaration.
 *
 * Every other entry is copied byte for byte, except relationship parts, which
 * lose their external targets. The package is written back in
 * its original entry order.
 *
 * ## The `render` contract
 *
 * `render(templateText, data)` is the action's Handlebars renderer in XML mode.
 * It MUST escape every interpolated value for XML. The engine never
 * imports a template engine itself. It hands `render` the whole part as one
 * template and parses what comes back, so a renderer that forgets to escape
 * produces a refusal (`invalid_output`), never a corrupt file.
 */

export const DOCX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export type OoxmlRender = (templateText: string, data: Readonly<Record<string, unknown>>) => string

/**
 * A pass over one rendered part, after repair and before sanitizing — the seam
 * `{{image …}}` will use (P1): its helper renders a marker, and a stage swaps
 * the marker run for a drawing. A stage that needs new media entries will
 * extend this contract; none exists yet.
 */
export type DocxPartStage = (partName: string, root: XmlElement) => XmlElement

export interface DocxFillInput {
  readonly template: Uint8Array
  /** How the template is named in errors: its asset path or bucket key. */
  readonly templateName: string
  readonly data: Readonly<Record<string, unknown>>
  readonly render: OoxmlRender
  readonly limits?: OoxmlPackageLimits
  readonly stages?: ReadonlyArray<DocxPartStage>
}

export type { DocxFillError } from './docx-structure'

export type DocxFillResult =
  | { readonly ok: true; readonly bytes: Uint8Array; readonly contentType: string }
  | { readonly ok: false; readonly error: DocxFillError }

const TEXT_PART = /^(?:header\d*|footer\d*|footnotes|endnotes)\.xml$/

// eslint-disable-next-line no-control-regex -- stripping the characters XML 1.0 cannot carry is the point
const XML_ILLEGAL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g

interface PartJob {
  readonly input: DocxFillInput
  readonly removedIds: ReadonlySet<string>
}

/** Render one text-bearing part end to end. */
const fillPart = (entry: ZipReadEntry, job: PartJob): Step<ZipEntry> => {
  const { input } = job
  const parsed = parseEntry(entry, input.templateName)
  if (!parsed.ok) return parsed
  const template = neutraliseTags(
    serializeElement(hoistBlockTags(normaliseSplitTags(parsed.value.root)))
  )
  const rendered = ((): Step<string> => {
    try {
      return { ok: true, value: input.render(template, input.data).replace(XML_ILLEGAL, '') }
    } catch (error) {
      const why = error instanceof Error ? error.message : String(error)
      return fail(
        'render_failed',
        `template "${input.templateName}" could not be rendered (part ${entry.name}): ${why}`,
        entry.name
      )
    }
  })()
  if (!rendered.ok) return rendered
  const reparsed = parseXmlPart(rendered.value)
  if (!reparsed.ok) {
    return fail(
      'invalid_output',
      `template "${input.templateName}" has block tags in ${entry.name} that do not open and close in the same paragraph, sibling paragraphs or table row`,
      entry.name
    )
  }
  const staged = (input.stages ?? []).reduce(
    (root, stage) => stage(entry.name, root),
    repairRenderedPart(reparsed.part.root)
  )
  const root = sanitizePartRoot(staged, job.removedIds)
  return {
    ok: true,
    value: textEntry(entry.name, serializePart({ prolog: parsed.value.prolog, root })),
  }
}

/** A part not rendered, still cleaned of fetching fields and links to removed relationships. */
const sanitizePart = (entry: ZipReadEntry, job: PartJob): Step<ZipEntry> => {
  const text = entryText(entry)
  if (!partMayNeedCleaning(text, job.removedIds)) return { ok: true, value: entry }
  const parsed = parseEntry(entry, job.input.templateName)
  if (!parsed.ok) return parsed
  const root = sanitizePartRoot(parsed.value.root, job.removedIds)
  return root === parsed.value.root
    ? { ok: true, value: entry }
    : { ok: true, value: textEntry(entry.name, serializePart({ ...parsed.value, root })) }
}

const isXmlPart = (name: string): boolean =>
  name.toLowerCase().endsWith('.xml') && relsSourceOf(name) === undefined

interface PackagePlan {
  readonly input: DocxFillInput
  readonly mainPart: string
  readonly contentTypes: ZipEntry
  readonly relationships: PackageRelationships
}

/** Whether a part carries text the author can tag: the main part, its headers, footers and notes. */
const isTextPart = (name: string, mainPart: string): boolean => {
  const wordDir = mainPart.slice(0, mainPart.lastIndexOf('/') + 1)
  return (
    name === mainPart || (name.startsWith(wordDir) && TEXT_PART.test(name.slice(wordDir.length)))
  )
}

/** What one entry of the package becomes. */
const writeEntry = (entry: ZipReadEntry, plan: PackagePlan): Step<ZipEntry> => {
  if (entry.name === '[Content_Types].xml') return { ok: true, value: plan.contentTypes }
  const rels = plan.relationships.rewritten.get(entry.name)
  if (rels !== undefined) return { ok: true, value: rels }
  if (!isXmlPart(entry.name)) return { ok: true, value: entry }
  const job = {
    input: plan.input,
    removedIds: removedIdsOf(plan.relationships, entry.name),
  }
  return isTextPart(entry.name, plan.mainPart) ? fillPart(entry, job) : sanitizePart(entry, job)
}

/** Fill a Word template with `data`. See the module comment for the pipeline. */
export const fillDocxTemplate = (input: DocxFillInput): DocxFillResult => {
  const read = readOoxmlPackage(input.template, input.limits ?? DEFAULT_OOXML_PACKAGE_LIMITS)
  if (!read.ok) return unreadable(read, input.templateName)
  const { entries } = read
  const main = mainPartName(entries, input.templateName)
  if (!main.ok) return main
  const contentTypes = contentTypesFor(entries, main.value, input.templateName)
  if (!contentTypes.ok) return contentTypes
  const relationships = stripRelationships(entries, input.templateName)
  if (!relationships.ok) return relationships

  const plan: PackagePlan = {
    input,
    mainPart: main.value,
    contentTypes: contentTypes.value,
    relationships: relationships.value,
  }
  const written = entries.map((entry) => writeEntry(entry, plan))
  const failed = written.find((step) => !step.ok)
  if (failed !== undefined && !failed.ok) return failed
  return {
    ok: true,
    bytes: writeOoxmlPackage(written.flatMap((step) => (step.ok ? [step.value] : []))),
    contentType: DOCX_CONTENT_TYPE,
  }
}
