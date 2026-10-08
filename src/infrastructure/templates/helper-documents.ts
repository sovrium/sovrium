/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Result } from 'effect'
import {
  documentMediaMarker,
  WORD_PAGE_BREAK_MARKER,
  type DocumentMediaRequest,
  type DocumentTarget,
} from '@/application/ports/services/template-engine'
import { dropOptions, optionalStr, toNumber, toStr } from './helper-coercion'
import { TemplateRefusal } from './helper-encoding'

/**
 * The helpers built for documents: `chunk`, `pageBreak`, `image`, `qrcode`
 * and `t`, and the per-render state the locale-aware helpers read.
 *
 * A document render hands the engine its {@link DocumentRenderState} through
 * the Handlebars `data` frame (`@sovriumRender`), so a helper knows what the
 * template renders into, in which language, and where to record a picture it
 * cannot draw by itself. Outside a document render (a prop rendered by the
 * run) there is no state: `t` prints nothing, `image` and `qrcode` print
 * nothing, and the formatting helpers keep `en-US`.
 */

/** The key of the render state in the Handlebars `data` frame. */
export const RENDER_STATE_KEY = 'sovriumRender'

/** What one document render tells its helpers. */
export interface DocumentRenderState {
  readonly target: DocumentTarget
  readonly locale?: string
  readonly translate?: (key: string) => string | undefined
  /** The pictures asked for so far, in marker order (the helpers append to it). */
  readonly media: { current: ReadonlyArray<DocumentMediaRequest> }
}

interface HelperOptions {
  readonly hash?: Readonly<Record<string, unknown>>
  readonly data?: Readonly<Record<string, unknown>>
  /**
   * What each argument was in the template (the engines compile with
   * `trackIds`): a path's text, `true` for a sub-expression, `null` for a
   * literal written in the template itself.
   */
  readonly ids?: ReadonlyArray<unknown>
}

const optionsOf = (args: readonly unknown[]): HelperOptions =>
  (args[args.length - 1] as HelperOptions | undefined) ?? {}

/** The render state of the call, or `undefined` outside a document render. */
export const renderStateOf = (args: readonly unknown[]): DocumentRenderState | undefined =>
  optionsOf(args).data?.[RENDER_STATE_KEY] as DocumentRenderState | undefined

/** The locale a formatting helper uses: the one it names, else the render's. */
export const helperLocale = (
  args: readonly unknown[],
  named: string | undefined
): string | undefined => named ?? renderStateOf(args)?.locale

/**
 * `{{formatCurrency value [code] [locale]}}` — the amount in its currency, in
 * the locale it names, else the document render's, else `en-US`.
 */
export const formatCurrencyHelper = (...args: readonly unknown[]): string => {
  const ops = dropOptions(args)
  const n = toNumber(ops[0])
  if (!Number.isFinite(n)) return ''
  const code = optionalStr(ops, 1) ?? 'USD'
  const locale = helperLocale(args, optionalStr(ops, 2)) ?? 'en-US'
  const result = Result.try({
    try: () => new Intl.NumberFormat(locale, { style: 'currency', currency: code }).format(n),
    catch: () => `${code} ${n.toFixed(2)}`,
  })
  return Result.isSuccess(result) ? result.success : result.failure
}

/** The largest group `chunk` cuts: a label sheet or a grid, never a size a template inflates. */
export const MAX_CHUNK = 1000

/**
 * `{{#each (chunk list n [pad=true])}}` — the list cut into groups of `n`, in
 * order, the last group holding what is left; with `pad=true` the last group
 * is filled with empty entries so every group has `n` slots (5 labels on a
 * 21-label sheet get 16 empty slots). A group larger than {@link MAX_CHUNK}
 * is refused, never silently reduced: padding is bounded by that cap.
 */
