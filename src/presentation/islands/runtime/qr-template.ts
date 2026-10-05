/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A QR code that encodes a value of the record it stands beside.
 *
 * A `qr-code` whose `value` names `$record.<field>` cannot be drawn on the
 * server when the record is only known in the browser — inside a record
 * drawer's slot, or on a board or gallery card. The server then writes a
 * TEMPLATE host instead of a symbol: `data-qr-template` carries the value as
 * written and `data-qr-title` the accessible name, and this module draws the
 * symbol once the record is known, with the same encoder the server uses.
 *
 * The encoder is imported statically, so only an island that can hold a
 * record-bound QR pays for it (about 7 KB). Its output is the encoder's own
 * SVG — the value becomes module geometry and the title is escaped text — so no
 * record data reaches markup.
 */

import { encodeQrSvg } from '@/domain/models/app/links/qr-code-service'
import { substituteRecordVars } from '@/domain/models/app/pages/substitute-record-vars'

type RecordValues = Readonly<Record<string, unknown>>

/** The template attributes a record-bound QR host carries. */
export interface QrTemplateSpec {
  readonly template: string
  readonly title?: string
  readonly size?: number
  readonly ecc?: 'L' | 'M' | 'Q' | 'H'
}

/** The drawing of one template against one record — `undefined` when it has no value. */
export interface QrDrawing {
  readonly value: string
  readonly svg: string | undefined
}

const ECC_LEVELS: ReadonlySet<string> = new Set(['L', 'M', 'Q', 'H'])

/** Resolve a template against a record, or `undefined` when nothing is left to encode. */
export const resolveQrTemplateValue = (
  template: string,
  record: RecordValues
): string | undefined => {
  const value = substituteRecordVars(template, record)
  return value.length === 0 || value.includes('$record.') ? undefined : value
}

/** Encode one template against one record. */
export function drawQrTemplate(spec: QrTemplateSpec, record: RecordValues): QrDrawing | undefined {
  const value = resolveQrTemplateValue(spec.template, record)
  if (value === undefined) return undefined
  const title = spec.title === undefined ? undefined : substituteRecordVars(spec.title, record)
  const encoded = encodeQrSvg(value, {
    ...(spec.size === undefined ? {} : { size: spec.size }),
    ...(spec.ecc === undefined ? {} : { ecc: spec.ecc }),
    ...(title === undefined ? {} : { title }),
  })
  return { value, svg: encoded.ok ? encoded.value : undefined }
}

/** Read a template host's attributes back into a spec. */
function specOf(host: HTMLElement): QrTemplateSpec | undefined {
  const template = host.dataset['qrTemplate']
  if (template === undefined) return undefined
  const size = Number(host.dataset['qrSize'])
  const ecc = host.dataset['qrEcc']
  return {
    template,
    ...(host.dataset['qrTitle'] === undefined ? {} : { title: host.dataset['qrTitle'] }),
    ...(Number.isFinite(size) && size > 0 ? { size } : {}),
    ...(ecc !== undefined && ECC_LEVELS.has(ecc) ? { ecc: ecc as QrTemplateSpec['ecc'] } : {}),
  }
}

/** Draw one host, or clear it when the record gives it nothing to encode. */
function paintHost(target: HTMLElement, record: RecordValues): void {
  const spec = specOf(target)
  if (spec === undefined) return
  const drawing = drawQrTemplate(spec, record)
  if (drawing === undefined) {
    target.removeAttribute('data-qr-value')
    target.replaceChildren()
    return
  }
  target.setAttribute('data-qr-value', drawing.value)
  target.replaceChildren(svgFragment(drawing.svg))
}

/** The encoder's SVG as nodes — parsed as an SVG document, never as HTML. */
function svgFragment(svg: string | undefined): Node {
  if (svg === undefined) return document.createDocumentFragment()
  const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml')
  return document.importNode(parsed.documentElement, true)
}

/**
 * Draw every record-bound QR under `root` against `record`. Re-run it when the
 * record changes: each host keeps its template, so a drawer re-opened on
 * another record draws the other record's symbol.
 */
export function paintQrTemplates(root: ParentNode, record: RecordValues): void {
  const hosts = Array.from(root.querySelectorAll<HTMLElement>('[data-qr-template]'))
  hosts.forEach((host) => paintHost(host, record))
}
