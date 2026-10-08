/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { entryText, textEntry } from './ooxml-package'
import { stripPackageRelationships, type PackageRelationships } from './ooxml-relationships'
import {
  childElements,
  parseXmlPart,
  serializePart,
  type ParsedPart,
  type XmlElement,
} from './ooxml-tree'
import type { ZipEntry } from '../action-handlers/file-zip'
import type { ZipReadEntry } from '../action-handlers/file-zip-read'

/**
 * The package half of filling a Word template: what the package IS before
 * any part is rendered. It finds the main document part, checks the package
 * is a Word document or template (never a workbook or a macro-enabled file),
 * turns a template's content type into a document's, and strips every
 * external relationship, recording which ids each part lost so the fill can
 * drop the references to them. Pure; every refusal is a {@link Step} naming
 * the template. `docx-template.ts` composes this with the per-part fill.
 */

export type DocxFillErrorReason =
  'not_a_docx' | 'macro_enabled' | 'package_too_large' | 'render_failed' | 'invalid_output'

export interface DocxFillError {
  readonly reason: DocxFillErrorReason
  /** A sentence naming the template, and the part when one is at fault. */
  readonly message: string
  readonly part?: string
}

/** One stage of the fill: its value, or the refusal that stops it. */
export type Step<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: DocxFillError }

export const fail = (reason: DocxFillErrorReason, message: string, part?: string): Step<never> => ({
  ok: false,
  error: part === undefined ? { reason, message } : { reason, message, part },
})

const MAIN_TYPE = 'wordprocessingml.document.main+xml'
const TEMPLATE_TYPE = 'wordprocessingml.template.main+xml'
const OFFICE_DOCUMENT_REL = '/officeDocument'

const findEntry = (entries: ReadonlyArray<ZipReadEntry>, name: string): ZipReadEntry | undefined =>
  entries.find((entry) => entry.name === name)

export const parseEntry = (entry: ZipReadEntry, templateName: string): Step<ParsedPart> => {
  const parsed = parseXmlPart(entryText(entry))
  return parsed.ok
    ? { ok: true, value: parsed.part }
    : fail(
        'not_a_docx',
        `template "${templateName}" is not a valid Word document (.docx): part ${entry.name} ${parsed.message}`,
        entry.name
      )
}

/** The main document part, from the package relationships (`word/document.xml` in practice). */
export const mainPartName = (
  entries: ReadonlyArray<ZipReadEntry>,
  templateName: string
): Step<string> => {
  const rels = findEntry(entries, '_rels/.rels')
  const parsed = rels === undefined ? undefined : parseEntry(rels, templateName)
  const target =
    parsed?.ok === true
      ? childElements(parsed.value.root).find((r) =>
          (r.attributes['Type'] ?? '').endsWith(OFFICE_DOCUMENT_REL)
        )?.attributes['Target']
      : undefined
  const name = (target ?? 'word/document.xml').replace(/^\//, '')
  return findEntry(entries, name) === undefined
    ? fail(
        'not_a_docx',
        `template "${templateName}" is not a Word document (.docx): it has no main document part`
      )
    : { ok: true, value: name }
}

/** `[Content_Types].xml` with the template's main part re-typed as a document's. */
const retypeAsDocument = (
  name: string,
  part: ParsedPart,
  override: XmlElement | undefined
): ZipEntry => {
  const { root } = part
  const retyped: XmlElement = {
    ...root,
    children: root.children.map((child) =>
      child === override
        ? {
            ...override,
            attributes: {
              ...override.attributes,
              ContentType: (override.attributes['ContentType'] ?? '').replace(
                TEMPLATE_TYPE,
                MAIN_TYPE
              ),
            },
          }
        : child
    ),
  }
  return textEntry(name, serializePart({ ...part, root: retyped }))
}

/**
 * Check the main part is a Word document or template (not a workbook, not a
 * macro-enabled file), and turn a template's content type into a document's.
 */
export const contentTypesFor = (
  entries: ReadonlyArray<ZipReadEntry>,
  mainPart: string,
  templateName: string
): Step<ZipEntry> => {
  const entry = findEntry(entries, '[Content_Types].xml')
  if (entry === undefined) {
    return fail(
      'not_a_docx',
      `template "${templateName}" is not a Word document (.docx): it has no [Content_Types].xml`
    )
  }
  const parsed = parseEntry(entry, templateName)
  if (!parsed.ok) return parsed
  const override = childElements(parsed.value.root).find(
    (o) => o.name === 'Override' && o.attributes['PartName'] === `/${mainPart}`
  )
  const type = override?.attributes['ContentType'] ?? ''
  if (/macroEnabled/i.test(type)) {
    return fail(
      'macro_enabled',
      `template "${templateName}" is a macro-enabled Word file (.docm/.dotm); use a .docx or .dotx`
    )
  }
  if (type.endsWith(MAIN_TYPE)) return { ok: true, value: entry }
  if (!type.endsWith(TEMPLATE_TYPE)) {
    return fail(
      'not_a_docx',
      `template "${templateName}" is not a Word document (.docx): its main part is ${type || 'untyped'}`
    )
  }
  return { ok: true, value: retypeAsDocument(entry.name, parsed.value, override) }
}

/** Every relationship part, external targets removed; and which ids each source part lost. */
export const stripRelationships = (
  entries: ReadonlyArray<ZipReadEntry>,
  templateName: string
): Step<PackageRelationships> => {
  const stripped = stripPackageRelationships(entries)
  return stripped.ok
    ? stripped
    : fail(
        'not_a_docx',
        `template "${templateName}" is not a valid Word document (.docx): part ${stripped.part} ${stripped.message}`,
        stripped.part
      )
}

/** A package that did not open, as the template's error. */
export const unreadable = (
  read: { readonly reason: 'not_a_package' | 'package_too_large'; readonly message: string },
  templateName: string
): { readonly ok: false; readonly error: DocxFillError } => ({
  ok: false,
  error:
    read.reason === 'package_too_large'
      ? {
          reason: 'package_too_large',
          message: `template "${templateName}" is refused: it ${read.message}`,
        }
      : {
          reason: 'not_a_docx',
          message: `template "${templateName}" is not a Word document (.docx): it ${read.message}`,
        },
})