export const chunkHelper = (...args: readonly unknown[]): ReadonlyArray<ReadonlyArray<unknown>> => {
  const [list, size] = dropOptions(args)
  const n = Math.floor(toNumber(size))
  if (Number.isFinite(n) && n > MAX_CHUNK) {
    throw new TemplateRefusal(
      `chunk groups at most ${MAX_CHUNK} entries; a group of ${n} was asked for`
    )
  }
  if (!Array.isArray(list) || !Number.isFinite(n) || n < 1) return []
  const pad = optionsOf(args).hash?.['pad'] === true
  const groups = Array.from({ length: Math.ceil(list.length / n) }, (_, index) =>
    list.slice(index * n, index * n + n)
  )
  const last = groups.at(-1)
  return pad && last !== undefined && last.length < n
    ? [...groups.slice(0, -1), [...last, ...Array.from({ length: n - last.length }, () => '')]]
    : groups
}

/** A page break, by target: CSS in HTML, a marker the Word engine turns into `<w:br w:type="page"/>`. */
export const pageBreakHelper = (...args: readonly unknown[]): string => {
  const target = renderStateOf(args)?.target
  if (target === 'html') return '<div style="break-after: page"></div>'
  return target === 'word' ? WORD_PAGE_BREAK_MARKER : ''
}

const positiveHash = (
  hash: Readonly<Record<string, unknown>>,
  name: string
): number | undefined => {
  const value = toNumber(hash[name])
  return Number.isFinite(value) && value >= 0 ? value : undefined
}

const placementOf = (hash: Readonly<Record<string, unknown>>) => {
  const width = positiveHash(hash, 'width')
  const height = positiveHash(hash, 'height')
  const x = positiveHash(hash, 'x')
  const y = positiveHash(hash, 'y')
  return {
    ...(width === undefined ? {} : { width }),
    ...(height === undefined ? {} : { height }),
    ...(x === undefined ? {} : { x }),
    ...(y === undefined ? {} : { y }),
  }
}

/** Record a picture on the render and print its marker in its place. */
const recordMedia = (state: DocumentRenderState, request: DocumentMediaRequest): string => {
  state.media.current = [...state.media.current, request]
  return documentMediaMarker(state.media.current.length - 1)
}

/**
 * `{{image source width=… height=… x=… y=…}}` — a declared image asset (its
 * path) or a stored file (`{ key, bucket }`). The bytes are read after the
 * render, where the source is also judged by who chose it: an asset path
 * written in the template, or one the configuration wrote out; a stored file
 * the configuration wrote out, or one the run produced — never a name the
 * run's data supplied. Here the request is recorded and a marker printed,
 * saying whether the source was a literal of the template.
 */
export const imageHelper = (...args: readonly unknown[]): string => {
  const state = renderStateOf(args)
  if (state === undefined || state.target === 'text') return ''
  const [source] = dropOptions(args)
  const options = optionsOf(args)
  return recordMedia(state, {
    kind: 'image',
    source,
    ...(options.ids?.[0] === null ? { literal: true } : {}),
    ...placementOf(options.hash ?? {}),
  })
}

const ECC_LEVELS: ReadonlySet<string> = new Set(['L', 'M', 'Q', 'H'])

/** `{{qrcode value size=… margin=… ecc=…}}` — a QR code of the value; refused in Word. */
export const qrcodeHelper = (...args: readonly unknown[]): string => {
  const state = renderStateOf(args)
  if (state === undefined || state.target === 'text') return ''
  if (state.target === 'word') {
    throw new TemplateRefusal(
      'qrcode is not available in a Word template; draw it in an SVG or HTML template, or place a picture of it with image'
    )
  }
  const hash = optionsOf(args).hash ?? {}
  const ecc = toStr(hash['ecc']).toUpperCase()
  const size = positiveHash(hash, 'size')
  const margin = positiveHash(hash, 'margin')
  return recordMedia(state, {
    kind: 'qrcode',
    value: toStr(dropOptions(args)[0]),
    ...placementOf(hash),
    ...(size === undefined ? {} : { size }),
    ...(margin === undefined ? {} : { margin }),
    ...(ECC_LEVELS.has(ecc) ? { ecc: ecc as 'L' | 'M' | 'Q' | 'H' } : {}),
  })
}

/**
 * `{{t "key"}}` — the key's translation in the render's language (its
 * fallback chain already applied), escaped like any value; the key itself when
 * no language defines it.
 */
export const translateHelper = (...args: readonly unknown[]): string => {
  const key = toStr(dropOptions(args)[0])
  return renderStateOf(args)?.translate?.(key) ?? key
}
