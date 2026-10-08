/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { assertDrawable, EditRefusal, pdfLib } from './pdf-editor-library'
import type { BuiltPdf, PdfFormValue } from '@/application/ports/services/pdf-editor'
import type { PdfInspectResult } from '@/domain/models/app/automations/actions/pdf/inspect'
import type { PDFDocument, PDFField, PDFFont, PDFForm } from '@cantoo/pdf-lib'

/**
 * PDF forms: listing their fields for `pdf/inspect`, and writing values into
 * them for `pdf/fillForm`. Every value is checked before any is written, so a
 * step that names a field the form lacks, or a choice it does not offer,
 * fails with nothing changed — a renamed field never fails silently.
 */

type Lib = Awaited<ReturnType<typeof pdfLib>>
type FieldReport = PdfInspectResult['formFields'][number]

/** A field's kind, its value and its choices, by the class pdf-lib reads it as. */
const reportOf = (lib: Lib, field: PDFField): Omit<FieldReport, 'name'> => {
  if (field instanceof lib.PDFTextField) {
    const text = field.getText()
    return text === undefined ? { type: 'text' } : { type: 'text', value: text }
  }
  if (field instanceof lib.PDFCheckBox) return { type: 'checkbox', value: field.isChecked() }
  if (field instanceof lib.PDFRadioGroup) {
    const selected = field.getSelected()
    return {
      type: 'radio',
      options: field.getOptions(),
      ...(selected === undefined ? {} : { value: selected }),
    }
  }
  if (field instanceof lib.PDFDropdown) {
    return { type: 'dropdown', options: field.getOptions(), value: field.getSelected() }
  }
  if (field instanceof lib.PDFOptionList) {
    return { type: 'list', options: field.getOptions(), value: field.getSelected() }
  }
  return { type: field instanceof lib.PDFSignature ? 'signature' : 'button' }
}

/** Every form field of a PDF, empty when it has no form. */
export const formFieldsOf = (lib: Lib, document: PDFDocument): PdfInspectResult['formFields'] =>
  document
    .getForm()
    .getFields()
    .map((field) => ({ name: field.getName(), ...reportOf(lib, field) }))

const shown = (value: PdfFormValue): string =>
  Array.isArray(value) ? value.map((item) => `"${String(item)}"`).join(', ') : `"${String(value)}"`

/** The choices `wanted` names that `options` does not offer, refused with the field's name. */
const assertOffered = (
  name: string,
  options: readonly string[],
  wanted: readonly string[]
): void => {
  const unknown = wanted.find((choice) => !options.includes(choice))
  if (unknown !== undefined) {
    throw new EditRefusal(
      `field "${name}" does not offer "${unknown}"; it offers ${options.map((o) => `"${o}"`).join(', ')}`
    )
  }
}

const choicesOf = (value: PdfFormValue): readonly string[] =>
  Array.isArray(value) ? value.map(String) : [String(value)]

const checkboxValue = (name: string, value: PdfFormValue): boolean => {
  if (value === true || value === 'true') return true
  if (value === false || value === 'false') return false
  throw new EditRefusal(
    `field "${name}" is a checkbox; it takes true or false, not ${shown(value)}`
  )
}

/** Check one value against its field, and return how to write it. */
const setterFor = (lib: Lib, field: PDFField, value: PdfFormValue, font: PDFFont): (() => void) => {
  const name = field.getName()
  if (field instanceof lib.PDFTextField) {
    const text = Array.isArray(value) ? value.join(', ') : String(value)
    assertDrawable(font, [text])
    return () => field.setText(text)
  }
  if (field instanceof lib.PDFCheckBox) {
    const checked = checkboxValue(name, value)
    return () => (checked ? field.check() : field.uncheck())
  }
  if (
    field instanceof lib.PDFRadioGroup ||
    field instanceof lib.PDFDropdown ||
    field instanceof lib.PDFOptionList
  ) {
    const choices = choicesOf(value)
    assertOffered(name, field.getOptions(), choices)
    if (field instanceof lib.PDFRadioGroup) return () => field.select(choices[0] ?? '')
    return () => field.select([...choices])
  }
  throw new EditRefusal(`field "${name}" is a button or a signature, which fillForm does not write`)
}

/** The field a name refers to, or a refusal naming the fields the form has. */
const fieldNamed = (form: PDFForm, name: string): PDFField => {
  const field = form.getFieldMaybe(name)
  if (field !== undefined) return field
  const names = form.getFields().map((f) => `"${f.getName()}"`)
  throw new EditRefusal(`the form has no field "${name}"; its fields are ${names.join(', ')}`)
}

/** Write the values into the form, flattening it when asked, and save. */
export const fillPdfForm = async (
  document: PDFDocument,
  values: Readonly<Record<string, PdfFormValue>>,
  flatten: boolean
): Promise<BuiltPdf> => {
  const lib = await pdfLib()
  const form = document.getForm()
  if (form.getFields().length === 0) throw new EditRefusal('the PDF has no form fields')
  const font = await document.embedFont(lib.StandardFonts.Helvetica)
  const setters = Object.entries(values).map(([name, value]) =>
    setterFor(lib, fieldNamed(form, name), value, font)
  )
  setters.forEach((write) => write())
  if (flatten) form.flatten()
  return { bytes: await document.save(), pages: document.getPageCount() }
}
